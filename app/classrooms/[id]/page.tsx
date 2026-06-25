import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, FilePlus2, Inbox } from 'lucide-react';
import PageHeader from '@/components/layout/page-header';
import AddStudentForm from '@/components/ui/AddStudentForm';
import StudentTable from '@/components/ui/StudentTable';
import { prisma } from '@/lib/prisma';

export default async function ClassroomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const classroom = await prisma.classroom.findUnique({
    where: { id },
    include: {
      students: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true },
      },
      exams: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          subject: true,
          questionCount: true,
          createdAt: true,
        },
      },
    },
  });

  if (!classroom) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-stone-50/30 p-8">
      <div className="max-w-7xl mx-auto">
        <PageHeader
          title={classroom.name}
          description="Сурагчид болон энэ ангид үүсгэсэн шалгалтууд."
          actions={
            <Link
              href={`/exams/new?classroomId=${classroom.id}`}
              className="inline-flex items-center gap-2 rounded-lg bg-[#8B5E3C] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#734d31]"
            >
              <FilePlus2 className="size-4" aria-hidden="true" />
              Шалгалт үүсгэх
            </Link>
          }
        >
          <Link
            href="/classrooms"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-[#8B5E3C] transition-colors"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Ангиуд руу буцах
          </Link>
        </PageHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
            <p className="text-sm font-medium text-stone-500 mb-1">Сурагч</p>
            <h2 className="text-3xl font-bold text-stone-900">{classroom.students.length}</h2>
          </div>
          <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
            <p className="text-sm font-medium text-stone-500 mb-1">Шалгалт</p>
            <h2 className="text-3xl font-bold text-stone-900">{classroom.exams.length}</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 mb-8">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-stone-900">Сурагчид</h2>
              <p className="text-sm text-stone-500">Энэ ангийн сурагчдын жагсаалт.</p>
            </div>
            <StudentTable students={classroom.students} />
          </div>

          <AddStudentForm classroomId={classroom.id} />
        </div>

        <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-bold text-stone-900">Шалгалтууд</h2>
              <p className="text-sm text-stone-500">Энэ ангид үүсгэсэн шалгалтууд.</p>
            </div>
            <Link
              href={`/exams/new?classroomId=${classroom.id}`}
              className="px-4 py-2.5 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors inline-flex items-center gap-2"
            >
              <FilePlus2 className="size-4" aria-hidden="true" />
              Шинэ шалгалт
            </Link>
          </div>

          {classroom.exams.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-stone-200 text-sm text-left text-stone-600">
                <thead className="bg-stone-50 text-xs font-bold text-stone-700 uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-6 py-3">Шалгалтын нэр</th>
                    <th scope="col" className="px-6 py-3">Хичээл</th>
                    <th scope="col" className="px-6 py-3">Асуулт</th>
                    <th scope="col" className="px-6 py-3">Үүсгэсэн өдөр</th>
                    <th scope="col" className="px-6 py-3 text-right">Үйлдэл</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {classroom.exams.map((exam) => (
                    <tr key={exam.id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-stone-900">{exam.title}</td>
                      <td className="px-6 py-4">{exam.subject}</td>
                      <td className="px-6 py-4">{exam.questionCount}</td>
                      <td className="px-6 py-4">{exam.createdAt.toLocaleDateString('mn-MN')}</td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/exams/${exam.id}/answer-key`}
                          className="text-sm font-medium text-[#8B5E3C] hover:text-[#734d31]"
                        >
                          Нээх
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 border border-dashed border-stone-200 rounded-xl bg-stone-50/50">
              <Inbox className="mx-auto mb-3 size-8 text-[#8B5E3C]" aria-hidden="true" />
              <h3 className="text-base font-bold text-stone-900">Шалгалт үүсгээгүй байна</h3>
              <p className="mt-1 text-sm text-stone-500">Энэ ангид одоогоор шалгалт үүсгээгүй байна.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
