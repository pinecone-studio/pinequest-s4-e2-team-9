import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { isAnswerKeyReady } from "@/lib/answer-key-readiness";
import { gradeSubmission, normalizeAnswerLabel } from "@/lib/grading";
import { msSince, perfLog } from "@/lib/perf";
import { prisma } from "@/lib/prisma";
import { readSubmissionImageFile } from "@/lib/submission-image-storage";
import { decideProcessedSubmissionStatus, submissionStatuses } from "@/lib/submission-state";
import { analyzeStudentAnswerSheet } from "@/lib/student-answer-vision";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  const totalStartedAt = Date.now();
  const { submissionId } = await params;
  const processRunId = randomUUID();
  let examId: string | null = null;
  let startedImageUrl: string | null = null;
  let startedUpdatedAt: Date | null = null;

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
        studentId: true,
        imageUrl: true,
        status: true,
        updatedAt: true,
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
    console.info(
      `[submission-process] start processRunId=${processRunId} submissionId=${submissionId} studentId=${submission.studentId} statusBefore=${submission.status} imagePath=${submission.imageUrl ?? "none"} clientSubmissionKey=${getClientSubmissionKey(submission.imageUrl)}`
    );

    if (submission.status !== "PROCESSING" && submission.status !== "FAILED") {
      perfLog("submission-process", {
        loadMs,
        skippedStatus: submission.status,
        totalMs: msSince(totalStartedAt),
      });

      return Response.json({ ok: true, status: submission.status });
    }

    const processStartedAt = new Date();
    const started = await prisma.submission.updateMany({
      where: {
        id: submissionId,
        imageUrl: submission.imageUrl,
        updatedAt: submission.updatedAt,
        status: { in: ["PROCESSING", "FAILED"] },
      },
      data: {
        status: "PROCESSING",
        updatedAt: processStartedAt,
      },
    });

    if (started.count === 0) {
      const current = await prisma.submission.findUnique({
        where: { id: submissionId },
        select: { status: true },
      });
      console.info(
        `[submission-process] skipped stale-start processRunId=${processRunId} submissionId=${submissionId} finalStatus=${current?.status ?? "missing"}`
      );

      return Response.json({
        ok: true,
        skipped: true,
        status: current?.status ?? "UNKNOWN",
      });
    }

    startedImageUrl = submission.imageUrl;
    startedUpdatedAt = processStartedAt;

    const questionNumbers = submission.exam.questions.map((question) => question.number);
    const optionLabelsByQuestion = Object.fromEntries(
      submission.exam.questions.map((question) => [
        question.number,
        question.options.map((option) => normalizeAnswerLabel(option.label) || option.label),
      ])
    );

    revalidatePath(`/exams/${submission.examId}/submissions`);
    revalidatePath(`/exams/${submission.examId}/results`);

    const fileStartedAt = Date.now();
    const imageFile = await readSubmissionImageFile(submission.imageUrl);
    const fileMs = msSince(fileStartedAt);
    console.info(
      `[submission-process] image processRunId=${processRunId} submissionId=${submissionId} imagePath=${submission.imageUrl ?? "none"} contentType=${imageFile.type || "unknown"} byteSize=${imageFile.size}`
    );

    let analysis: Awaited<ReturnType<typeof analyzeStudentAnswerSheet>> | null = null;
    let geminiMs = 0;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      console.info(
        `[submission-process] gemini attempt start processRunId=${processRunId} submissionId=${submissionId} attempt=${attempt}`
      );
      const geminiStartedAt = Date.now();
      analysis = await analyzeStudentAnswerSheet(
        imageFile,
        submission.exam.questions,
        submission.exam.answerKeys
      );
      const attemptMs = msSince(geminiStartedAt);
      geminiMs += attemptMs;
      console.info(
        `[submission-process] gemini attempt done processRunId=${processRunId} submissionId=${submissionId} attempt=${attempt} geminiMs=${attemptMs} extractedAnswerCount=${analysis.answers.length}`
      );

      if (analysis.answers.length > 0) {
        break;
      }
    }

    const finalAnalysis = analysis ?? {
      confidence: "low" as const,
      notes: "AI бүрэн уншиж чадсангүй. Багш гараар засна.",
      answers: [],
    };

    const gradeStartedAt = Date.now();
    const grading = gradeSubmission({
      questions: submission.exam.questions,
      correctAnswers: submission.exam.answerKeys,
      extractedAnswers: finalAnalysis.answers,
    });
    const statusDecision = decideProcessedSubmissionStatus({
      analysis: finalAnalysis,
      questionNumbers,
      optionLabelsByQuestion,
      answerKeyReady: isAnswerKeyReady(submission.exam.questions, submission.exam.answerKeys),
    });
    const finalStatus = grading.needsReview ? submissionStatuses.draft : statusDecision.status;
    const message =
      finalAnalysis.answers.length === 0
        ? "AI бүрэн уншиж чадсангүй. Багш гараар засна."
        : undefined;
    const gradeMs = msSince(gradeStartedAt);
    const guardImageUrl = startedImageUrl;
    const guardUpdatedAt = startedUpdatedAt;

    if (!guardUpdatedAt) {
      throw new Error("Process run guard was not initialized.");
    }

    const dbStartedAt = Date.now();
    const saved = await prisma.$transaction(
      async (tx) => {
        const current = await tx.submission.updateMany({
          where: {
            id: submissionId,
            imageUrl: guardImageUrl,
            updatedAt: guardUpdatedAt,
            status: "PROCESSING",
          },
          data: {
            status: finalStatus,
            score: grading.totalScore,
            total: grading.maxScore,
            percentage: grading.percentage,
          },
        });

        if (current.count === 0) {
          return false;
        }

        await tx.submissionAnswer.deleteMany({ where: { submissionId } });
        await tx.submissionAnswer.createMany({
          data: grading.rows.map((row) => ({
            submissionId,
            question: row.questionNumber,
            selected: row.selectedStoredAnswer,
            correct: row.correctLabel,
            isCorrect: row.isCorrect,
            earnedPoints: row.earnedPoints,
            maxPoints: row.maxPoints,
          })),
        });

        return true;
      },
      { timeout: 30000 }
    );
    const dbMs = msSince(dbStartedAt);

    if (!saved) {
      const current = await prisma.submission.findUnique({
        where: { id: submissionId },
        select: { status: true },
      });
      console.info(
        `[submission-process] skipped stale-save processRunId=${processRunId} submissionId=${submissionId} finalStatus=${current?.status ?? "missing"}`
      );

      return Response.json({
        ok: true,
        skipped: true,
        status: current?.status ?? "UNKNOWN",
      });
    }

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
      `[submission-process] completed processRunId=${processRunId} submissionId=${submissionId} extractedAnswerCount=${finalAnalysis.answers.length} finalStatus=${finalStatus} reviewReason=${statusDecision.reviewReason || (grading.needsReview ? "grading_needs_review" : "none")}`
    );

    return Response.json({ ok: true, status: finalStatus, message });
  } catch (error) {
    console.error(
      `[submission-process] failed processRunId=${processRunId} submissionId=${submissionId} error=${getErrorMessage(error)}`
    );

    if (examId && startedUpdatedAt) {
      const guardImageUrl = startedImageUrl;
      const guardUpdatedAt = startedUpdatedAt;
      const failed = await prisma.submission.updateMany({
        where: {
          id: submissionId,
          imageUrl: guardImageUrl,
          updatedAt: guardUpdatedAt,
          status: "PROCESSING",
        },
        data: { status: "FAILED" },
      });
      console.info(
        `[submission-process] failure status update processRunId=${processRunId} submissionId=${submissionId} updated=${failed.count}`
      );
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

function getClientSubmissionKey(imageUrl: string | null) {
  if (!imageUrl) {
    return "none";
  }

  try {
    const pathname = /^https?:\/\//i.test(imageUrl) ? new URL(imageUrl).pathname : imageUrl;
    const fileName = decodeURIComponent(pathname.split("/").pop() || "");

    return fileName.replace(/\.[^.]+$/, "") || "unknown";
  } catch {
    return "unknown";
  }
}

function jsonError(error: string, status: number) {
  return Response.json({ ok: false, error }, { status });
}
