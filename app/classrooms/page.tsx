import Link from 'next/link';
import { connection } from 'next/server';
import { FilePlus2 } from 'lucide-react';
import PageHeader from '@/components/layout/page-header';
import ClassroomCard from '@/components/ui/ClassroomCard';
import EmptyClassroomState from '@/components/ui/EmptyClassroomState';
import { msSince, perfLog, perfNow } from '@/lib/perf';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/supabase/server';

export default async function ClassroomsPage() {
  const totalStartedAt = perfNow();
  await connection();

  const authStartedAt = perfNow();
  const user = await requireCurrentUser();
  const authMs = msSince(authStartedAt);
  const classroomsStartedAt = perfNow();
  const classrooms = await prisma.classroom.findMany({
    where: { ownerUserId: user.id },
    select: {
      id: true,
      name: true,
      _count: { select: { students: true, exams: true } },
      exams: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { title: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  const classroomsMs = msSince(classroomsStartedAt);
  perfLog('classrooms-page', {
    authMs,
    classroomsMs,
    totalMs: msSince(totalStartedAt),
  });

  return (
    <div className="min-h-screen bg-stone-50/30 p-8">
      <div className="max-w-7xl mx-auto">
        <PageHeader
          title="Ангиуд"
          description="Сурагчдын жагсаалтаа анги бүрээр хадгалж, дараагийн шалгалтуудад дахин ашиглана."
          actions={
            <Link
              href="/classrooms/new"
              className="inline-flex items-center gap-2 rounded-lg bg-[#8B5E3C] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#734d31]"
            >
              <FilePlus2 className="size-4" aria-hidden="true" />
              Шинэ анги үүсгэх
            </Link>
          }
        />

        {classrooms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classrooms.map((classroom) => (
              <ClassroomCard
                key={classroom.id}
                classroom={{
                  id: classroom.id,
                  name: classroom.name,
                  studentCount: classroom._count.students,
                  examCount: classroom._count.exams,
                  lastExam: classroom.exams[0]?.title,
                }}
              />
            ))}
          </div>
        ) : (
          <EmptyClassroomState />
        )}
      </div>
    </div>
  );
}
