import { buildBagshSystemWorkbook } from "@/lib/bagshsystem-export";
import { msSince, perfLog } from "@/lib/perf";
import { prisma } from "@/lib/prisma";
import { submissionStatuses } from "@/lib/submission-state";
import { requireCurrentUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

type SavedSubmission = {
  studentId: string;
  score: number;
  total: number;
  percentage: number;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const totalStartedAt = Date.now();
  const { id } = await params;
  const authStartedAt = Date.now();
  const user = await requireCurrentUser();
  const authMs = msSince(authStartedAt);
  const exportStartedAt = Date.now();
  const exam = await prisma.exam.findFirst({
    where: { id, ownerUserId: user.id },
    select: {
      id: true,
      title: true,
      classroom: {
        select: {
          students: {
            orderBy: { createdAt: "asc" },
            select: { id: true, name: true, registerNumber: true },
          },
        },
      },
      questions: {
        orderBy: { number: "asc" },
        select: { points: true },
      },
      submissions: {
        where: { status: submissionStatuses.saved },
        orderBy: { updatedAt: "desc" },
        select: {
          studentId: true,
          score: true,
          total: true,
          percentage: true,
        },
      },
    },
  });
  const exportMs = msSince(exportStartedAt);

  if (!exam) {
    perfLog("results-export", {
      authMs,
      exportMs,
      totalMs: msSince(totalStartedAt),
    });

    return new Response("Шалгалт олдсонгүй.", { status: 404 });
  }

  if (exam.submissions.length === 0) {
    return new Response("Хадгалсан дүн байхгүй байна.", { status: 400 });
  }

  const totalPoints = exam.questions.reduce(
    (sum, question) => sum + safeNumber(question.points),
    0
  );
  const submissionsByStudentId = new Map<string, SavedSubmission>();

  for (const submission of exam.submissions) {
    if (!submissionsByStudentId.has(submission.studentId)) {
      submissionsByStudentId.set(submission.studentId, submission);
    }
  }

  const workbook = buildBagshSystemWorkbook(
    exam.classroom.students.map((student) => {
      const submission = submissionsByStudentId.get(student.id);

      return {
        studentName: student.name,
        registerNumber: student.registerNumber,
        attended: Boolean(submission),
        score: submission?.score,
        maxScore: submission ? getSubmissionTotal(submission, totalPoints) : null,
        percent: submission?.percentage,
      };
    })
  );
  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `bagshsystem-ready-${safeFileName(exam.title)}.xlsx`;

  perfLog("results-export", {
    authMs,
    exportMs,
    submissions: exam.submissions.length,
    totalMs: msSince(totalStartedAt),
  });

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}

function getSubmissionTotal(submission: { total: number }, fallbackTotal: number) {
  const total = safeNumber(submission.total);

  return total > 0 ? total : fallbackTotal;
}

function safeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function safeFileName(value: string) {
  return (
    value
      .normalize("NFKC")
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "exam"
  );
}
