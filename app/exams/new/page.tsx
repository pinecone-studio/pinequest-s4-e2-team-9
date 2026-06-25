import Link from "next/link";
import { connection } from "next/server";
import { createExamAction } from "@/actions/exam-actions";
import { prisma } from "@/lib/prisma";

export default async function NewExamPage({
  searchParams,
}: {
  searchParams: Promise<{ classroomId?: string | string[] }>;
}) {
  await connection();

  const { classroomId } = await searchParams;
  const selectedClassroomId = Array.isArray(classroomId)
    ? classroomId[0]
    : classroomId;
  const classrooms = await prisma.classroom.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, subject: true },
  });

  if (classrooms.length === 0) {
    return (
      <div className="min-h-screen bg-stone-50/30 p-8">
        <div className="mx-auto max-w-xl rounded-xl border border-dashed border-stone-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">
            Эхлээд анги үүсгэнэ үү
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            Шалгалт үүсгэхийн өмнө сурагчдын анги хэрэгтэй.
          </p>
          <Link
            href="/classrooms/new"
            className="mt-5 inline-flex rounded-lg bg-[#8B5E3C] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#734d31]"
          >
            Анги үүсгэх
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50/30 p-8">
      <div className="mx-auto mb-6 max-w-2xl">
        <Link
          href="/classrooms"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-[#8B5E3C]"
        >
          <span aria-hidden="true">←</span>
          Ангиуд руу буцах
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">
          Шинэ шалгалт үүсгэх
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Шалгалтын материалаа оруулна уу. AI асуултын бүтцийг уншаад дараагийн алхамд зөв хариултыг баталгаажуулахад тусална.
        </p>
      </div>

      <form
        action={createExamAction}
        encType="multipart/form-data"
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
            <input
              id="subject"
              name="subject"
              required
              type="text"
              placeholder="Жишээ: Математик"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-[#8B5E3C] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]"
            />
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

          <div>
            <label htmlFor="questionCount" className="mb-1.5 block text-sm font-semibold text-stone-700">
              Асуултын тоо <span className="text-red-500">*</span>
            </label>
            <input
              id="questionCount"
              name="questionCount"
              required
              min={1}
              type="number"
              placeholder="Жишээ: 20"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-[#8B5E3C] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]"
            />
          </div>

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
              Зураг оруулбал AI асуултын бүтцийг уншихыг оролдоно. PDF бол энэ эхний хувилбарт асуултын тоог гараар баталгаажуулна.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-stone-100 pt-4">
            <Link
              href="/dashboard"
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
            >
              Цуцлах
            </Link>
            <button
              type="submit"
              className="rounded-lg bg-[#8B5E3C] px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#734d31]"
            >
              Дараагийн алхам
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
