import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import QRCode from "react-qr-code";
import { AlertCircle, ArrowLeft, BarChart3, Inbox, ListChecks, Smartphone } from "lucide-react";
import SubmissionsRealtimeRefresh from "@/components/exams/submissions-realtime-refresh";
import SubmissionUploadForm from "@/components/exams/submission-upload-form";
import PageHeader from "@/components/layout/page-header";
import { generateCaptureToken } from "@/lib/capture-token";
import { msSince, perfLog, perfNow } from "@/lib/perf";
import { prisma } from "@/lib/prisma";
import {
  buildAnswerKeySignatureSeed,
  getSubmissionStatusText,
  submissionStatuses,
  summarizeSubmissions,
} from "@/lib/submission-state";
import { requireCurrentUser } from "@/lib/supabase/server";

export default async function SubmissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    saved?: string | string[];
    error?: string | string[];
  }>;
}) {
  const totalStartedAt = perfNow();
  await connection();

  const { id } = await params;
  const query = await searchParams;
  const saved = getQueryValue(query.saved) === "1";
  const error = getQueryValue(query.error);
  const authStartedAt = perfNow();
  const user = await requireCurrentUser();
  const authMs = msSince(authStartedAt);
  const examStartedAt = perfNow();
  const exam = await prisma.exam.findFirst({
    where: { id, ownerUserId: user.id },
    select: {
      id: true,
      title: true,
      subject: true,
      classroomId: true,
      captureToken: true,
      _count: { select: { answerKeys: true, questions: true } },
      answerKeys: {
        orderBy: { question: "asc" },
        select: { question: true, answer: true },
      },
      classroom: {
        select: {
          name: true,
          students: { orderBy: { createdAt: "asc" }, select: { id: true, name: true } },
        },
      },
      questions: {
        orderBy: { number: "asc" },
        select: { number: true, points: true },
      },
      submissions: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          score: true,
          total: true,
          percentage: true,
          pageCount: true,
          createdAt: true,
          updatedAt: true,
          student: { select: { id: true, name: true } },
        },
      },
    },
  });
  const examMs = msSince(examStartedAt);

  if (!exam) {
    perfLog("submissions-page", {
      authMs,
      examMs,
      totalMs: msSince(totalStartedAt),
    });
    notFound();
  }

  const captureToken = exam.captureToken ?? generateCaptureToken();

  if (!exam.captureToken) {
    await prisma.exam.update({
      where: { id: exam.id },
      data: { captureToken },
    });
  }

  const totalPoints = exam.questions.reduce((sum, question) => sum + question.points, 0);
  const isAnswerKeyReady =
    exam._count.questions > 0 && exam._count.answerKeys >= exam._count.questions;
  const signatureSeed = buildAnswerKeySignatureSeed({
    questions: exam.questions,
    answerKeys: exam.answerKeys,
  });
  const submissionSummary = summarizeSubmissions(exam.submissions, signatureSeed);
  const savedCount = submissionSummary.completed;
  const captureLink = getCaptureLink(exam.id, captureToken);
  perfLog("submissions-page", {
    authMs,
    examMs,
    students: exam.classroom.students.length,
    submissions: exam.submissions.length,
    totalMs: msSince(totalStartedAt),
  });

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
          title="Сурагчийн хариулт оруулах"
          description="Сурагчийг сонгоод хариултын хуудсыг AI-аар уншуулна."
          actions={
            <>
              <Link
                href={`/exams/${exam.id}/results`}
                className="inline-flex items-center gap-2 rounded-lg bg-[#8B5E3C] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#734d31]"
              >
                <BarChart3 className="size-4" aria-hidden="true" />
                Үр дүн харах
              </Link>
              <div className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-right shadow-sm">
                <p className="text-xs font-medium text-stone-500">Хадгалсан дүн</p>
                <p className="text-2xl font-bold text-stone-900">{savedCount}</p>
              </div>
            </>
          }
        >
          <Link
            href={`/exams/${exam.id}/answer-key`}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-[#8B5E3C]"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Зөв хариулт руу буцах
          </Link>
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-stone-600">
            <span>{exam.classroom.name}</span>
            <span>·</span>
            <span>{exam.subject}</span>
            <span>·</span>
            <span>{exam.questions.length} асуулт</span>
            <span>·</span>
            <span>{formatNumber(totalPoints)} оноо</span>
          </div>
        </PageHeader>

        {saved ? (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">
            Дүн амжилттай хадгалагдлаа.
          </div>
        ) : null}

        {error ? <ErrorMessage error={error} examId={exam.id} /> : null}

        <div className="mb-6 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-stone-900">
                {isAnswerKeyReady
                  ? "Зөв хариулт баталгаажсан"
                  : "Зөв хариулт бүрэн баталгаажаагүй байна"}
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                {isAnswerKeyReady
                  ? "Сурагчийн хариултыг уншуулж дүн бодоход бэлэн."
                  : "Эхлээд асуулт бүрийн зөв хариултыг баталгаажуулна уу."}
              </p>
            </div>
            <Link
              href={`/exams/${exam.id}/answer-key`}
              className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
            >
              <ListChecks className="size-4" aria-hidden="true" />
              Зөв хариулт засах
            </Link>
          </div>
        </div>

        <section className="mb-6 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Smartphone className="size-5 text-[#8B5E3C]" aria-hidden="true" />
                <h2 className="text-lg font-bold text-stone-900">Утсаар зураг авах</h2>
              </div>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                QR кодыг утсаараа уншуулж, сурагчийн хариултын хуудсыг камераар авна.
              </p>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-stone-500">
                Mobile capture URL
              </p>
              <code className="mt-1 block break-all rounded-lg bg-stone-100 px-3 py-2 text-sm font-semibold text-stone-900">
                {captureLink.path}
              </code>
              <input
                aria-label="Mobile capture URL"
                readOnly
                value={captureLink.href}
                className="mt-3 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700"
              />
              <p className="mt-2 text-xs text-stone-500">
                Deployed demo дээр QR код public URL руу заана.
              </p>
            </div>

            <div className="shrink-0">
              {captureLink.isAbsolute ? (
                <div className="rounded-lg border border-stone-200 bg-white p-3">
                  <QRCode
                    value={captureLink.href}
                    size={148}
                    title="Утасны камераар авах QR код"
                    className="h-[148px] w-[148px]"
                  />
                </div>
              ) : (
                <div className="max-w-48 rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4 text-sm leading-6 text-stone-600">
                  NEXT_PUBLIC_APP_URL тохируулбал QR код энд харагдана.
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <section className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-stone-900">
              Сурагчийн хариултын хуудас оруулах
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              Багш сурагчийг сонгоод хариултын хуудсын зургийг оруулна. AI сонгосон хариултуудыг уншаад зөв хариутай харьцуулж оноог тооцоолно.
            </p>

            {exam.classroom.students.length === 0 ? (
              <div className="mt-5 rounded-lg border border-dashed border-stone-200 bg-stone-50/60 p-5 text-center">
                <Inbox className="mx-auto mb-3 size-8 text-[#8B5E3C]" aria-hidden="true" />
                <h3 className="text-base font-bold text-stone-900">
                  Энэ ангид сурагч бүртгэгдээгүй байна.
                </h3>
                <p className="mt-1 text-sm text-stone-500">
                  Хариултын хуудас оруулахын өмнө сурагчдын нэрийг нэмнэ үү.
                </p>
                <Link
                  href={`/classrooms/${exam.classroomId}`}
                  className="mt-4 inline-flex rounded-lg bg-[#8B5E3C] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#734d31]"
                >
                  Ангийн мэдээлэл рүү буцах
                </Link>
              </div>
            ) : (
              <SubmissionUploadForm
                examId={exam.id}
                students={exam.classroom.students}
                isAnswerKeyReady={isAnswerKeyReady}
              />
            )}
          </section>

          <section className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-stone-900">Оруулсан хариултууд</h2>
            {exam.submissions.length === 0 ? (
              <div className="mt-5 rounded-lg border border-dashed border-stone-200 bg-stone-50/60 p-8 text-center">
                <Inbox className="mx-auto mb-3 size-8 text-[#8B5E3C]" aria-hidden="true" />
                <h3 className="text-base font-bold text-stone-900">
                  Одоогоор сурагчийн хариулт оруулаагүй байна.
                </h3>
                <p className="mt-1 text-sm text-stone-500">
                  Сурагч сонгоод хариултын хуудсын зургийг оруулна уу.
                </p>
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto">
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
                    {exam.submissions.map((submission) => (
                      <tr key={submission.id} className="hover:bg-stone-50/60">
                        <td className="px-4 py-3 font-semibold text-stone-900">
                          {submission.student.name}
                        </td>
                        <td className="px-4 py-3">
                          {formatNumber(submission.score)} / {formatNumber(submission.total)}
                        </td>
                        <td className="px-4 py-3">{formatPageCount(submission.pageCount)}</td>
                        <td className="px-4 py-3">{Math.round(submission.percentage)}%</td>
                        <td className="px-4 py-3">
                          <span className={getStatusClass(submission.status)}>
                            {getSubmissionStatusText(submission.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3">{submission.createdAt.toLocaleDateString("mn-MN")}</td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/exams/${exam.id}/submissions/${submission.id}/review`}
                            className="text-sm font-medium text-[#8B5E3C] hover:text-[#734d31]"
                          >
                            {submission.status === submissionStatuses.saved ? "Харах" : "Засах"}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function ErrorMessage({ error, examId }: { error: string; examId: string }) {
  const text =
    error === "answerKey"
      ? "Эхлээд зөв хариултаа бүрэн баталгаажуулна уу."
      : error === "student"
        ? "Сурагч сонгоно уу."
        : error === "file"
          ? "Хариултын хуудасны зураг оруулна уу."
          : "Илгээсэн мэдээлэл буруу байна.";

  return (
    <div className="mb-6 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>
        {text}{" "}
      {error === "answerKey" ? (
        <Link href={`/exams/${examId}/answer-key`} className="underline">
          Зөв хариулт руу очих
        </Link>
      ) : null}
      </div>
    </div>
  );
}

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getCaptureLink(examId: string, captureToken: string) {
  const path = `/exams/${examId}/capture?token=${encodeURIComponent(captureToken)}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");

  return {
    path,
    href: appUrl ? `${appUrl}${path}` : path,
    isAbsolute: Boolean(appUrl),
  };
}

function getStatusClass(status: string) {
  if (status === submissionStatuses.saved) {
    return "inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800";
  }

  if (status === submissionStatuses.processing) {
    return "inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800";
  }

  if (status === submissionStatuses.failed) {
    return "inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800";
  }

  return "inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800";
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatPageCount(value: number) {
  return `${value || 1} хуудас`;
}
