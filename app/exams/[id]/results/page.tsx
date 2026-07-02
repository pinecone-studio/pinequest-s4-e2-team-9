import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, Download, Inbox, ListChecks, UploadCloud } from "lucide-react";
import SubmissionsRealtimeRefresh from "@/components/exams/submissions-realtime-refresh";
import PageHeader from "@/components/layout/page-header";
import { expandQuestionsToCount } from "@/lib/grading";
import { msSince, perfLog, perfNow } from "@/lib/perf";
import { prisma } from "@/lib/prisma";
import {
  buildAnswerKeySignatureSeed,
  getSubmissionStatusText,
  submissionStatuses,
  summarizeSubmissions,
} from "@/lib/submission-state";
import { requireCurrentUser } from "@/lib/supabase/server";

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const totalStartedAt = perfNow();
  await connection();

  const { id } = await params;
  const authStartedAt = perfNow();
  const user = await requireCurrentUser();
  const authMs = msSince(authStartedAt);
  const resultsStartedAt = perfNow();
  const exam = await prisma.exam.findFirst({
    where: { id, ownerUserId: user.id },
    select: {
      id: true,
      title: true,
      subject: true,
      questionCount: true,
      classroom: {
        select: { name: true, _count: { select: { students: true } } },
      },
      answerKeys: {
        orderBy: { question: "asc" },
        select: { question: true, answer: true },
      },
      questions: { orderBy: { number: "asc" }, select: { id: true, number: true, points: true } },
      submissions: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          status: true,
          score: true,
          total: true,
          percentage: true,
          pageCount: true,
          createdAt: true,
          updatedAt: true,
          student: { select: { name: true } },
          answers: {
            orderBy: { question: "asc" },
            select: { question: true, selected: true, isCorrect: true },
          },
        },
      },
    },
  });
  const resultsMs = msSince(resultsStartedAt);

  if (!exam) {
    perfLog("results-page", {
      authMs,
      resultsMs,
      totalMs: msSince(totalStartedAt),
    });
    notFound();
  }
  perfLog("results-page", {
    authMs,
    resultsMs,
    submissions: exam.submissions.length,
    questions: exam.questions.length,
    totalMs: msSince(totalStartedAt),
  });

  const questions = expandQuestionsToCount(
    exam.questions,
    exam.questionCount,
    exam.answerKeys
  );
  const questionCount = questions.length;
  const totalPoints = questions.reduce(
    (sum, question) => sum + safeNumber(question.points),
    0
  );
  const signatureSeed = buildAnswerKeySignatureSeed({
    questions,
    answerKeys: exam.answerKeys,
  });
  const submissionSummary = summarizeSubmissions(exam.submissions, signatureSeed);
  const savedSubmissions = exam.submissions.filter(
    (submission) => submission.status === submissionStatuses.saved
  );
  const scoredSubmissions = savedSubmissions.map((submission) => ({
    score: safeNumber(submission.score),
    total: getSubmissionTotal(submission, totalPoints),
    percentage: getSubmissionPercentage(submission, totalPoints),
  }));
  const displayTotal =
    totalPoints ||
    scoredSubmissions.reduce((max, submission) => Math.max(max, submission.total), 0);
  const averageScore =
    scoredSubmissions.length === 0
      ? null
      : scoredSubmissions.reduce((sum, submission) => sum + submission.score, 0) /
        scoredSubmissions.length;
  const averagePercentage =
    scoredSubmissions.length === 0
      ? null
      : scoredSubmissions.reduce((sum, submission) => sum + submission.percentage, 0) /
        scoredSubmissions.length;
  const highest = scoredSubmissions.reduce<
    { score: number; total: number; percentage: number } | null
  >(
    (best, submission) =>
      !best || submission.score > best.score ? submission : best,
    null
  );
  const lowest = scoredSubmissions.reduce<
    { score: number; total: number; percentage: number } | null
  >(
    (best, submission) =>
      !best || submission.score < best.score ? submission : best,
    null
  );

  const summaryCards = [
    { label: "Сурагчийн тоо", value: String(exam.classroom._count.students) },
    { label: "Дүн орсон", value: String(savedSubmissions.length) },
    {
      label: "Дундаж оноо",
      value:
        averageScore === null
          ? "-"
          : `${formatNumber(averageScore)} / ${formatNumber(displayTotal)}`,
    },
    {
      label: "Дундаж хувь",
      value: averagePercentage === null ? "-" : `${Math.round(averagePercentage)}%`,
    },
    {
      label: "Хамгийн өндөр",
      value: highest ? `${formatNumber(highest.score)} / ${formatNumber(highest.total)}` : "-",
    },
    {
      label: "Хамгийн бага",
      value: lowest ? `${formatNumber(lowest.score)} / ${formatNumber(lowest.total)}` : "-",
    },
  ];

  return (
    <div className="min-h-screen bg-stone-50/30 p-8">
      <SubmissionsRealtimeRefresh
        examId={exam.id}
        initialSignature={submissionSummary.signature}
        hasActiveSubmissions={submissionSummary.active > 0}
      />
      <div className="mx-auto max-w-7xl">
        <PageHeader
          eyebrow={exam.title}
          title="Шалгалтын үр дүн"
          description="Сурагчдын оноо, дундаж үзүүлэлт, даалгаврын гүйцэтгэлийг харах."
          actions={
            <>
              <Link
                href={`/exams/${exam.id}/submissions`}
                className="inline-flex items-center gap-2 rounded-lg bg-[#8B5E3C] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#734d31]"
              >
                <UploadCloud className="size-4" aria-hidden="true" />
                Хариултын хуудас оруулах
              </Link>
              <a
                href={`/exams/${exam.id}/results/export`}
                className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
              >
                <Download className="size-4" aria-hidden="true" />
                Excel татах
              </a>
              <Link
                href={`/exams/${exam.id}/answer-key`}
                className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
              >
                <ListChecks className="size-4" aria-hidden="true" />
                Зөв хариулт засах
              </Link>
            </>
          }
        >
          <Link
            href="/dashboard"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-[#8B5E3C]"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Самбар руу буцах
          </Link>
          <dl className="mt-4 grid gap-3 text-sm text-stone-600 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <dt className="font-medium text-stone-500">Хичээл</dt>
              <dd className="mt-1 font-semibold text-stone-900">{exam.subject}</dd>
            </div>
            <div>
              <dt className="font-medium text-stone-500">Анги</dt>
              <dd className="mt-1 font-semibold text-stone-900">{exam.classroom.name}</dd>
            </div>
            <div>
              <dt className="font-medium text-stone-500">Асуултын тоо</dt>
              <dd className="mt-1 font-semibold text-stone-900">{questionCount}</dd>
            </div>
            <div>
              <dt className="font-medium text-stone-500">Нийт оноо</dt>
              <dd className="mt-1 font-semibold text-stone-900">
                {formatNumber(totalPoints)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-stone-500">Оруулсан хариулт</dt>
              <dd className="mt-1 font-semibold text-stone-900">
                {savedSubmissions.length}
              </dd>
            </div>
          </dl>
        </PageHeader>

        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm"
            >
              <p className="text-sm font-medium text-stone-500">{card.label}</p>
              <p className="mt-2 text-2xl font-bold text-stone-900">{card.value}</p>
            </div>
          ))}
        </section>

        <section className="mb-8 rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-stone-900">Сурагчдын дүн</h2>
          </div>

          {exam.submissions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50/60 p-8 text-center">
              <Inbox className="mx-auto mb-3 size-8 text-[#8B5E3C]" aria-hidden="true" />
              <h3 className="text-base font-bold text-stone-900">
                Одоогоор дүн хадгалагдаагүй байна
              </h3>
              <p className="mt-1 text-sm text-stone-500">
                Сурагчийн хариултын хуудсыг оруулж, хянаж хадгалсны дараа үр дүн энд харагдана.
              </p>
              <Link
                href={`/exams/${exam.id}/submissions`}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#8B5E3C] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#734d31]"
              >
                <UploadCloud className="size-4" aria-hidden="true" />
                Хариултын хуудас оруулах
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-stone-200">
              <table className="min-w-full divide-y divide-stone-200 text-left text-sm text-stone-600">
                <thead className="bg-stone-50 text-xs font-bold uppercase tracking-wider text-stone-700">
                  <tr>
                    <th className="px-4 py-3">Сурагч</th>
                    <th className="px-4 py-3">Оноо</th>
                    <th className="px-4 py-3">Хуудас</th>
                    <th className="px-4 py-3">Хувь</th>
                    <th className="px-4 py-3">Төлөв</th>
                    <th className="px-4 py-3">Огноо</th>
                    <th className="px-4 py-3 text-right">Үйлдэл</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {exam.submissions.map((submission) => {
                    const total = getSubmissionTotal(submission, totalPoints);
                    const percentage = getSubmissionPercentage(submission, totalPoints);

                    return (
                      <tr key={submission.id} className="hover:bg-stone-50/60">
                        <td className="px-4 py-3 font-semibold text-stone-900">
                          {submission.student.name}
                        </td>
                        <td className="px-4 py-3">
                          {formatNumber(safeNumber(submission.score))} / {formatNumber(total)}
                        </td>
                        <td className="px-4 py-3">{formatPageCount(submission.pageCount)}</td>
                        <td className="px-4 py-3">{Math.round(percentage)}%</td>
                        <td className="px-4 py-3">
                          <span className={getStatusClass(submission.status)}>
                            {getSubmissionStatusText(submission.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {(submission.updatedAt || submission.createdAt).toLocaleDateString("mn-MN")}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/exams/${exam.id}/submissions/${submission.id}/review`}
                            className="text-sm font-medium text-[#8B5E3C] hover:text-[#734d31]"
                          >
                            Харах
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-stone-900">Даалгаврын гүйцэтгэл</h2>

          {questions.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-stone-200 bg-stone-50/60 p-8 text-center">
              <Inbox className="mx-auto mb-3 size-8 text-[#8B5E3C]" aria-hidden="true" />
              <p className="text-sm text-stone-500">Асуулт бүртгэгдээгүй байна.</p>
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto rounded-lg border border-stone-200">
              <table className="min-w-full divide-y divide-stone-200 text-left text-sm text-stone-600">
                <thead className="bg-stone-50 text-xs font-bold uppercase tracking-wider text-stone-700">
                  <tr>
                    <th className="px-4 py-3">Асуулт</th>
                    <th className="px-4 py-3">Зөв</th>
                    <th className="px-4 py-3">Буруу</th>
                    <th className="px-4 py-3">Хоосон</th>
                    <th className="px-4 py-3">Амжилт</th>
                    <th className="px-4 py-3">Оноо</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {questions.map((question) => {
                    const answers = savedSubmissions.map((submission) =>
                      submission.answers.find((answer) => answer.question === question.number)
                    );
                    const correct = answers.filter((answer) => answer?.isCorrect).length;
                    const empty = answers.filter((answer) => !answer?.selected).length;
                    const wrong = Math.max(0, savedSubmissions.length - correct - empty);
                    const successRate =
                      savedSubmissions.length === 0
                        ? 0
                        : Math.round((correct / savedSubmissions.length) * 100);

                    return (
                      <tr key={question.number} className="hover:bg-stone-50/60">
                        <td className="px-4 py-3 font-semibold text-stone-900">
                          {question.number}-р асуулт
                        </td>
                        <td className="px-4 py-3">{correct}</td>
                        <td className="px-4 py-3">{wrong}</td>
                        <td className="px-4 py-3">{empty}</td>
                        <td className="px-4 py-3">{successRate}%</td>
                        <td className="px-4 py-3">{formatNumber(safeNumber(question.points))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function getStatusClass(status: string | null | undefined) {
  if (status === submissionStatuses.saved) {
    return "inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800";
  }

  if (status === submissionStatuses.processing) {
    return "inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800";
  }

  if (status === submissionStatuses.failed) {
    return "inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800";
  }

  if (status === submissionStatuses.draft) {
    return "inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800";
  }

  return "inline-flex rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-700";
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

function formatPageCount(value: number) {
  return `${value || 1} хуудас`;
}
