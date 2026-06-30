import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { saveSubmissionImageFile } from "@/lib/submission-image-storage";

export const runtime = "nodejs";

const imageTypes = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: examId } = await params;

  try {
    const formData = await request.formData();
    const token = String(formData.get("token") || "").trim();
    const studentId = String(formData.get("studentId") || "").trim();
    const clientSubmissionKey = String(formData.get("clientSubmissionKey") || "").trim();
    const image = getFile(formData.get("image"));

    if (!token || !studentId || !clientSubmissionKey || !image) {
      return jsonError("Илгээсэн мэдээлэл дутуу байна.", 400);
    }

    if (!imageTypes.has(image.type)) {
      return jsonError("Зөвхөн PNG, JPG, JPEG, WEBP зураг илгээнэ.", 400);
    }

    const exam = await prisma.exam.findFirst({
      where: { id: examId, captureToken: token },
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
    const imageUrl = await saveSubmissionImageFile({
      file: image,
      examId,
      clientSubmissionKey,
    });
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

    revalidatePath(`/exams/${examId}/submissions`);
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

function isAnswerKeyReady(
  questions: Array<{ number: number; options: Array<{ isCorrect: boolean }> }>,
  answerKeys: Array<{ question: number; answer: string | null }>
) {
  return (
    questions.length > 0 &&
    questions.every(
      (question) =>
        question.options.some((option) => option.isCorrect) ||
        answerKeys.some((answer) => answer.question === question.number && answer.answer)
    )
  );
}

function jsonError(error: string, status: number) {
  return Response.json({ ok: false, error }, { status });
}
