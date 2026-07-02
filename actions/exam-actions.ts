"use server";

import { prisma } from "@/lib/prisma";
import {
  analyzeExamMaterial,
  analyzeExamMaterialPages,
  type ExamMaterialAnalysis,
  type ExamMaterialQuestion,
} from "@/lib/gemini-vision";
import { generateCaptureToken } from "@/lib/capture-token";
import {
  readExamMaterialPageFile,
  saveExamMaterialPageFile,
} from "@/lib/exam-material-storage";
import { deleteExamMaterialStorageObjects } from "@/lib/upload-storage";
import { regradeExamSubmissions } from "@/lib/regrading";
import { SUBJECT_OPTIONS } from "@/lib/subjects";
import { requireCurrentUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const defaultOptionLabels = ["A", "B", "C", "D"];

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

    const questions = buildQuestions(analysis);
    createdQuestionsCount = questions.length;
    const exam = await prisma.exam.create({
      data: {
        title,
        subject,
        classroomId,
        ownerUserId: user.id,
        captureToken: generateCaptureToken(),
        questionCount: questions.length,
        materialUrl: null,
        questions: { create: questions },
      },
    });
    examId = exam.id;
    let savedStoragePath: string | null = null;
    try {
      const saved = await saveExamMaterialPageFile({
        file: materialFile,
        examId,
        pageNumber: 1,
      });
      savedStoragePath = saved.storagePath;

      await prisma.$transaction([
        prisma.examMaterialPage.create({
          data: {
            examId,
            pageNumber: 1,
            fileName: saved.fileName,
            mimeType: saved.mimeType,
            storagePath: saved.storagePath,
            publicUrl: saved.publicUrl,
          },
        }),
        prisma.exam.update({
          where: { id: examId },
          data: { materialUrl: saved.publicUrl ?? saved.storagePath },
        }),
      ]);
    } catch (error) {
      if (savedStoragePath) {
        await deleteExamMaterialStorageObjects([savedStoragePath]);
      }
      await prisma.exam.delete({ where: { id: examId } }).catch(() => null);
      throw error;
    }
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
    select: {
      id: true,
      materialPages: { select: { storagePath: true } },
    },
  });

  if (!exam) {
    throw new Error("Шалгалт олдсонгүй.");
  }

  const saved = await saveExamMaterialPageFile({
    file: materialFile,
    examId,
    pageNumber: 1,
  });
  const oldStoragePaths = exam.materialPages.map((page) => page.storagePath);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.examMaterialPage.deleteMany({ where: { examId } });
      await tx.examMaterialPage.create({
        data: {
          examId,
          pageNumber: 1,
          fileName: saved.fileName,
          mimeType: saved.mimeType,
          storagePath: saved.storagePath,
          publicUrl: saved.publicUrl,
        },
      });
      await tx.exam.update({
        where: { id: exam.id },
        data: { materialUrl: saved.publicUrl ?? saved.storagePath },
      });
    });
  } catch (error) {
    await deleteExamMaterialStorageObjects([saved.storagePath]);
    throw error;
  }

  await deleteExamMaterialStorageObjects(oldStoragePaths);

  revalidatePath(`/exams/${examId}/answer-key`);
  redirect(`/exams/${examId}/answer-key`);
}

export async function uploadExamMaterialPagesAction(formData: FormData) {
  const user = await requireCurrentUser();
  const examId = String(formData.get("examId") || "").trim();
  const files = formData
    .getAll("materials")
    .filter((value): value is File => typeof File !== "undefined" && value instanceof File && value.size > 0);

  if (!examId) {
    throw new Error("Шалгалтын ID дутуу байна.");
  }

  if (files.length === 0) {
    throw new Error("Шалгалтын материалын зураг оруулна уу.");
  }

  const exam = await prisma.exam.findFirst({
    where: { id: examId, ownerUserId: user.id },
    select: {
      id: true,
      materialPages: {
        orderBy: { pageNumber: "desc" },
        take: 1,
        select: { pageNumber: true },
      },
    },
  });

  if (!exam) {
    throw new Error("Шалгалт олдсонгүй.");
  }

  if (files.some((file) => !file.type.startsWith("image/"))) {
    throw new Error("Зөвхөн зургийн файл оруулна уу.");
  }

  const startPageNumber = (exam.materialPages[0]?.pageNumber ?? 0) + 1;
  const pages = await Promise.all(
    files.map(async (file, index) => {
      const pageNumber = startPageNumber + index;
      const saved = await saveExamMaterialPageFile({ file, examId, pageNumber });

      return {
        examId,
        pageNumber,
        fileName: saved.fileName,
        mimeType: saved.mimeType,
        storagePath: saved.storagePath,
        publicUrl: saved.publicUrl,
      };
    })
  );

  try {
    await prisma.examMaterialPage.createMany({ data: pages });

    if (startPageNumber === 1 && pages[0]) {
      await prisma.exam.update({
        where: { id: examId },
        data: { materialUrl: pages[0].publicUrl ?? pages[0].storagePath },
      });
    }
  } catch (error) {
    await deleteExamMaterialStorageObjects(pages.map((page) => page.storagePath));
    throw error;
  }

  revalidatePath(`/exams/${examId}/answer-key`);
  redirect(`/exams/${examId}/answer-key`);
}

