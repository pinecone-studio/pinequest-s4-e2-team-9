"use server";

import { prisma } from "@/lib/prisma";
import { gradeSubmission } from "@/lib/grading";
import { analyzeStudentAnswerSheet } from "@/lib/student-answer-vision";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const imageTypes = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

export async function createSubmissionDraftAction(formData: FormData) {
  const examId = String(formData.get("examId") || "").trim();
  const studentId = String(formData.get("studentId") || "").trim();
  const answerSheet = formData.get("answerSheet");
  const file =
    typeof File !== "undefined" && answerSheet instanceof File && answerSheet.size > 0
      ? answerSheet
      : null;

  if (!examId) {
    redirect("/dashboard");
  }

  if (!studentId) {
    redirect(`/exams/${examId}/submissions?error=student`);
  }

  if (!file || !imageTypes.has(file.type)) {
    redirect(`/exams/${examId}/submissions?error=file`);
  }

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      classroom: { include: { students: { select: { id: true } } } },
      answerKeys: { orderBy: { question: "asc" } },
      questions: {
        orderBy: { number: "asc" },
        include: { options: { orderBy: { createdAt: "asc" } } },
      },
    },
  });

  if (!exam) {
    redirect("/dashboard");
  }

  if (!exam.classroom.students.some((student) => student.id === studentId)) {
    redirect(`/exams/${examId}/submissions?error=student`);
  }

  if (!isAnswerKeyReady(exam.questions, exam.answerKeys)) {
    redirect(`/exams/${examId}/submissions?error=answerKey`);
  }

  const questionNumbers = exam.questions.map((question) => question.number);
  const optionLabelsByQuestion = Object.fromEntries(
    exam.questions.map((question) => [
      question.number,
      question.options.map((option) => option.label),
    ])
  );
  const analysis = await analyzeStudentAnswerSheet(
    file,
    questionNumbers,
    optionLabelsByQuestion
  );
  const grading = gradeSubmission({
    questions: exam.questions,
    correctAnswers: exam.answerKeys,
    extractedAnswers: analysis.answers,
  });
const submission = await prisma.$transaction(
  async (tx) => {
    const existingSubmission = await tx.submission.findFirst({
      where: {
        examId,
        studentId,
      },
      select: {
        id: true,
      },
    });

    if (existingSubmission) {
      await tx.submissionAnswer.deleteMany({
        where: {
          submissionId: existingSubmission.id,
        },
      });

      const updatedSubmission = await tx.submission.update({
        where: {
          id: existingSubmission.id,
        },
        data: {
          imageUrl: file.name,
          status: "DRAFT",
          score: grading.totalScore,
          total: grading.maxScore,
          percentage: grading.percentage,
        },
      });

      await tx.submissionAnswer.createMany({
        data: grading.rows.map((row) => ({
          ...toSubmissionAnswerCreate(row),
          submissionId: updatedSubmission.id,
        })),
      });

      return updatedSubmission;
    }

    const createdSubmission = await tx.submission.create({
      data: {
        examId,
        studentId,
        imageUrl: file.name,
        status: "DRAFT",
        score: grading.totalScore,
        total: grading.maxScore,
        percentage: grading.percentage,
      },
    });

    await tx.submissionAnswer.createMany({
      data: grading.rows.map((row) => ({
        ...toSubmissionAnswerCreate(row),
        submissionId: createdSubmission.id,
      })),
    });

    return createdSubmission;
  },
  { timeout: 30000 }
);

  console.info("[createSubmissionDraftAction] AI confidence", analysis.confidence);
  console.info("[createSubmissionDraftAction] AI notes", analysis.notes);
  console.info("[createSubmissionDraftAction] answers length", analysis.answers.length);

  revalidatePath(`/exams/${examId}/submissions`);
  redirect(`/exams/${examId}/submissions/${submission.id}/review`);
}

export async function saveReviewedSubmissionAction(formData: FormData) {
  const examId = String(formData.get("examId") || "").trim();
  const submissionId = String(formData.get("submissionId") || "").trim();

  if (!examId || !submissionId) {
    redirect("/dashboard");
  }

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      exam: {
        include: {
          answerKeys: { orderBy: { question: "asc" } },
          questions: {
            orderBy: { number: "asc" },
            include: { options: { orderBy: { createdAt: "asc" } } },
          },
        },
      },
    },
  });

  if (!submission || submission.examId !== examId) {
    redirect(`/exams/${examId}/submissions?error=submission`);
  }

  const grading = gradeSubmission({
    questions: submission.exam.questions,
    correctAnswers: submission.exam.answerKeys,
    extractedAnswers: submission.exam.questions.map((question) => ({
      questionNumber: question.number,
      selectedLabel: String(formData.get(`answer-${question.number}`) || "").trim(),
    })),
  });

  await prisma.$transaction(
    async (tx) => {
      await tx.submissionAnswer.deleteMany({ where: { submissionId } });
      await tx.submissionAnswer.createMany({
        data: grading.rows.map((row) => ({
          submissionId,
          ...toSubmissionAnswerCreate(row),
        })),
      });
      await tx.submission.update({
        where: { id: submissionId },
        data: {
          status: "SAVED",
          score: grading.totalScore,
          total: grading.maxScore,
          percentage: grading.percentage,
        },
      });
    },
    { timeout: 30000 }
  );

  revalidatePath(`/exams/${examId}/submissions`);
  revalidatePath(`/exams/${examId}/submissions/${submissionId}/review`);
  redirect(`/exams/${examId}/submissions?saved=1`);
}

function isAnswerKeyReady(
  questions: Array<{ number: number; options: Array<{ isCorrect: boolean }> }>,
  answerKeys: Array<{ question: number; answer: string }>
) {
  const fallback = new Map(answerKeys.map((item) => [item.question, item.answer]));

  return (
    questions.length > 0 &&
    questions.every(
      (question) =>
        question.options.some((option) => option.isCorrect) ||
        Boolean(fallback.get(question.number))
    )
  );
}

function toSubmissionAnswerCreate(row: {
  questionNumber: number;
  selectedLabel: string;
  correctLabel: string;
  isCorrect: boolean;
  earnedPoints: number;
  maxPoints: number;
}) {
  return {
    question: row.questionNumber,
    selected: row.selectedLabel,
    correct: row.correctLabel,
    isCorrect: row.isCorrect,
    earnedPoints: row.earnedPoints,
    maxPoints: row.maxPoints,
  };
}
