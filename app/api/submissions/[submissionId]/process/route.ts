import { revalidatePath } from "next/cache";
import { gradeSubmission } from "@/lib/grading";
import { prisma } from "@/lib/prisma";
import { readSubmissionImageFile } from "@/lib/submission-image-storage";
import { analyzeStudentAnswerSheet } from "@/lib/student-answer-vision";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  const { submissionId } = await params;
  let examId: string | null = null;

  try {
    const token = await getToken(request);

    if (!token) {
      return jsonError("Зураг авах token дутуу байна.", 401);
    }

    const submission = await prisma.submission.findFirst({
      where: { id: submissionId, exam: { captureToken: token } },
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

    if (!submission) {
      return jsonError("Илгээсэн хариулт олдсонгүй.", 404);
    }

    examId = submission.examId;

    if (submission.status !== "PROCESSING" && submission.status !== "FAILED") {
      return Response.json({ ok: true, status: submission.status });
    }

    const questionNumbers = submission.exam.questions.map((question) => question.number);
    const optionLabelsByQuestion = Object.fromEntries(
      submission.exam.questions.map((question) => [
        question.number,
        question.options.map((option) => option.label),
      ])
    );
    const imageFile = await readSubmissionImageFile(submission.imageUrl);

    console.info(`[submission-process] gemini start submissionId=${submissionId}`);
    const geminiStartedAt = Date.now();
    const analysis = await analyzeStudentAnswerSheet(
      imageFile,
      questionNumbers,
      optionLabelsByQuestion
    );
    console.info(
      `[submission-process] geminiMs=${Date.now() - geminiStartedAt} submissionId=${submissionId}`
    );

    if (analysis.answers.length === 0) {
      throw new Error(analysis.notes || "AI did not return answers.");
    }

    const grading = gradeSubmission({
      questions: submission.exam.questions,
      correctAnswers: submission.exam.answerKeys,
      extractedAnswers: analysis.answers,
    });

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
            status: "DRAFT",
            score: grading.totalScore,
            total: grading.maxScore,
            percentage: grading.percentage,
          },
        });
      },
      { timeout: 30000 }
    );

    revalidatePath(`/exams/${submission.examId}/submissions`);
    revalidatePath(`/exams/${submission.examId}/submissions/${submissionId}/review`);
    console.info(`[submission-process] completed submissionId=${submissionId}`);

    return Response.json({ ok: true, status: "DRAFT" });
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
