import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { createSubmissionDraftAction } from "@/actions/submission-actions";
import { prisma } from "@/lib/prisma";

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
  await connection();

  const { id } = await params;
  const query = await searchParams;
  const saved = getQueryValue(query.saved) === "1";
  const error = getQueryValue(query.error);
  const exam = await prisma.exam.findUnique({
    where: { id },
    include: {
      classroom: {
        include: {
          students: { orderBy: { createdAt: "asc" }, select: { id: true, name: true } },
        },
      },
      answerKeys: { orderBy: { question: "asc" } },
      questions: {
        orderBy: { number: "asc" },
        include: { options: { orderBy: { createdAt: "asc" } } },
      },
      submissions: {
        orderBy: { createdAt: "desc" },
        include: {
          student: { select: { name: true } },
          answers: true,
        },
      },
    },
  });

  if (!exam) {
    notFound();
  }

  const totalPoints = exam.questions.reduce((sum, question) => sum + question.points, 0);
  const isAnswerKeyReady = exam.questions.length > 0 && exam.questions.every(
    (question) =>
      question.options.some((option) => option.isCorrect) ||
      exam.answerKeys.some((answer) => answer.question === question.number)
  );
  const savedCount = exam.submissions.filter((submission) => submission.status === "SAVED").length;

  return (
    <div className="min-h-screen bg-stone-50/30 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 border-b border-stone-200 pb-6">
          <Link
            href={`/exams/${exam.id}/answer-key`}
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-[#8B5E3C]"
          >
            <span aria-hidden="true">←</span>
            Зөв хариулт руу буцах
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-stone-900">
                {exam.title}
              </h1>
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-stone-600">
                <span>{exam.classroom.name}</span>
                <span>·</span>
                <span>{exam.subject}</span>
                <span>·</span>
                <span>{exam.questions.length} асуулт</span>
                <span>·</span>
                <span>{formatNumber(totalPoints)} оноо</span>
              </div>
            </div>
            <div className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-right shadow-sm">
              <p className="text-xs font-medium text-stone-500">Хадгалсан дүн</p>
              <p className="text-2xl font-bold text-stone-900">{savedCount}</p>
            </div>
          </div>
        </div>

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
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
            >
              Зөв хариулт засах
            </Link>
          </div>
        </div>

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
                <p className="text-sm text-stone-500">
                  Энэ ангид сурагч бүртгэгдээгүй байна.
                </p>
                <Link
                  href={`/classrooms/${exam.classroomId}`}
                  className="mt-4 inline-flex rounded-lg bg-[#8B5E3C] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#734d31]"
                >
                  Ангийн мэдээлэл рүү буцах
                </Link>
              </div>
            ) : (
              <form action={createSubmissionDraftAction} className="mt-5 space-y-5">
                <input type="hidden" name="examId" value={exam.id} />
                <div>
                  <label htmlFor="studentId" className="mb-1.5 block text-sm font-semibold text-stone-700">
                    Сурагч
                  </label>
                  <select
                    id="studentId"
                    name="studentId"
                    required
                    defaultValue=""
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-[#8B5E3C] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]"
                  >
                    <option value="">Сурагч сонгох</option>
                    {exam.classroom.students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="answerSheet" className="mb-1.5 block text-sm font-semibold text-stone-700">
                    Хариултын хуудасны зураг
                  </label>
                  <input
                    id="answerSheet"
                    name="answerSheet"
                    required
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 file:mr-4 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-stone-700 hover:file:bg-stone-200"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!isAnswerKeyReady}
                  className="w-full rounded-lg bg-[#8B5E3C] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#734d31] disabled:cursor-not-allowed disabled:bg-stone-300"
                >
                  AI-аар уншуулах
                </button>
              </form>
            )}
          </section>

          <section className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-stone-900">Оруулсан хариултууд</h2>
            {exam.submissions.length === 0 ? (
              <div className="mt-5 rounded-lg border border-dashed border-stone-200 bg-stone-50/60 p-8 text-center">
                <p className="text-sm text-stone-500">
                  Одоогоор сурагчийн хариулт оруулаагүй байна.
                </p>
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="min-w-full divide-y divide-stone-200 text-left text-sm text-stone-600">
                  <thead className="bg-stone-50 text-xs font-bold uppercase tracking-wider text-stone-700">
                    <tr>
                      <th className="px-4 py-3">Сурагч</th>
                      <th className="px-4 py-3">Оноо</th>
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
                        <td className="px-4 py-3">{Math.round(submission.percentage)}%</td>
                        <td className="px-4 py-3">{getStatusText(submission.status)}</td>
                        <td className="px-4 py-3">{submission.createdAt.toLocaleDateString("mn-MN")}</td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/exams/${exam.id}/submissions/${submission.id}/review`}
                            className="text-sm font-medium text-[#8B5E3C] hover:text-[#734d31]"
                          >
                            {submission.status === "SAVED" ? "Харах" : "Засах"}
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
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
      {text}{" "}
      {error === "answerKey" ? (
        <Link href={`/exams/${examId}/answer-key`} className="underline">
          Зөв хариулт руу очих
        </Link>
      ) : null}
    </div>
  );
}

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getStatusText(status: string) {
  return status === "SAVED" ? "Хадгалсан" : "Хянах шаардлагатай";
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
