import "server-only";
import { revalidatePath } from "next/cache";
import { isAnswerKeyReady } from "@/lib/answer-key-readiness";
import { expandQuestionsToCount, gradeSubmission } from "@/lib/grading";
import { msSince, perfLog } from "@/lib/perf";
import { prisma } from "@/lib/prisma";
import {
  readSubmissionImageFile,
  readSubmissionPageFile,
} from "@/lib/submission-image-storage";
import { decideProcessedSubmissionStatus } from "@/lib/submission-state";
import {
  analyzeStudentAnswerPages,
  analyzeStudentAnswerSheet,
} from "@/lib/student-answer-vision";

const defaultOptionLabels = ["A", "B", "C", "D"];

export class SubmissionProcessError extends Error {
  constructor(message: string, readonly status = 500) {
    super(message);
  }
}

export async function processSubmissionByToken({
  submissionId,
  token,
}: {
  submissionId: string;
  token: string;
}) {
  const totalStartedAt = Date.now();
  const loadStartedAt = Date.now();
  let examId: string | null = null;

  try {
    const submission = await prisma.submission.findFirst({
      where: { id: submissionId, exam: { captureToken: token } },
      select: {
        id: true,
        examId: true,
        imageUrl: true,
        status: true,
        pages: {
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

    if (!submission) {
      throw new SubmissionProcessError("Илгээсэн хариулт олдсонгүй.", 404);
    }

    examId = submission.examId;
    const gradeQuestions = expandQuestionsToCount(
      submission.exam.questions,
      submission.exam.questionCount,
      submission.exam.answerKeys
    );

    if (submission.status !== "PROCESSING" && submission.status !== "FAILED") {
      perfLog("submission-process", {
        loadMs,
        skippedStatus: submission.status,
        totalMs: msSince(totalStartedAt),
      });

      return { status: submission.status };
    }

    const questionNumbers = gradeQuestions.map((question) => question.number);
    const optionLabelsByQuestion = Object.fromEntries(
      gradeQuestions.map((question) => [
        question.number,
        getOptionLabels(question.options),
      ])
    );

    await prisma.submission.update({
      where: { id: submissionId },
      data: { status: "PROCESSING" },
    });
    await prisma.submissionPage.updateMany({
      where: { submissionId },
      data: { status: "PROCESSING", errorMessage: null },
    });
    revalidatePath(`/exams/${submission.examId}/submissions`);
    revalidatePath(`/exams/${submission.examId}/results`);

    const fileStartedAt = Date.now();
    const pageFiles =
      submission.pages.length > 0
        ? await Promise.all(
            submission.pages.map(async (page) => ({
              pageNumber: page.pageNumber,
              file: await readSubmissionPageFile(page),
            }))
          )
        : [];
    const imageFile =
      pageFiles.length === 0 ? await readSubmissionImageFile(submission.imageUrl) : null;
    const fileMs = msSince(fileStartedAt);
    const pageNumbers = pageFiles.map((page) => page.pageNumber);

    console.info("[submission-process] gemini start", {
      submissionId,
      pageCount: pageFiles.length || 1,
      loadedSubmissionPages: submission.pages.length,
      pageNumbers,
      answerKeyQuestionCount: gradeQuestions.length,
    });
    const geminiStartedAt = Date.now();
    const analysis =
      pageFiles.length > 0
        ? await analyzeStudentAnswerPages(
            pageFiles,
            questionNumbers,
            optionLabelsByQuestion
          )
        : await analyzeStudentAnswerSheet(
            imageFile as File,
            questionNumbers,
            optionLabelsByQuestion
          );
    const geminiMs = msSince(geminiStartedAt);
    console.info("[submission-process] gemini result", {
      submissionId,
      geminiMs,
      extractedAnswerCount: analysis.answers.length,
      firstExtractedQuestionNumbers: analysis.answers
        .slice(0, 8)
        .map((answer) => answer.questionNumber),
    });

    if (analysis.answers.length === 0) {
      throw new Error(analysis.notes || "AI did not return answers.");
    }

    const gradeStartedAt = Date.now();
    const grading = gradeSubmission({
      questions: gradeQuestions,
      correctAnswers: submission.exam.answerKeys,
      extractedAnswers: analysis.answers,
      questionCount: submission.exam.questionCount,
    });
    const statusDecision = decideProcessedSubmissionStatus({
      analysis,
      questionNumbers,
      optionLabelsByQuestion,
      answerKeyReady: isAnswerKeyReady(gradeQuestions, submission.exam.answerKeys),
    });
    const gradeMs = msSince(gradeStartedAt);
    console.info("[submission-process] grading result", {
      submissionId,
      score: grading.totalScore,
      maxScore: grading.maxScore,
    });

    const dbStartedAt = Date.now();
    await prisma.$transaction(
      async (tx) => {
        await tx.submissionAnswer.deleteMany({ where: { submissionId } });
        await tx.submissionAnswer.createMany({
          data: grading.rows.map((row) => ({
            submissionId,
            question: row.questionNumber,
            selected: row.selectedLabel,
            correct: row.correctLabel,
            isCorrect: row.isCorrect,
            earnedPoints: row.earnedPoints,
            maxPoints: row.maxPoints,
          })),
        });
        await tx.submission.update({
          where: { id: submissionId },
          data: {
            status: statusDecision.status,
            score: grading.totalScore,
            total: grading.maxScore,
            percentage: grading.percentage,
            pageCount: pageFiles.length || 1,
            gradingDetails: grading.rows,
          },
        });
        if (pageFiles.length > 0) {
          await tx.submissionPage.updateMany({
            where: { submissionId },
            data: { status: "PROCESSED", extractionJson: analysis },
          });
        }
      },
      { timeout: 30000 }
    );
    const dbMs = msSince(dbStartedAt);

    revalidatePath(`/exams/${submission.examId}/submissions`);
    revalidatePath(`/exams/${submission.examId}/submissions/${submissionId}/review`);
    revalidatePath(`/exams/${submission.examId}/results`);
    perfLog("submission-process", {
      loadMs,
      fileMs,
      geminiMs,
      gradeMs,
      dbMs,
      totalMs: msSince(totalStartedAt),
    });
    console.info(
      `[submission-process] completed submissionId=${submissionId} status=${statusDecision.status} reviewReason=${statusDecision.reviewReason || "none"}`
    );

    return { status: statusDecision.status };
  } catch (error) {
    console.error(
      `[submission-process] failed submissionId=${submissionId} error=${getErrorMessage(error)}`
    );

    if (examId) {
      await prisma.$transaction(async (tx) => {
        await tx.submission.update({
          where: { id: submissionId },
          data: { status: "FAILED" },
        });
        await tx.submissionPage.updateMany({
          where: { submissionId },
          data: { status: "FAILED", errorMessage: getErrorMessage(error) },
        });
      });
      revalidatePath(`/exams/${examId}/submissions`);
      revalidatePath(`/exams/${examId}/results`);
    }

    throw error;
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getOptionLabels(options: Array<{ label?: string | null }> | undefined) {
  const labels =
    options
      ?.map((option) => option.label)
      .filter((label): label is string => Boolean(label)) ?? [];

  return labels.length > 0 ? labels : defaultOptionLabels;
}
