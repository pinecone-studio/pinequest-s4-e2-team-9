import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import SubmissionMaterialReviewLayout from "@/components/exams/submission-material-review-layout";
import SubmissionReviewForm from "@/components/exams/submission-review-form";
import PageHeader from "@/components/layout/page-header";
import { gradeSubmission } from "@/lib/grading";
import { msSince, perfLog, perfNow } from "@/lib/perf";
import { prisma } from "@/lib/prisma";
import { getSubmissionImagePreview } from "@/lib/submission-image-storage";
import { getSubmissionStatusText } from "@/lib/submission-state";
import { requireCurrentUser } from "@/lib/supabase/server";

export default async function SubmissionReviewPage({
  params,
}: {
  params: Promise<{ id: string; submissionId: string }>;
}) {
  const totalStartedAt = perfNow();
  const { id, submissionId } = await params;
  const authStartedAt = perfNow();
  const user = await requireCurrentUser();
  const authMs = msSince(authStartedAt);
  const submissionStartedAt = perfNow();
  const submission = await prisma.submission.findFirst({
    where: { id: submissionId, examId: id, exam: { ownerUserId: user.id } },
    select: {
      id: true,
      examId: true,
      imageUrl: true,
      status: true,
      score: true,
      total: true,
      percentage: true,
      student: { select: { name: true } },
      answers: {
        orderBy: { question: "asc" },
        select: { question: true, selected: true },
      },
      exam: {
        select: {
          id: true,
          title: true,
          subject: true,
          classroom: { select: { name: true } },
          answerKeys: {
            orderBy: { question: "asc" },
            select: { question: true, answer: true },
          },
          questions: {
            orderBy: { number: "asc" },
            select: {
              id: true,
              number: true,
              text: true,
              points: true,
              options: {
                orderBy: { createdAt: "asc" },
                select: { label: true, text: true, isCorrect: true },
              },
            },
          },
        },
      },
    },
  });
  const submissionMs = msSince(submissionStartedAt);

  if (!submission) {
    perfLog("review-page", {
      authMs,
      submissionMs,
      totalMs: msSince(totalStartedAt),
    });
    notFound();
  }

  const grading = gradeSubmission({
    questions: submission.exam.questions,
    correctAnswers: submission.exam.answerKeys,
    extractedAnswers: submission.answers.map((answer) => ({
      questionNumber: answer.question,
      selectedLabel: answer.selected,
    })),
  });
  const rowsByQuestion = new Map(
    grading.rows.map((row) => [row.questionNumber, row])
  );
  const questions = submission.exam.questions.map((question) => {
    const row = rowsByQuestion.get(question.number);

    return {
      number: question.number,
      text: question.text,
      points: question.points,
      selectedLabel: row?.selectedLabel ?? "",
      correctLabel: row?.correctLabel ?? "",
      options: question.options.map((option) => ({
        label: option.label,
        text: option.text,
      })),
    };
  });
  const studentMaterial = await getSubmissionImagePreview(
    submission.imageUrl,
    submission.examId
  );
  perfLog("review-page", {
    authMs,
    submissionMs,
    questions: questions.length,
    totalMs: msSince(totalStartedAt),
  });

  return (
    <div className="min-h-screen bg-stone-50/30 p-8">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          eyebrow={submission.exam.title}
          title="Хариулт хянах"
          description="AI уншсан хариултыг шалгаад дүнг хадгална."
          actions={
            <div className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-right shadow-sm">
              <p className="text-xs font-medium text-stone-500">Одоогийн дүн</p>
              <p className="text-2xl font-bold text-stone-900">
                {formatNumber(submission.score)} / {formatNumber(submission.total)}
              </p>
              <p className="text-sm text-stone-500">{Math.round(submission.percentage)}%</p>
            </div>
          }
        >
          <Link
            href={`/exams/${submission.exam.id}/submissions`}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-[#8B5E3C]"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Буцах
          </Link>
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-stone-600">
            <span>{submission.student.name}</span>
            <span>·</span>
            <span>{submission.exam.classroom.name}</span>
            <span>·</span>
            <span>{submission.exam.subject}</span>
          </div>
        </PageHeader>

        <div className="mb-6 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 text-sm text-stone-600 md:grid-cols-3">
            <div>
              <p className="font-medium text-stone-500">Сурагч</p>
              <p className="mt-1 font-semibold text-stone-900">{submission.student.name}</p>
            </div>
            <div>
              <p className="font-medium text-stone-500">Төлөв</p>
              <p className="mt-1 font-semibold text-stone-900">
                {getSubmissionStatusText(submission.status)}
              </p>
            </div>
            <div>
              <p className="font-medium text-stone-500">Хариултын хуудас</p>
              <p className="mt-1 font-semibold text-stone-900">
                {submission.imageUrl || "Файл хадгалаагүй"}
              </p>
            </div>
          </div>
        </div>

        <SubmissionMaterialReviewLayout
          materialUrl={studentMaterial.url}
          materialName={studentMaterial.name}
          materialMimeType={studentMaterial.mimeType}
          materialMissingReason={studentMaterial.missingReason}
        >
          <SubmissionReviewForm
            examId={submission.exam.id}
            submissionId={submission.id}
            questions={questions}
          />
        </SubmissionMaterialReviewLayout>
      </div>
    </div>
  );
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
