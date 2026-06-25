import Link from 'next/link';

type ClassroomCardData = {
  id: string;
  name: string;
  studentCount: number;
  examCount: number;
  lastExam?: string | null;
};

interface ClassroomCardProps {
  classroom: ClassroomCardData;
}

export default function ClassroomCard({ classroom }: ClassroomCardProps) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
      <div>
      
        <div className="mb-4">
          <h3 className="text-2xl font-bold text-stone-900 break-words">{classroom.name}</h3>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm mb-6">
          <div className="rounded-lg bg-stone-50 border border-stone-100 p-3">
            <p className="text-stone-500">Сурагч</p>
            <p className="text-xl font-bold text-stone-900">{classroom.studentCount}</p>
          </div>
          <div className="rounded-lg bg-stone-50 border border-stone-100 p-3">
            <p className="text-stone-500">Шалгалт</p>
            <p className="text-xl font-bold text-stone-900">{classroom.examCount}</p>
          </div>
        </div>

        {classroom.lastExam && (
          <p className="text-sm text-stone-600 mb-6">
            <span className="text-stone-400">Сүүлийн шалгалт: </span>
            <span className="font-medium text-stone-700">{classroom.lastExam}</span>
          </p>
        )}
      </div>

   
      <Link
        href={`/classrooms/${classroom.id}`}
        className="px-4 py-2 text-sm font-medium text-white bg-[#8B5E3C] rounded-lg hover:bg-[#734d31] transition-colors text-center inline-flex items-center justify-center gap-1 mt-auto"
      >
        Нээх
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
        </svg>
      </Link>
    </div>
  );
}
