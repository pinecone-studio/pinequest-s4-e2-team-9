import { revalidatePath } from "next/cache";
import { Prisma } from "@/lib/generated/prisma/client";
import { isAnswerKeyReady } from "@/lib/answer-key-readiness";
import { expandQuestionsToCount } from "@/lib/grading";
import { msSince, perfLog } from "@/lib/perf";
import { prisma } from "@/lib/prisma";
import { saveSubmissionPageFile } from "@/lib/submission-image-storage";
import { deleteSubmissionStorageObjects } from "@/lib/upload-storage";

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
    const files = getFiles(formData);
    const formMs = msSince(formStartedAt);

    if (!token || !studentId) {
      return jsonError("Илгээсэн мэдээлэл дутуу байна.", 400);
    }

    if (files.length === 0) {
      return jsonError("Хариултын хуудасны зураг илгээнэ үү.", 400);
    }

    if (files.some((file) => !imageTypes.has(file.type))) {
      return jsonError("Зөвхөн PNG, JPG, JPEG, WEBP зураг илгээнэ.", 400);
    }

    const examStartedAt = Date.now();
    const exam = await prisma.exam.findFirst({
      where: { id: examId, captureToken: token },
      select: {
        id: true,
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

    const questions = expandQuestionsToCount(
      exam.questions,
      exam.questionCount,
      exam.answerKeys
    );

    if (!isAnswerKeyReady(questions, exam.answerKeys)) {
      return jsonError("Зөв хариулт бүрэн баталгаажаагүй байна.", 400);
    }

    console.info(
      `[capture-enqueue] start examId=${examId} studentId=${studentId} pageCount=${files.length}`
    );
    const dbStartedAt = Date.now();
    let oldStoragePaths: string[] = [];
    const submission = await prisma.$transaction(
      async (tx) => {
        const existingSubmission = await tx.submission.findFirst({
          where: { examId, studentId },
          select: {
            id: true,
            pages: { select: { storagePath: true } },
          },
        });

        if (existingSubmission) {
          oldStoragePaths = existingSubmission.pages.map((page) => page.storagePath);
          await tx.submissionAnswer.deleteMany({
            where: { submissionId: existingSubmission.id },
          });
          await tx.submissionPage.deleteMany({
            where: { submissionId: existingSubmission.id },
          });

          return tx.submission.update({
            where: { id: existingSubmission.id },
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
        }

        return tx.submission.create({
          data: {
            examId,
            studentId,
            imageUrl: null,
            status: "PROCESSING",
            pageCount: files.length,
          },
        });
      },
      { timeout: 30000 }
    );
    const dbMs = msSince(dbStartedAt);
    const imageStartedAt = Date.now();
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
          fileName: file.name || null,
          mimeType: file.type || null,
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
    const imageMs = msSince(imageStartedAt);

    revalidatePath(`/exams/${examId}/submissions`);
    revalidatePath(`/exams/${examId}/results`);
    const processResponse = await fetch(
      new URL(`/api/submissions/${submission.id}/process`, request.url),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }
    );
    const processData = (await processResponse.json().catch(() => null)) as {
      ok?: boolean;
      status?: string;
      error?: string;
    } | null;

    if (!processResponse.ok || processData?.ok === false) {
      return jsonError(processData?.error || "AI боловсруулалт амжилтгүй боллоо.", 500);
    }

    perfLog("capture-enqueue", {
      formMs,
      examMs,
      imageMs,
      dbMs,
      pages: files.length,
      totalMs: msSince(totalStartedAt),
    });
    console.info(
      `[capture-enqueue] success submissionId=${submission.id} pageCount=${files.length}`
    );

    return Response.json({
      ok: true,
      submissionId: submission.id,
      status: processData?.status ?? submission.status,
      pageCount: files.length,
    });
  } catch (error) {
    console.error("[capture-enqueue] failed", error);

    return jsonError("Зураг дараалалд оруулахад алдаа гарлаа.", 500);
  }
}

function getFiles(formData: FormData) {
  const preferred = formData
    .getAll("files")
    .filter((value): value is File => typeof File !== "undefined" && value instanceof File && value.size > 0);
  const fallback = ["file", "image"]
    .flatMap((name) => formData.getAll(name))
    .filter((value): value is File => typeof File !== "undefined" && value instanceof File && value.size > 0);

  return preferred.length > 0 ? preferred : fallback;
}

function jsonError(error: string, status: number) {
  return Response.json({ ok: false, error }, { status });
}
