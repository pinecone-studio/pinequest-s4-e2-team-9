import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft, Camera, Inbox, ListChecks } from "lucide-react";
import SubmissionUploadForm from "@/components/exams/submission-upload-form";
import { prisma } from "@/lib/prisma";

export default async function CapturePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string | string[]; submitted?: string | string[] }>;
}) {
  await connection();

  const { id } = await params;
  const query = await searchParams;
  const token = getQueryValue(query.token)?.trim() ?? "";
  const submitted = getQueryValue(query.submitted) === "1";
  const exam = token
    ? await prisma.exam.findFirst({
        where: { id, captureToken: token },
        select: {
          id: true,
          title: true,
          classroomId: true,
          classroom: {
            select: {
              name: true,
              students: { orderBy: { createdAt: "asc" }, select: { id: true, name: true } },
            },
          },
          answerKeys: {
            orderBy: { question: "asc" },
            select: { question: true, answer: true },
          },
          questions: {
            orderBy: { number: "asc" },
            select: {
              number: true,
              options: {
                orderBy: { createdAt: "asc" },
                select: { isCorrect: true },
              },
            },
          },
        },
      })
    : null;

  if (!exam) {
    return <InvalidCaptureLink />;
  }

  const isAnswerKeyReady =
    exam.questions.length > 0 &&
    exam.questions.every(
      (question) =>
        question.options.some((option) => option.isCorrect) ||
        exam.answerKeys.some((answer) => answer.question === question.number)
    );

  return (
    <div className="min-h-screen bg-stone-50/30 px-4 py-5 sm:px-6">
      <main className="mx-auto max-w-xl">
        <Link
          href={`/exams/${exam.id}/submissions`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-[#8B5E3C]"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Буцах
        </Link>

        <header className="mt-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#8B5E3C]">
            <Camera className="size-4" aria-hidden="true" />
            Утсаар зураг авах
          </div>
          <h1 className="mt-2 text-2xl font-bold text-stone-950">{exam.title}</h1>
          {exam.classroom.name ? (
            <p className="mt-1 text-sm font-medium text-stone-600">{exam.classroom.name}</p>
          ) : null}
        </header>

        <section className="mt-5 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-stone-900">
            Сурагчийн хариултын хуудас
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Сурагчаа сонгоод хариултын хуудсыг камераар авч илгээнэ.
          </p>

          {submitted ? (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-semibold leading-6 text-green-800">
              Зураг илгээгдлээ. Багш компьютер дээрээ хариултыг хянаж хадгална.
            </div>
          ) : null}

          {!isAnswerKeyReady ? (
            <div className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold leading-6 text-amber-800">
              <ListChecks className="mt-1 size-4 shrink-0" aria-hidden="true" />
              Эхлээд зөв хариултаа бүрэн баталгаажуулна уу.
            </div>
          ) : null}

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
                className="mt-4 inline-flex rounded-lg bg-[#8B5E3C] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#734d31]"
              >
                Ангийн мэдээлэл рүү буцах
              </Link>
            </div>
          ) : (
            <SubmissionUploadForm
              examId={exam.id}
              students={exam.classroom.students}
              isAnswerKeyReady={isAnswerKeyReady}
              variant="mobile"
              submitLabel="Зураг илгээх"
              loadingText="AI хариултыг уншиж байна..."
              captureToken={token}
            />
          )}
        </section>
      </main>
    </div>
  );
}

function InvalidCaptureLink() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50/30 px-4 py-10">
      <main className="w-full max-w-md rounded-lg border border-amber-200 bg-amber-50 p-6 text-center shadow-sm">
        <Camera className="mx-auto mb-3 size-8 text-[#8B5E3C]" aria-hidden="true" />
        <h1 className="text-lg font-bold text-stone-950">
          Энэ зураг авах холбоос хүчингүй байна.
        </h1>
        <p className="mt-2 text-sm leading-6 text-stone-700">
          Багшийн компьютер дээрх шинэ QR кодыг дахин уншуулна уу.
        </p>
      </main>
    </div>
  );
}

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
