"use server";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isAnswerKeyReady } from "@/lib/answer-key-readiness";
import { expandQuestionsToCount, gradeSubmission } from "@/lib/grading";
import { generateCaptureToken } from "@/lib/capture-token";
import { processSubmissionByToken } from "@/lib/submission-processing";
import { saveSubmissionPageFile } from "@/lib/submission-image-storage";
import { deleteSubmissionStorageObjects } from "@/lib/upload-storage";
import { msSince, perfLog } from "@/lib/perf";
import { submissionStatuses } from "@/lib/submission-state";
import { requireCurrentUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const answerFileTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "application/pdf",
]);

export async function createSubmissionDraftAction(formData: FormData) {
  const actionStartedAt = Date.now();
  const examId = String(formData.get("examId") || "").trim();
  const studentId = String(formData.get("studentId") || "").trim();
  const originalImageSize = getPositiveNumber(formData.get("originalImageSize"));
  const compressedImageSize = getPositiveNumber(formData.get("compressedImageSize"));
  const originalMimeType = String(formData.get("originalMimeType") || "").trim();
  const compressedMimeType = String(formData.get("compressedMimeType") || "").trim();
  const captureToken = String(formData.get("captureToken") || "").trim();
  const files = getAnswerFiles(formData);

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

  if (files.length === 0 || files.some((file) => !answerFileTypes.has(file.type))) {
    redirect(`${returnPath}${returnQuery}error=file`);
  }

  console.info(
    `[submission-speed] upload pageCount=${files.length} originalSizeBytes=${originalImageSize ?? "unknown"} compressedSizeBytes=${compressedImageSize ?? "unknown"} originalMime=${originalMimeType || "unknown"} compressedMime=${compressedMimeType || "unknown"}`
  );
  for (const [index, file] of files.entries()) {
    console.info("[submission-speed] upload page", index + 1, {
      name: file.name,
      mime: file.type,
      sizeBytes: file.size,
    });
  }

  const exam = await prisma.exam.findFirst({
    where: captureToken
      ? { id: examId, captureToken }
      : { id: examId, ownerUserId: user?.id },
    select: {
      id: true,
      captureToken: true,
      questionCount: true,
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

  const questions = expandQuestionsToCount(
    exam.questions,
    exam.questionCount,
    exam.answerKeys
  );
  const answerKeyReady = isAnswerKeyReady(questions, exam.answerKeys);

  if (!answerKeyReady) {
    redirect(`${returnPath}${returnQuery}error=answerKey`);
  }

  const processingToken = exam.captureToken ?? generateCaptureToken();

  if (!exam.captureToken) {
    await prisma.exam.update({
      where: { id: exam.id },
      data: { captureToken: processingToken },
    });
  }
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
            imageUrl: null,
            status: "PROCESSING",
            score: 0,
            total: 0,
            percentage: 0,
            pageCount: files.length,
            gradingDetails: Prisma.JsonNull,
          },
        });

        return updatedSubmission;
      }

      const createdSubmission = await tx.submission.create({
        data: {
          examId,
          studentId,
          imageUrl: null,
          status: "PROCESSING",
          pageCount: files.length,
        },
      });

      return createdSubmission;
    },
    { timeout: 30000 }
  );
  const pages = await Promise.all(
    files.map(async (file, index) => {
      const pageNumber = index + 1;
      const saved = await saveSubmissionPageFile({
        file,
        examId,
        studentId,
        submissionId: submission.id,
        pageNumber,
      });

      return {
        submissionId: submission.id,
        pageNumber,
        fileName: saved.fileName,
        mimeType: saved.mimeType,
        storagePath: saved.storagePath,
        publicUrl: saved.publicUrl,
      };
    })
  );

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.submissionPage.createMany({ data: pages });
        await tx.submission.update({
          where: { id: submission.id },
          data: { imageUrl: pages[0]?.publicUrl ?? pages[0]?.storagePath ?? null },
        });
      },
      { timeout: 30000 }
    );
  } catch (error) {
    await deleteSubmissionStorageObjects(pages.map((page) => page.storagePath));
    throw error;
  }

  await deleteSubmissionStorageObjects(oldStoragePaths);
  console.info(`[submission-speed] dbSaveMs=${Date.now() - dbStartedAt}`);

  let processStatus = "FAILED";

  try {
    processStatus = (
      await processSubmissionByToken({
        submissionId: submission.id,
        token: processingToken,
      })
    ).status;
  } catch (error) {
    console.error("[createSubmissionDraftAction] process failed", error);
  }

  revalidatePath(`/exams/${examId}/submissions`);
  revalidatePath(`/exams/${examId}/results`);
  console.info(`[submission-speed] fullSubmissionMs=${Date.now() - actionStartedAt}`);
  if (captureToken) {
    redirect(`${returnPath}&submitted=1&submissionId=${encodeURIComponent(submission.id)}`);
  }

  redirect(
    processStatus === submissionStatuses.saved
      ? `/exams/${examId}/submissions?saved=1`
      : `/exams/${examId}/submissions/${submission.id}/review`
  );
}

function getAnswerFiles(formData: FormData) {
  return ["answerFiles", "answerFile", "file", "image", "answerSheet"]
    .flatMap((name) => formData.getAll(name))
    .filter((value): value is File => typeof File !== "undefined" && value instanceof File && value.size > 0);
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
          questionCount: true,
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
  const questions = expandQuestionsToCount(
    submission.exam.questions,
    submission.exam.questionCount,
    submission.exam.answerKeys
  );
  const extractedAnswers = questions.map((question) => ({
    questionNumber: question.number,
    selectedLabel: String(formData.get(`answer-${question.number}`) || "").trim(),
  }));
  const parseMs = msSince(parseStartedAt);
  console.info(`[review-save-speed] parseFormMs=${parseMs}`);

  const gradingStartedAt = Date.now();
  const grading = gradeSubmission({
    questions,
    correctAnswers: submission.exam.answerKeys,
    extractedAnswers,
    questionCount: submission.exam.questionCount,
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
