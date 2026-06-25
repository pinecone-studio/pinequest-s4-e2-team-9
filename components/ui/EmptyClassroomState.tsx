import Link from 'next/link';
import { FilePlus2, School } from 'lucide-react';

export default function EmptyClassroomState() {
  return (
    <div className="flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-stone-200 rounded-2xl bg-stone-50/50 max-w-md mx-auto my-8">
     
      <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center text-[#8B5E3C] mb-4">
        <School className="size-8" aria-hidden="true" />
      </div>

      <h3 className="text-lg font-bold text-stone-900 mb-1">Анги бүртгэгдээгүй байна</h3>
      <p className="text-sm text-stone-500 mb-6">
        Шалгалт үүсгэхийн өмнө анги болон сурагчдын нэрийг нэмнэ үү.
      </p>

    
      <Link
        href="/classrooms/new"
        className="px-4 py-2.5 text-sm font-medium text-white bg-[#8B5E3C] rounded-lg hover:bg-[#734d31] transition-all duration-200 inline-flex items-center gap-2 shadow-sm"
      >
        <FilePlus2 className="size-4" aria-hidden="true" />
        Шинэ анги үүсгэх
      </Link>
    </div>
  );
}
