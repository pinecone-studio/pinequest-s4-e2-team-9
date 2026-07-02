"use server";

import { prisma } from "@/lib/prisma";
import {
  analyzeExamMaterial,
  type ExamMaterialAnalysis,
  type ExamMaterialQuestion,
} from "@/lib/gemini-vision";
import { formatMatchingPairs, normalizeAnswerLabel, serializeStoredAnswerKey } from "@/lib/grading";
import { generateCaptureToken } from "@/lib/capture-token";
import { saveExamMaterialFile } from "@/lib/exam-material-storage";
import { SUBJECT_OPTIONS } from "@/lib/subjects";
import { requireCurrentUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const defaultOptionLabels = ["a", "b", "c", "d"];

export async function createExamAction(formData: FormData) {
  const user = await requireCurrentUser();
  const title = String(formData.get("title") || "").trim();
  const subject = String(formData.get("subject") || "").trim();
  const classroomId = String(formData.get("classroomId") || "").trim();
  const manualQuestionCount = Number(formData.get("questionCount") || 0);
  const material = formData.get("material");
  const materialFile =
    typeof File !== "undefined" && material instanceof File && material.size > 0
      ? material
      : null;

  if (
    !title ||
    !subject ||
    !SUBJECT_OPTIONS.includes(subject) ||
    !classroomId
  ) {
    throw new Error("Шалгалтын мэдээлэл дутуу байна.");
  }

  if (
    !materialFile &&
    (!Number.isInteger(manualQuestionCount) || manualQuestionCount < 1)
  ) {
    throw new Error("Асуултын тоо дутуу байна.");
  }

  const classroom = await prisma.classroom.findFirst({
    where: { id: classroomId, ownerUserId: user.id },
    select: { id: true },
  });

  if (!classroom) {
    throw new Error("Анги олдсонгүй.");
  }

  console.info("[createExamAction] material exists", Boolean(materialFile));

  if (materialFile) {
    console.info("[createExamAction] material name", materialFile.name);
    console.info("[createExamAction] material type", materialFile.type);
    console.info("[createExamAction] material size", materialFile.size);
  }

  let createdQuestionsCount = 0;
  let examId = "";

  if (materialFile) {
    const analysis = await analyzeExamMaterial(materialFile);
    console.info("[createExamAction] AI confidence", analysis.confidence);
    console.info("[createExamAction] AI questionCount", analysis.questionCount);
    console.info("[createExamAction] AI questions length", analysis.questions.length);
    console.info("[createExamAction] first question", analysis.questions[0]);

    if (analysis.questions.length === 0) {
      redirect(`/exams/new?classroomId=${encodeURIComponent(classroomId)}&aiError=1`);
    }

    const parsedExam = buildParsedExam(analysis);
    createdQuestionsCount = parsedExam.questions.length;
    const materialUrl = await saveExamMaterialFile(materialFile);

    const exam = await prisma.exam.create({
      data: {
        title,
        subject,
        classroomId,
        ownerUserId: user.id,
        captureToken: generateCaptureToken(),
        questionCount: parsedExam.questions.length,
        materialUrl,
        questions: { create: parsedExam.questions },
        ...(parsedExam.answerKeys.length
          ? { answerKeys: { create: parsedExam.answerKeys } }
          : {}),
      },
    });
    examId = exam.id;
  } else {
    const questions = buildBlankQuestions(manualQuestionCount);
    createdQuestionsCount = questions.length;

    const exam = await prisma.exam.create({
      data: {
        title,
        subject,
        classroomId,
        ownerUserId: user.id,
        captureToken: generateCaptureToken(),
        questionCount: manualQuestionCount,
        materialUrl: null,
        questions: { create: questions },
      },
    });
    examId = exam.id;
  }

  console.info("[createExamAction] created questions count", createdQuestionsCount);

  revalidatePath("/dashboard");
  revalidatePath("/classrooms");
  revalidatePath(`/classrooms/${classroomId}`);
  redirect(`/exams/${examId}/answer-key`);
}

export async function replaceExamMaterialAction(formData: FormData) {
  const user = await requireCurrentUser();
  const examId = String(formData.get("examId") || "").trim();
  const material = formData.get("material");
  const materialFile =
    typeof File !== "undefined" && material instanceof File && material.size > 0
      ? material
      : null;

  if (!examId) {
    throw new Error("Шалгалтын ID дутуу байна.");
  }

  if (!materialFile) {
    throw new Error("Эх материалын файл оруулна уу.");
  }

  if (!isSupportedMaterialFile(materialFile)) {
    throw new Error("Зөвхөн зураг эсвэл PDF файл оруулна уу.");
  }

  const exam = await prisma.exam.findFirst({
    where: { id: examId, ownerUserId: user.id },
    select: { id: true },
  });

  if (!exam) {
    throw new Error("Шалгалт олдсонгүй.");
  }

  const materialUrl = await saveExamMaterialFile(materialFile);

  await prisma.exam.update({
    where: { id: exam.id },
    data: { materialUrl },
  });

  revalidatePath(`/exams/${examId}/answer-key`);
  redirect(`/exams/${examId}/answer-key`);
}

function buildParsedExam(analysis: ExamMaterialAnalysis) {
  const usedNumbers = new Set<number>();
  const answerKeys: Array<{ question: number; answer: string }> = [];

  const questions = analysis.questions.map((question, index) => {
    const number = getUniqueQuestionNumber(question.number, index, usedNumbers);
    const options = normalizeOptions(
      question.options,
      question.type === "MULTIPLE_CHOICE"
    );
    const correctAnswer =
      question.correctAnswer ||
      question.options.find((option) => option.isCorrect)?.label ||
      formatMatchingPairs(question.correctPairs ?? []);

    const hasStructuredAnswer =
  question.type === "MATCHING" ||
  question.gradingMode === "matching_pairs" ||
  Boolean(question.correctPairs?.length) ||
  Boolean(question.leftItems?.length) ||
  Boolean(question.rightItems?.length);

if (correctAnswer || hasStructuredAnswer) {
  answerKeys.push({
    question: number,
    answer: serializeStoredAnswerKey({
      type: question.type,
      gradingMode: question.gradingMode,
      correctAnswer,
      correctPairs: question.correctPairs,
      acceptedEquivalentAnswers: question.acceptedEquivalentAnswers,
      leftItems: question.leftItems,
      rightItems: question.rightItems,
    }),
  });
}

    return {
      number,
      text: question.text,
      points: question.points && question.points > 0 ? question.points : 1,
      options: { create: options },
    };
  });

  return { questions, answerKeys };
}

function getUniqueQuestionNumber(number: number, index: number, usedNumbers: Set<number>) {
  let candidate = Number.isInteger(number) && number > 0 ? number : index + 1;

  while (usedNumbers.has(candidate)) {
    candidate += 1;
  }

  usedNumbers.add(candidate);
  return candidate;
}

function buildBlankQuestions(questionCount: number) {
  return Array.from({ length: questionCount }, (_, index) => ({
    number: index + 1,
    text: "",
    points: 1,
    options: { create: normalizeOptions([]) },
  }));
}

function normalizeOptions(options: ExamMaterialQuestion["options"], useDefaults = true) {
  const source = options.length
    ? options
    : useDefaults
      ? defaultOptionLabels.map((label) => ({ label, text: "", isCorrect: false }))
      : [];
  let hasCorrect = false;

  return source.map((option, index) => {
    const isCorrect = option.isCorrect === true && !hasCorrect;
    hasCorrect ||= isCorrect;

    return {
      label: normalizeAnswerLabel(option.label) || option.label.trim() || defaultOptionLabels[index] || String(index + 1),
      text: option.text.trim(),
      isCorrect,
    };
  });
}

function isSupportedMaterialFile(file: File) {
  const lowerName = file.name.toLowerCase();

  return (
    file.type.startsWith("image/") ||
    file.type === "application/pdf" ||
    /\.(png|jpe?g|webp|gif|pdf)$/i.test(lowerName)
  );
}
