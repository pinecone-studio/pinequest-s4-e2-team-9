import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, ArrowLeft, BarChart3, UploadCloud } from "lucide-react";
import AnswerKeyReviewForm from "@/components/exams/answer-key-review-form";
import PageHeader from "@/components/layout/page-header";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/supabase/server";

export default async function AnswerKeyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCurrentUser();
  const exam = await prisma.exam.findFirst({
    where: { id, ownerUserId: user.id },
    include: {
      classroom: { select: { name: true } },
      answerKeys: { orderBy: { question: "asc" } },
      questions: {
        orderBy: { number: "asc" },
        include: {
          options: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });

  if (!exam) {
    notFound();
  }

  const existingAnswers = new Map(
    exam.answerKeys.map((item) => [item.question, item.answer])
  );
  const questions = exam.questions.map((question) => ({
    id: question.id,
    number: question.number,
    text: question.text,
    points: question.points,
    options: question.options.map((option) => ({
      id: option.id,
      label: option.label,
      text: option.text,
      isCorrect: existingAnswers.get(question.number) === option.label || option.isCorrect,
    })),
  }));
  const hasEmptyContent =
    questions.length === 0 ||
    questions.some(
      (question) =>
        !question.text.trim() ||
        question.options.length < 2 ||
        question.options.every((option) => !option.text.trim())
    );
  const hasNoParsedContent =
    questions.length === 0 ||
    questions.every(
      (question) =>
        !question.text.trim() &&
        question.options.every((option) => !option.text.trim())
    );
  const shouldShowAiFailedState = Boolean(exam.materialUrl) && hasNoParsedContent;

  return (
    <div className="min-h-screen bg-stone-50/30 p-8">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          eyebrow={exam.title}
          title="Зөв хариу баталгаажуулах"
          description="AI уншсан асуулт, сонголт, оноог шалгаад хадгална."
          actions={
            <>
              <Link
                href={`/exams/${exam.id}/submissions`}
                className="inline-flex items-center gap-2 rounded-lg bg-[#8B5E3C] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#734d31]"
              >
                <UploadCloud className="size-4" aria-hidden="true" />
                Хариулт оруулах
              </Link>
              <Link
                href={`/exams/${exam.id}/results`}
                className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
              >
                <BarChart3 className="size-4" aria-hidden="true" />
                Үр дүн
              </Link>
            </>
          }
        >
          <Link
            href="/classrooms"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-[#8B5E3C]"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Ангиуд руу буцах
          </Link>
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-stone-600">
            <span>{exam.classroom.name}</span>
            <span>·</span>
            <span>{exam.subject}</span>
            <span>·</span>
            <span>{exam.questionCount} асуулт</span>
          </div>
        </PageHeader>

        <div className="mb-6 flex gap-3 rounded-xl border border-amber-100 bg-amber-50/60 p-4 text-sm text-stone-700">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden="true" />
          <div>
            <p>
              AI шалгалтын бүтцийг уншсан. Одоо багш асуулт, сонголт, зөв хариулт болон оноог баталгаажуулна.
            </p>
            <p className="mt-2 font-medium">
              AI-ийн санал болгосон зөв хариулт алдаатай байж болно. Эцсийн зөв хариултыг багш өөрөө баталгаажуулна.
            </p>
          </div>
        </div>

        {shouldShowAiFailedState ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <AlertCircle className="mb-4 size-8 text-amber-700" aria-hidden="true" />
            <h2 className="text-lg font-bold text-stone-900">
              AI шалгалтын материалыг уншиж чадсангүй.
            </h2>
            <p className="mt-2 text-sm text-stone-700">
              Энэ шалгалтад асуулт, сонголтын текст үүсээгүй байна.
            </p>
            <p className="mt-1 text-sm text-stone-700">
              Зураг тод эсэх, GEMINI_API_KEY тохиргоо болон файл оруулах талбарыг шалгаад дахин үүсгэнэ үү.
            </p>
            <Link
              href={`/exams/new?classroomId=${exam.classroomId}`}
              className="mt-5 inline-flex rounded-lg bg-[#8B5E3C] px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#734d31]"
            >
              Шинэ шалгалт үүсгэх
            </Link>
          </div>
        ) : (
          <AnswerKeyReviewForm
            examId={exam.id}
            questions={questions}
            hasEmptyContent={hasEmptyContent}
          />
        )}
      </div>
    </div>
  );
}
