import Link from "next/link";
import { notFound } from "next/navigation";
import SubmissionReviewForm from "@/components/exams/submission-review-form";
import { gradeSubmission } from "@/lib/grading";
import { prisma } from "@/lib/prisma";

export default async function SubmissionReviewPage({
  params,
}: {
  params: Promise<{ id: string; submissionId: string }>;
}) {
  const { id, submissionId } = await params;
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      student: { select: { name: true } },
      answers: { orderBy: { question: "asc" } },
      exam: {
        include: {
          classroom: { select: { name: true } },
          answerKeys: { orderBy: { question: "asc" } },
          questions: {
            orderBy: { number: "asc" },
            include: { options: { orderBy: { createdAt: "asc" } } },
          },
        },
      },
    },
  });

  if (!submission || submission.examId !== id) {
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

  return (
    <div className="min-h-screen bg-stone-50/30 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 border-b border-stone-200 pb-6">
          <Link
            href={`/exams/${submission.exam.id}/submissions`}
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-[#8B5E3C]"
          >
            <span aria-hidden="true">←</span>
            Буцах
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-stone-900">
                {submission.exam.title}
              </h1>
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-stone-600">
                <span>{submission.student.name}</span>
                <span>·</span>
                <span>{submission.exam.classroom.name}</span>
                <span>·</span>
                <span>{submission.exam.subject}</span>
              </div>
            </div>
            <div className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-right shadow-sm">
              <p className="text-xs font-medium text-stone-500">Одоогийн дүн</p>
              <p className="text-2xl font-bold text-stone-900">
                {formatNumber(submission.score)} / {formatNumber(submission.total)}
              </p>
              <p className="text-sm text-stone-500">{Math.round(submission.percentage)}%</p>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 text-sm text-stone-600 md:grid-cols-3">
            <div>
              <p className="font-medium text-stone-500">Сурагч</p>
              <p className="mt-1 font-semibold text-stone-900">{submission.student.name}</p>
            </div>
            <div>
              <p className="font-medium text-stone-500">Төлөв</p>
              <p className="mt-1 font-semibold text-stone-900">
                {submission.status === "SAVED" ? "Хадгалсан" : "Хянах шаардлагатай"}
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

        <SubmissionReviewForm
          examId={submission.exam.id}
          submissionId={submission.id}
          questions={questions}
        />
      </div>
    </div>
  );
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
