import Link from "next/link";
import { notFound } from "next/navigation";
import { saveAnswerKeyAction } from "@/actions/answer-key-actions";
import { prisma } from "@/lib/prisma";

const answerOptions = ["A", "B", "C", "D"];

export default async function AnswerKeyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const exam = await prisma.exam.findUnique({
    where: { id },
    include: {
      classroom: { select: { name: true } },
      answerKeys: { orderBy: { question: "asc" } },
    },
  });

  if (!exam) {
    notFound();
  }

  const existingAnswers = new Map(
    exam.answerKeys.map((item) => [item.question, item.answer])
  );

  return (
    <div className="min-h-screen bg-stone-50/30 p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 border-b border-stone-200 pb-6">
          <Link
            href="/classrooms"
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-[#8B5E3C]"
          >
            <span aria-hidden="true">←</span>
            Ангиуд руу буцах
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-stone-900">
            {exam.title}
          </h1>
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-stone-600">
            <span>{exam.classroom.name}</span>
            <span>·</span>
            <span>{exam.subject}</span>
            <span>·</span>
            <span>{exam.questionCount} асуулт</span>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-amber-100 bg-amber-50/60 p-4 text-sm text-stone-700">
          AI шалгалтын бүтцийг уншсан. Одоо зөв хариултуудыг багш баталгаажуулна.
        </div>

        <form action={saveAnswerKeyAction} className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <input type="hidden" name="examId" value={exam.id} />
          <div className="space-y-4">
            {Array.from({ length: exam.questionCount }, (_, index) => {
              const question = index + 1;

              return (
                <fieldset
                  key={question}
                  className="flex flex-col gap-3 rounded-lg border border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <legend className="text-sm font-semibold text-stone-900">
                    {question}-р асуулт
                  </legend>
                  <div className="grid grid-cols-4 gap-2">
                    {answerOptions.map((option) => (
                      <label
                        key={option}
                        className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
                      >
                        <input
                          type="radio"
                          name={`q-${question}`}
                          value={option}
                          required
                          defaultChecked={existingAnswers.get(question) === option}
                          className="h-4 w-4 accent-[#8B5E3C]"
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                </fieldset>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-stone-100 pt-4">
            <Link
              href={`/classrooms/${exam.classroomId}`}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
            >
              Цуцлах
            </Link>
            <button
              type="submit"
              className="rounded-lg bg-[#8B5E3C] px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#734d31]"
            >
              Зөв хариулт хадгалах
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
