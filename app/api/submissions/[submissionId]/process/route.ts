import { revalidatePath } from "next/cache";
import { isAnswerKeyReady } from "@/lib/answer-key-readiness";
import { gradeSubmission } from "@/lib/grading";
import { msSince, perfLog } from "@/lib/perf";
import { prisma } from "@/lib/prisma";
import { readSubmissionImageFile } from "@/lib/submission-image-storage";
import { decideProcessedSubmissionStatus } from "@/lib/submission-state";
import { analyzeStudentAnswerSheet } from "@/lib/student-answer-vision";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  const totalStartedAt = Date.now();
  const { submissionId } = await params;
  let examId: string | null = null;

  try {
    const token = await getToken(request);

    if (!token) {
      return jsonError("Зураг авах token дутуу байна.", 401);
    }

    const loadStartedAt = Date.now();
    const submission = await prisma.submission.findFirst({
      where: { id: submissionId, exam: { captureToken: token } },
      select: {
        id: true,
        examId: true,
        imageUrl: true,
        status: true,
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
      return jsonError("Илгээсэн хариулт олдсонгүй.", 404);
    }

    examId = submission.examId;

    if (submission.status !== "PROCESSING" && submission.status !== "FAILED") {
      perfLog("submission-process", {
        loadMs,
        skippedStatus: submission.status,
        totalMs: msSince(totalStartedAt),
      });

      return Response.json({ ok: true, status: submission.status });
    }

    const questionNumbers = submission.exam.questions.map((question) => question.number);
    const optionLabelsByQuestion = Object.fromEntries(
      submission.exam.questions.map((question) => [
        question.number,
        question.options.map((option) => option.label),
      ])
    );

    await prisma.submission.update({
      where: { id: submissionId },
      data: { status: "PROCESSING" },
    });
    revalidatePath(`/exams/${submission.examId}/submissions`);
    revalidatePath(`/exams/${submission.examId}/results`);

    const fileStartedAt = Date.now();
    const imageFile = await readSubmissionImageFile(submission.imageUrl);
    const fileMs = msSince(fileStartedAt);

    console.info(`[submission-process] gemini start submissionId=${submissionId}`);
    const geminiStartedAt = Date.now();
    const analysis = await analyzeStudentAnswerSheet(
      imageFile,
      questionNumbers,
      optionLabelsByQuestion
    );
    const geminiMs = msSince(geminiStartedAt);
    console.info(`[submission-process] geminiMs=${geminiMs} submissionId=${submissionId}`);

    if (analysis.answers.length === 0) {
      throw new Error(analysis.notes || "AI did not return answers.");
    }

    const gradeStartedAt = Date.now();
    const grading = gradeSubmission({
      questions: submission.exam.questions,
      correctAnswers: submission.exam.answerKeys,
      extractedAnswers: analysis.answers,
    });
    const statusDecision = decideProcessedSubmissionStatus({
      analysis,
      questionNumbers,
      optionLabelsByQuestion,
      answerKeyReady: isAnswerKeyReady(submission.exam.questions, submission.exam.answerKeys),
    });
    const gradeMs = msSince(gradeStartedAt);

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
          },
        });
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

    return Response.json({ ok: true, status: statusDecision.status });
  } catch (error) {
    console.error(
      `[submission-process] failed submissionId=${submissionId} error=${getErrorMessage(error)}`
    );

    if (examId) {
      await prisma.submission.update({
        where: { id: submissionId },
        data: { status: "FAILED" },
      });
      revalidatePath(`/exams/${examId}/submissions`);
      revalidatePath(`/exams/${examId}/results`);
    }

    return jsonError("AI боловсруулалт амжилтгүй боллоо.", 500);
  }
}

async function getToken(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as unknown;

    return isRecord(body) && typeof body.token === "string" ? body.token.trim() : "";
  }

  const formData = await request.formData().catch(() => null);

  return String(formData?.get("token") || "").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function jsonError(error: string, status: number) {
  return Response.json({ ok: false, error }, { status });
}
