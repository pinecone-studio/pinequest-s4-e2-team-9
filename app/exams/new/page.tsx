import Link from "next/link";
import { connection } from "next/server";
import { AlertCircle, ArrowLeft, FilePlus2 } from "lucide-react";
import { createExamAction } from "@/actions/exam-actions";
import PageHeader from "@/components/layout/page-header";
import LoadingSubmitButton from "@/components/ui/loading-submit-button";
import { prisma } from "@/lib/prisma";
import { SUBJECT_OPTIONS } from "@/lib/subjects";
import { requireCurrentUser } from "@/lib/supabase/server";

export default async function NewExamPage({
  searchParams,
}: {
  searchParams: Promise<{ aiError?: string | string[]; classroomId?: string | string[] }>;
}) {
  await connection();

  const user = await requireCurrentUser();
  const { aiError, classroomId } = await searchParams;
  const selectedClassroomId = Array.isArray(classroomId)
    ? classroomId[0]
    : classroomId;
  const shouldShowAiError = (Array.isArray(aiError) ? aiError[0] : aiError) === "1";
  const classrooms = await prisma.classroom.findMany({
    where: { ownerUserId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, subject: true },
  });

  if (classrooms.length === 0) {
    return (
      <div className="min-h-screen bg-stone-50/30 p-8">
        <div className="mx-auto max-w-xl rounded-xl border border-dashed border-stone-200 bg-white p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto mb-4 size-10 text-[#8B5E3C]" aria-hidden="true" />
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">
            Эхлээд анги үүсгэнэ үү
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            Шалгалт үүсгэхийн өмнө сурагчдын анги хэрэгтэй.
          </p>
          <Link
            href="/classrooms/new"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#8B5E3C] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#734d31]"
          >
            <FilePlus2 className="size-4" aria-hidden="true" />
            Анги үүсгэх
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50/30 p-8">
      <div className="mx-auto mb-6 max-w-2xl">
        <PageHeader
          title="Шинэ шалгалт үүсгэх"
          description="Шалгалтын материалаа оруулаад AI-аар асуулт, сонголт, зөв хариуг уншуулна."
        >
          <Link
            href="/classrooms"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-[#8B5E3C]"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Ангиуд руу буцах
          </Link>
        </PageHeader>
      </div>

      <form
        action={createExamAction}
        className="mx-auto max-w-2xl rounded-xl border border-stone-200 bg-white p-6 shadow-sm"
      >
        <div className="space-y-5">
          <div>
            <label htmlFor="title" className="mb-1.5 block text-sm font-semibold text-stone-700">
              Шалгалтын нэр <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              name="title"
              required
              type="text"
              placeholder="Жишээ: Улирлын шалгалт"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-[#8B5E3C] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]"
            />
          </div>

          <div>
            <label htmlFor="subject" className="mb-1.5 block text-sm font-semibold text-stone-700">
              Хичээл <span className="text-red-500">*</span>
            </label>
            <select
              id="subject"
              name="subject"
              required
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-[#8B5E3C] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]"
              defaultValue=""
            >
              <option value="">Хичээл сонгох</option>
              {SUBJECT_OPTIONS.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="classroomId" className="mb-1.5 block text-sm font-semibold text-stone-700">
              Анги <span className="text-red-500">*</span>
            </label>
            <select
              id="classroomId"
              name="classroomId"
              required
              defaultValue={
                classrooms.some((classroom) => classroom.id === selectedClassroomId)
                  ? selectedClassroomId
                  : ""
              }
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-[#8B5E3C] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]"
            >
              <option value="">Анги сонгох</option>
              {classrooms.map((classroom) => (
                <option key={classroom.id} value={classroom.id}>
                  {classroom.name}
                  {classroom.subject ? ` · ${classroom.subject}` : ""}
                </option>
              ))}
            </select>
          </div>

          {shouldShowAiError ? (
            <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-stone-800">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden="true" />
              <div>
                <p className="font-semibold">
                  AI шалгалтын материалыг уншиж чадсангүй. Gemini түр ачаалалтай байж магадгүй. 1 минутын дараа дахин оролдоно уу.
                </p>
                <p className="mt-2">
                  Хэрэв файл оруулахгүй бол асуултын тоог гараар оруулж шалгалт үүсгэж болно.
                </p>
              </div>
            </div>
          ) : null}

          <div>
            <label htmlFor="material" className="mb-1.5 block text-sm font-semibold text-stone-700">
              Шалгалтын материал
            </label>
            <input
              id="material"
              name="material"
              type="file"
              accept="image/*,.pdf"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 file:mr-4 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-stone-700 hover:file:bg-stone-200"
            />
            <p className="mt-2 text-xs text-stone-500">
              Шалгалтын материалаа оруулна уу. AI асуулт, сонголт болон зөв хариуг уншиж дараагийн алхамд багш баталгаажуулна.
            </p>
          </div>

          <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4">
            <h2 className="text-sm font-semibold text-stone-800">Гараар тохируулах</h2>
            <label htmlFor="questionCount" className="mt-3 mb-1.5 block text-sm font-semibold text-stone-700">
              Асуултын тоо
            </label>
            <input
              id="questionCount"
              name="questionCount"
              min={1}
              type="number"
              placeholder="Жишээ: 20"
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-[#8B5E3C] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]"
            />
            <p className="mt-2 text-xs text-stone-500">
              AI уншилт амжилтгүй үед эсвэл файл оруулахгүй үед ашиглана.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-stone-100 pt-4">
            <Link
              href="/dashboard"
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
            >
              Цуцлах
            </Link>
            <LoadingSubmitButton
              loadingText="Уншиж байна..."
              className="px-5 py-2 text-sm font-medium"
            >
              <FilePlus2 className="size-4" aria-hidden="true" />
              Дараагийн алхам
            </LoadingSubmitButton>
          </div>
        </div>
      </form>
    </div>
  );
}
