"use server";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isAnswerKeyReady } from "@/lib/answer-key-readiness";
import { gradeSubmission } from "@/lib/grading";
import { analyzeStudentAnswerSheet } from "@/lib/student-answer-vision";
import { saveSubmissionImageFile } from "@/lib/submission-image-storage";
import { deleteSubmissionStorageObjects } from "@/lib/upload-storage";
import { msSince, perfLog } from "@/lib/perf";
import {
  decideProcessedSubmissionStatus,
  submissionStatuses,
} from "@/lib/submission-state";
import { requireCurrentUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const imageTypes = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

export async function createSubmissionDraftAction(formData: FormData) {
  const actionStartedAt = Date.now();
  const examId = String(formData.get("examId") || "").trim();
  const studentId = String(formData.get("studentId") || "").trim();
  const originalImageSize = getPositiveNumber(formData.get("originalImageSize"));
  const compressedImageSize = getPositiveNumber(formData.get("compressedImageSize"));
  const originalMimeType = String(formData.get("originalMimeType") || "").trim();
  const compressedMimeType = String(formData.get("compressedMimeType") || "").trim();
  const captureToken = String(formData.get("captureToken") || "").trim();
  const answerSheet = formData.get("answerSheet");
  const file =
    typeof File !== "undefined" && answerSheet instanceof File && answerSheet.size > 0
      ? answerSheet
      : null;

  if (!examId) {
    redirect("/dashboard");
  }

  const user = captureToken ? null : await requireCurrentUser();
  const returnPath = captureToken
    ? `/exams/${examId}/capture?token=${encodeURIComponent(captureToken)}`
    : `/exams/${examId}/submissions`;
  const returnQuery = captureToken ? "&" : "?";

  if (!studentId) {
    redirect(`${returnPath}${returnQuery}error=student`);
  }

  if (!file || !imageTypes.has(file.type)) {
    redirect(`${returnPath}${returnQuery}error=file`);
  }

  console.info(
    `[submission-speed] upload name=${file.name} mime=${file.type} sizeBytes=${file.size} originalSizeBytes=${originalImageSize ?? "unknown"} compressedSizeBytes=${compressedImageSize ?? "unknown"} originalMime=${originalMimeType || "unknown"} compressedMime=${compressedMimeType || "unknown"}`
  );

  const exam = await prisma.exam.findFirst({
    where: captureToken
      ? { id: examId, captureToken }
      : { id: examId, ownerUserId: user?.id },
    select: {
      classroom: { select: { students: { select: { id: true } } } },
      answerKeys: {
        orderBy: { question: "asc" },
        select: { question: true, answer: true },
      },
      questions: {
        orderBy: { number: "asc" },
        select: {
          number: true,
          points: true,
          sourcePageNumber: true,
          options: {
            orderBy: { createdAt: "asc" },
            select: { label: true, isCorrect: true },
          },
        },
      },
    },
  });

  if (!exam) {
    redirect(captureToken ? `/exams/${examId}/capture` : "/dashboard");
  }

  if (!exam.classroom.students.some((student) => student.id === studentId)) {
    redirect(`${returnPath}${returnQuery}error=student`);
  }

  const answerKeyReady = isAnswerKeyReady(exam.questions, exam.answerKeys);

  if (!answerKeyReady) {
    redirect(`${returnPath}${returnQuery}error=answerKey`);
  }

  const questionNumbers = exam.questions.map((question) => question.number);
  const optionLabelsByQuestion = Object.fromEntries(
    exam.questions.map((question) => [
      question.number,
      question.options.map((option) => option.label),
    ])
  );
  const geminiStartedAt = Date.now();
  const analysis = await analyzeStudentAnswerSheet(
    file,
    questionNumbers,
    optionLabelsByQuestion
  );
  console.info(`[submission-speed] geminiMs=${Date.now() - geminiStartedAt}`);

  const gradingStartedAt = Date.now();
  const grading = gradeSubmission({
    questions: exam.questions,
    correctAnswers: exam.answerKeys,
    extractedAnswers: analysis.answers,
  });
  const statusDecision = decideProcessedSubmissionStatus({
    analysis,
    questionNumbers,
    optionLabelsByQuestion,
    answerKeyReady,
  });
  console.info(`[submission-speed] gradingMs=${Date.now() - gradingStartedAt}`);

  const imageUrl = await saveSubmissionImageFile({
    file,
    examId,
    clientSubmissionKey: randomUUID(),
  });
  const dbStartedAt = Date.now();
  let oldStoragePaths: string[] = [];
  const submission = await prisma.$transaction(
    async (tx) => {
      const existingSubmission = await tx.submission.findFirst({
        where: {
          examId,
          studentId,
        },
        select: {
          id: true,
          pages: { select: { storagePath: true } },
        },
      });

      if (existingSubmission) {
        oldStoragePaths = existingSubmission.pages.map((page) => page.storagePath);
        await tx.submissionAnswer.deleteMany({
          where: {
            submissionId: existingSubmission.id,
          },
        });
        await tx.submissionPage.deleteMany({
          where: {
            submissionId: existingSubmission.id,
          },
        });

        const updatedSubmission = await tx.submission.update({
          where: {
            id: existingSubmission.id,
          },
          data: {
            imageUrl,
            status: statusDecision.status,
            score: grading.totalScore,
            total: grading.maxScore,
            percentage: grading.percentage,
            pageCount: 1,
            gradingDetails: grading.rows,
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
          imageUrl,
          status: statusDecision.status,
          score: grading.totalScore,
          total: grading.maxScore,
          percentage: grading.percentage,
          pageCount: 1,
          gradingDetails: grading.rows,
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
  await deleteSubmissionStorageObjects(oldStoragePaths);
  console.info(`[submission-speed] dbSaveMs=${Date.now() - dbStartedAt}`);

  console.info("[createSubmissionDraftAction] AI confidence", analysis.confidence);
  console.info("[createSubmissionDraftAction] AI notes", analysis.notes);
  console.info("[createSubmissionDraftAction] answers length", analysis.answers.length);
  console.info("[createSubmissionDraftAction] status decision", statusDecision);

  revalidatePath(`/exams/${examId}/submissions`);
  revalidatePath(`/exams/${examId}/results`);
  console.info(`[submission-speed] fullSubmissionMs=${Date.now() - actionStartedAt}`);
  if (captureToken) {
    redirect(`${returnPath}&submitted=1&submissionId=${encodeURIComponent(submission.id)}`);
  }

  redirect(
    statusDecision.status === submissionStatuses.saved
      ? `/exams/${examId}/submissions?saved=1`
      : `/exams/${examId}/submissions/${submission.id}/review`
  );
}

export async function saveReviewedSubmissionAction(formData: FormData) {
  const actionStartedAt = Date.now();
  const authStartedAt = Date.now();
  const user = await requireCurrentUser();
  const authMs = msSince(authStartedAt);
  const examId = String(formData.get("examId") || "").trim();
  const submissionId = String(formData.get("submissionId") || "").trim();

  if (!examId || !submissionId) {
    redirect("/dashboard");
  }

  const loadStartedAt = Date.now();
  const submission = await prisma.submission.findFirst({
    where: { id: submissionId, examId, exam: { ownerUserId: user.id } },
    select: {
      examId: true,
      exam: {
        select: {
          answerKeys: {
            orderBy: { question: "asc" },
            select: { question: true, answer: true },
          },
          questions: {
            orderBy: { number: "asc" },
            select: {
              number: true,
              points: true,
              sourcePageNumber: true,
              options: {
                orderBy: { createdAt: "asc" },
                select: { label: true, isCorrect: true },
              },
            },
          },
        },
      },
    },
  });
  const loadMs = msSince(loadStartedAt);
  console.info(`[review-save-speed] loadSubmissionMs=${loadMs}`);

  if (!submission) {
    redirect(`/exams/${examId}/submissions?error=submission`);
  }

  const parseStartedAt = Date.now();
  const extractedAnswers = submission.exam.questions.map((question) => ({
    questionNumber: question.number,
    selectedLabel: String(formData.get(`answer-${question.number}`) || "").trim(),
  }));
  const parseMs = msSince(parseStartedAt);
  console.info(`[review-save-speed] parseFormMs=${parseMs}`);

  const gradingStartedAt = Date.now();
  const grading = gradeSubmission({
    questions: submission.exam.questions,
    correctAnswers: submission.exam.answerKeys,
    extractedAnswers,
  });
  const gradingMs = msSince(gradingStartedAt);
  console.info(`[review-save-speed] gradingMs=${gradingMs}`);

  const transactionStartedAt = Date.now();
  await prisma.$transaction(
    async (tx) => {
      const deleteStartedAt = Date.now();
      await tx.submissionAnswer.deleteMany({ where: { submissionId } });
      console.info(`[review-save-speed] deleteAnswersMs=${Date.now() - deleteStartedAt}`);

      const createStartedAt = Date.now();
      await tx.submissionAnswer.createMany({
        data: grading.rows.map((row) => ({
          submissionId,
          ...toSubmissionAnswerCreate(row),
        })),
      });
      console.info(`[review-save-speed] createAnswersMs=${Date.now() - createStartedAt}`);

      const updateStartedAt = Date.now();
      await tx.submission.update({
        where: { id: submissionId },
        data: {
          status: "SAVED",
          score: grading.totalScore,
          total: grading.maxScore,
          percentage: grading.percentage,
          gradingDetails: grading.rows,
        },
      });
      console.info(`[review-save-speed] updateSubmissionMs=${Date.now() - updateStartedAt}`);
    },
    { timeout: 30000 }
  );
  const transactionMs = msSince(transactionStartedAt);
  console.info(`[review-save-speed] dbTransactionMs=${transactionMs}`);

  const revalidateStartedAt = Date.now();
  revalidatePath(`/exams/${examId}/submissions`);
  revalidatePath(`/exams/${examId}/submissions/${submissionId}/review`);
  revalidatePath(`/exams/${examId}/results`);
  const revalidateMs = msSince(revalidateStartedAt);
  console.info(`[review-save-speed] revalidateMs=${revalidateMs}`);
  console.info(`[review-save-speed] totalMs=${msSince(actionStartedAt)}`);
  perfLog("review-save", {
    authMs,
    loadMs,
    parseMs,
    gradingMs,
    transactionMs,
    revalidateMs,
    totalMs: msSince(actionStartedAt),
  });
  redirect(`/exams/${examId}/submissions?saved=1`);
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

function getPositiveNumber(value: FormDataEntryValue | null) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? number : null;
}
