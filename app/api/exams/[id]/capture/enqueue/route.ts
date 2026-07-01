import { revalidatePath } from "next/cache";
import { isAnswerKeyReady } from "@/lib/answer-key-readiness";
import { msSince, perfLog } from "@/lib/perf";
import { prisma } from "@/lib/prisma";
import { saveSubmissionImageFile } from "@/lib/submission-image-storage";

export const runtime = "nodejs";

const imageTypes = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const totalStartedAt = Date.now();
  const { id: examId } = await params;

  try {
    const formStartedAt = Date.now();
    const formData = await request.formData();
    const token = String(formData.get("token") || "").trim();
    const studentId = String(formData.get("studentId") || "").trim();
    const clientSubmissionKey = String(formData.get("clientSubmissionKey") || "").trim();
    const image = getFile(formData.get("image"));
    const formMs = msSince(formStartedAt);

    if (!token || !studentId || !clientSubmissionKey || !image) {
      return jsonError("Илгээсэн мэдээлэл дутуу байна.", 400);
    }

    if (!imageTypes.has(image.type)) {
      return jsonError("Зөвхөн PNG, JPG, JPEG, WEBP зураг илгээнэ.", 400);
    }

    const examStartedAt = Date.now();
    const exam = await prisma.exam.findFirst({
      where: { id: examId, captureToken: token },
      select: {
        id: true,
        classroom: { select: { students: { select: { id: true } } } },
        answerKeys: { orderBy: { question: "asc" } },
        questions: {
          orderBy: { number: "asc" },
          select: {
            number: true,
            options: { select: { isCorrect: true } },
          },
        },
      },
    });
    const examMs = msSince(examStartedAt);

    if (!exam) {
      return jsonError("Зураг авах холбоос хүчингүй байна.", 404);
    }

    if (!exam.classroom.students.some((student) => student.id === studentId)) {
      return jsonError("Сурагч энэ ангид бүртгэлгүй байна.", 400);
    }

    if (!isAnswerKeyReady(exam.questions, exam.answerKeys)) {
      return jsonError("Зөв хариулт бүрэн баталгаажаагүй байна.", 400);
    }

    console.info(
      `[capture-enqueue] start examId=${examId} studentId=${studentId} clientSubmissionKey=${clientSubmissionKey} imageBytes=${image.size}`
    );
    const imageStartedAt = Date.now();
    const imageUrl = await saveSubmissionImageFile({
      file: image,
      examId,
      clientSubmissionKey,
    });
    const imageMs = msSince(imageStartedAt);
    const dbStartedAt = Date.now();
    const submission = await prisma.$transaction(
      async (tx) => {
        const existingSubmission = await tx.submission.findFirst({
          where: { examId, studentId },
          select: { id: true },
        });

        if (existingSubmission) {
          await tx.submissionAnswer.deleteMany({
            where: { submissionId: existingSubmission.id },
          });

          return tx.submission.update({
            where: { id: existingSubmission.id },
            data: {
              imageUrl,
              status: "PROCESSING",
              score: 0,
              total: 0,
              percentage: 0,
            },
          });
        }

        return tx.submission.create({
          data: {
            examId,
            studentId,
            imageUrl,
            status: "PROCESSING",
          },
        });
      },
      { timeout: 30000 }
    );
    const dbMs = msSince(dbStartedAt);

    revalidatePath(`/exams/${examId}/submissions`);
    perfLog("capture-enqueue", {
      formMs,
      examMs,
      imageMs,
      dbMs,
      totalMs: msSince(totalStartedAt),
    });
    console.info(
      `[capture-enqueue] success submissionId=${submission.id} clientSubmissionKey=${clientSubmissionKey}`
    );

    return Response.json({
      ok: true,
      submissionId: submission.id,
      status: submission.status,
    });
  } catch (error) {
    console.error("[capture-enqueue] failed", error);

    return jsonError("Зураг дараалалд оруулахад алдаа гарлаа.", 500);
  }
}

function getFile(value: FormDataEntryValue | null) {
  return typeof File !== "undefined" && value instanceof File && value.size > 0
    ? value
    : null;
}

function jsonError(error: string, status: number) {
  return Response.json({ ok: false, error }, { status });
}
