import React from 'react';
import Link from 'next/link';

export default function EmptyClassroomState() {
  return (
    <div className="flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-stone-200 rounded-2xl bg-stone-50/50 max-w-md mx-auto my-8">
     
      <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center text-stone-400 mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
        </svg>
      </div>

      <h3 className="text-lg font-bold text-stone-900 mb-1">Одоогоор анги байхгүй байна</h3>
      <p className="text-sm text-stone-500 mb-6">
        Та сурагчдынхаа жагсаалтыг хадгалж, шалгалтын дүн уншуулахын тулд хамгийн түрүүнд анги үүсгэх шаардлагатай.
      </p>

    
      <Link
        href="/classrooms/new"
        className="px-4 py-2.5 text-sm font-medium text-white bg-[#8B5E3C] rounded-lg hover:bg-[#734d31] transition-colors inline-flex items-center gap-2 shadow-sm"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Шинэ анги үүсгэх
      </Link>
    </div>
  );
}