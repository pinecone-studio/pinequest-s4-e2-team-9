import Link from 'next/link';
import { notFound } from 'next/navigation';
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-stone-200 pb-6 mb-8">
          <div>
            <Link
              href="/classrooms"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-[#8B5E3C] transition-colors mb-4"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
              Ангиуд руу буцах
            </Link>
            <h1 className="text-3xl font-bold text-stone-900 tracking-tight mb-1">{classroom.name}</h1>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/exams/new?classroomId=${classroom.id}`}
              className="bg-[#8B5E3C] hover:bg-[#734d31] text-white px-5 py-2.5 rounded-lg font-medium text-sm inline-flex items-center gap-2 shadow-sm transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Шалгалт үүсгэх
            </Link>
          </div>
        </div>

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
              <p className="text-sm text-stone-500">Энэ ангид одоогоор шалгалт үүсгээгүй байна.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
