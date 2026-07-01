import { prisma } from "@/lib/prisma";
import { labelsMatch } from "@/lib/grading";
import { msSince, perfLog } from "@/lib/perf";
import { requireCurrentUser } from "@/lib/supabase/server";

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
      subject: true,
      classroom: { select: { name: true } },
      answerKeys: { orderBy: { question: "asc" } },
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
      submissions: {
        orderBy: { updatedAt: "desc" },
        select: {
          status: true,
          score: true,
          total: true,
          percentage: true,
          createdAt: true,
          updatedAt: true,
          student: { select: { name: true } },
          answers: {
            orderBy: { question: "asc" },
            select: { question: true, selected: true, correct: true },
          },
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
  perfLog("results-export", {
    authMs,
    exportMs,
    submissions: exam.submissions.length,
    questions: exam.questions.length,
    totalMs: msSince(totalStartedAt),
  });

  const totalPoints = exam.questions.reduce(
    (sum, question) => sum + safeNumber(question.points),
    0
  );
  const fallbackAnswers = new Map(
    exam.answerKeys.map((answer) => [answer.question, answer.answer])
  );
  const headers = [
    "Шалгалт",
    "Хичээл",
    "Анги",
    "Сурагч",
    "Оноо",
    "Нийт оноо",
    "Хувь",
    "Төлөв",
    "Огноо",
    ...exam.questions.map((question) => `Асуулт ${question.number}`),
  ];
  const rows = exam.submissions.map((submission) => [
    exam.title,
    exam.subject,
    exam.classroom.name,
    submission.student.name,
    formatNumber(safeNumber(submission.score)),
    formatNumber(getSubmissionTotal(submission, totalPoints)),
    `${Math.round(getSubmissionPercentage(submission, totalPoints))}%`,
    getStatusText(submission.status),
    (submission.updatedAt || submission.createdAt).toLocaleDateString("mn-MN"),
    ...exam.questions.map((question) => {
      const answer = submission.answers.find(
        (item) => item.question === question.number
      );
      const selected = answer?.selected || "-";
      const correct =
        answer?.correct ||
        question.options.find((option) => option.isCorrect)?.label ||
        fallbackAnswers.get(question.number) ||
        "-";

      return `${selected} / ${correct} / ${getAnswerText(selected, correct)}`;
    }),
  ]);
  const csv = toCsv([headers, ...rows]);

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="exam-results-${exam.id}.csv"`,
    },
  });
}

function getAnswerText(selected: string, correct: string) {
  if (selected === "-") {
    return "Хоосон";
  }

  return labelsMatch(selected, correct) ? "Зөв" : "Буруу";
}

function toCsv(rows: string[][]) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? "");

          return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(",")
    )
    .join("\r\n");
}

function getStatusText(status: string | null | undefined) {
  if (status === "PROCESSING") {
    return "Боловсруулж байна...";
  }

  if (status === "FAILED") {
    return "Алдаа гарсан";
  }

  if (status === "DRAFT") {
    return "Хянах шаардлагатай";
  }

  if (status === "SAVED") {
    return "Хадгалсан";
  }

  return status || "Тодорхойгүй";
}

function getSubmissionTotal(submission: { total: number }, fallbackTotal: number) {
  const total = safeNumber(submission.total);

  return total > 0 ? total : fallbackTotal;
}

function getSubmissionPercentage(
  submission: { percentage: number; score: number; total: number },
  fallbackTotal: number
) {
  const percentage = safeNumber(submission.percentage);
  const total = getSubmissionTotal(submission, fallbackTotal);

  return percentage || (total > 0 ? (safeNumber(submission.score) / total) * 100 : 0);
}

function safeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
