import Link from "next/link";
import { connection } from "next/server";
import {
  BarChart3,
  FilePlus2,
  FileText,
  Inbox,
  LayoutDashboard,
  ListChecks,
  School,
  TrendingUp,
  UploadCloud,
} from "lucide-react";
import PageHeader from "@/components/layout/page-header";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/supabase/server";

export default async function DashboardPage() {
  await connection();

  const user = await requireCurrentUser();
  const [totalClasses, totalExams, savedSubmissions, recentExams] =
    await Promise.all([
      prisma.classroom.count({ where: { ownerUserId: user.id } }),
      prisma.exam.count({ where: { ownerUserId: user.id } }),
      prisma.submission.findMany({
        where: { status: "SAVED", exam: { ownerUserId: user.id } },
        select: { percentage: true },
      }),
      prisma.exam.findMany({
        where: { ownerUserId: user.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          classroom: { select: { name: true } },
          _count: { select: { submissions: true } },
        },
      }),
    ]);
  const averagePercentage =
    savedSubmissions.length === 0
      ? null
      : savedSubmissions.reduce(
          (sum, submission) => sum + safeNumber(submission.percentage),
          0
        ) / savedSubmissions.length;
  const cards = [
    { label: "Нийт анги", value: String(totalClasses), icon: School },
    { label: "Нийт шалгалт", value: String(totalExams), icon: FileText },
    { label: "Дүн орсон хуудас", value: String(savedSubmissions.length), icon: LayoutDashboard },
    {
      label: "Дундаж амжилт",
      value: averagePercentage === null ? "-" : `${Math.round(averagePercentage)}%`,
      icon: TrendingUp,
    },
  ];

  return (
    <div className="min-h-screen bg-stone-50/30 p-8">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title="Хянах самбар"
          description="Анги, шалгалт, хадгалсан дүнгээ нэг дор хянаарай."
          actions={
            <>
              <Link
                href="/classrooms"
                className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
              >
                <School className="size-4" aria-hidden="true" />
                Ангиуд харах
              </Link>
              <Link
                href="/exams/new"
                className="inline-flex items-center gap-2 rounded-lg bg-[#8B5E3C] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#734d31]"
              >
                <FilePlus2 className="size-4" aria-hidden="true" />
                Шинэ шалгалт үүсгэх
              </Link>
            </>
          }
        />

        <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.label}
                className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-stone-500">{card.label}</p>
                  <Icon className="size-5 text-[#8B5E3C]" aria-hidden="true" />
                </div>
                <p className="mt-3 text-3xl font-bold text-stone-900">{card.value}</p>
              </div>
            );
          })}
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-stone-900">Сүүлийн шалгалтууд</h2>
            <Link
              href="/exams/new"
              className="inline-flex items-center gap-2 rounded-lg bg-[#8B5E3C] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#734d31]"
            >
              <FilePlus2 className="size-4" aria-hidden="true" />
              Шинэ шалгалт үүсгэх
            </Link>
          </div>

          {recentExams.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-stone-200">
              <table className="min-w-full divide-y divide-stone-200 text-left text-sm text-stone-600">
                <thead className="bg-stone-50 text-xs font-bold uppercase tracking-wider text-stone-700">
                  <tr>
                    <th className="px-4 py-3">Шалгалтын нэр</th>
                    <th className="px-4 py-3">Хичээл</th>
                    <th className="px-4 py-3">Анги</th>
                    <th className="px-4 py-3">Асуулт</th>
                    <th className="px-4 py-3">Оруулсан хариулт</th>
                    <th className="px-4 py-3 text-right">Үйлдэл</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {recentExams.map((exam) => (
                    <tr key={exam.id} className="hover:bg-stone-50/60">
                      <td className="px-4 py-3 font-semibold text-stone-900">
                        {exam.title}
                      </td>
                      <td className="px-4 py-3">{exam.subject}</td>
                      <td className="px-4 py-3">{exam.classroom.name}</td>
                      <td className="px-4 py-3">{exam.questionCount}</td>
                      <td className="px-4 py-3">{exam._count.submissions}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-3">
                          <Link
                            href={`/exams/${exam.id}/answer-key`}
                            className="inline-flex items-center gap-1.5 font-medium text-[#8B5E3C] hover:text-[#734d31]"
                          >
                            <ListChecks className="size-3.5" aria-hidden="true" />
                            Зөв хариу
                          </Link>
                          <Link
                            href={`/exams/${exam.id}/submissions`}
                            className="inline-flex items-center gap-1.5 font-medium text-[#8B5E3C] hover:text-[#734d31]"
                          >
                            <UploadCloud className="size-3.5" aria-hidden="true" />
                            Хариулт оруулах
                          </Link>
                          <Link
                            href={`/exams/${exam.id}/results`}
                            className="inline-flex items-center gap-1.5 font-medium text-[#8B5E3C] hover:text-[#734d31]"
                          >
                            <BarChart3 className="size-3.5" aria-hidden="true" />
                            Үр дүн
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50/60 p-8 text-center">
              <Inbox className="mx-auto mb-3 size-8 text-[#8B5E3C]" aria-hidden="true" />
              <p className="text-sm text-stone-500">
                Одоогоор шалгалт үүсгээгүй байна.
              </p>
              <Link
                href="/exams/new"
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#8B5E3C] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#734d31]"
              >
                <FilePlus2 className="size-4" aria-hidden="true" />
                Шинэ шалгалт үүсгэх
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function safeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