export async function deleteExamMaterialPageAction(formData: FormData) {
  const user = await requireCurrentUser();
  const pageId = String(formData.get("pageId") || "").trim();

  if (!pageId) {
    throw new Error("Хуудасны ID дутуу байна.");
  }

  const page = await prisma.examMaterialPage.findFirst({
    where: { id: pageId, exam: { ownerUserId: user.id } },
    select: { id: true, examId: true, storagePath: true },
  });

  if (!page) {
    throw new Error("Хуудас олдсонгүй.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.examMaterialPage.delete({ where: { id: page.id } });
    const remaining = await tx.examMaterialPage.findMany({
      where: { examId: page.examId },
      orderBy: { pageNumber: "asc" },
      select: { id: true, publicUrl: true, storagePath: true },
    });

    for (const [index, item] of remaining.entries()) {
      await tx.examMaterialPage.update({
        where: { id: item.id },
        data: { pageNumber: index + 1 },
      });
    }

    await tx.exam.update({
      where: { id: page.examId },
      data: { materialUrl: remaining[0]?.publicUrl ?? remaining[0]?.storagePath ?? null },
    });
  });

  await deleteExamMaterialStorageObjects([page.storagePath]);

  revalidatePath(`/exams/${page.examId}/answer-key`);
  redirect(`/exams/${page.examId}/answer-key`);
}

export async function processExamMaterialPagesAction(formData: FormData) {
  const user = await requireCurrentUser();
  const examId = String(formData.get("examId") || "").trim();

  if (!examId) {
    throw new Error("Шалгалтын ID дутуу байна.");
  }

  const exam = await prisma.exam.findFirst({
    where: { id: examId, ownerUserId: user.id },
    select: {
      id: true,
      materialPages: {
        orderBy: { pageNumber: "asc" },
        select: {
          id: true,
          pageNumber: true,
          fileName: true,
          mimeType: true,
          storagePath: true,
          publicUrl: true,
        },
      },
    },
  });

  if (!exam) {
    throw new Error("Шалгалт олдсонгүй.");
  }

  if (exam.materialPages.length === 0) {
    throw new Error("Эхлээд шалгалтын материалын хуудсууд оруулна уу.");
  }

  await prisma.examMaterialPage.updateMany({
    where: { examId },
    data: { status: "PROCESSING", errorMessage: null },
  });

  try {
    const files = await Promise.all(
      exam.materialPages.map(async (page) => ({
        pageNumber: page.pageNumber,
        file: await readExamMaterialPageFile(page),
      }))
    );
    const analysis = await analyzeExamMaterialPages(files);

    if (analysis.questions.length === 0) {
      throw new Error(analysis.notes || "AI асуулт таньсангүй.");
    }

    const questions = buildQuestions(analysis);
    const answerKeys = questions.flatMap((question) => {
      const correct = question.options.create.find((option) => option.isCorrect);

      return correct
        ? [{ examId, question: question.number, answer: correct.label }]
        : [];
    });

    await prisma.$transaction(
      async (tx) => {
        await tx.answerKey.deleteMany({ where: { examId } });
        await tx.examQuestion.deleteMany({ where: { examId } });

        for (const question of questions) {
          await tx.examQuestion.create({
            data: {
              examId,
              number: question.number,
              text: question.text,
              points: question.points,
              sourcePageNumber: question.sourcePageNumber,
              options: question.options,
            },
          });
        }

        if (answerKeys.length > 0) {
          await tx.answerKey.createMany({ data: answerKeys });
        }

        await tx.exam.update({
          where: { id: examId },
          data: { questionCount: questions.length },
        });

        await tx.examMaterialPage.updateMany({
          where: { examId },
          data: { status: "PROCESSED", extractionJson: analysis },
        });
      },
      { timeout: 30000 }
    );

    await regradeExamSubmissions(examId);
  } catch (error) {
    await prisma.examMaterialPage.updateMany({
      where: { examId },
      data: { status: "FAILED", errorMessage: getErrorMessage(error) },
    });
    throw error;
  }

  revalidatePath(`/exams/${examId}/answer-key`);
  revalidatePath(`/exams/${examId}/submissions`);
  revalidatePath(`/exams/${examId}/results`);
  revalidatePath("/dashboard");
  redirect(`/exams/${examId}/answer-key`);
}

function buildQuestions(analysis: ExamMaterialAnalysis) {
  const usedNumbers = new Set<number>();

  return analysis.questions.map((question, index) => {
    const number = getUniqueQuestionNumber(question.number, index, usedNumbers);
    const options = normalizeOptions(question.options);

    return {
      number,
      text: question.text,
      points: question.points && question.points > 0 ? question.points : 1,
      sourcePageNumber: question.sourcePageNumber ?? null,
      options: { create: options },
    };
  });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
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

function normalizeOptions(options: ExamMaterialQuestion["options"]) {
  const source = options.length
    ? options
    : defaultOptionLabels.map((label) => ({ label, text: "", isCorrect: false }));
  let hasCorrect = false;

  return source.map((option, index) => {
    const isCorrect = option.isCorrect === true && !hasCorrect;
    hasCorrect ||= isCorrect;

    return {
      label: option.label.trim() || defaultOptionLabels[index] || String(index + 1),
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
