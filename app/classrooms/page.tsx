import React from 'react';
import Link from 'next/link';
import ClassroomCard from '../../components/ui/ClassroomCard';
import EmptyClassroomState from '../../components/ui/EmptyClassroomState';
import { mockClassrooms } from '../../constants/mockData';

export default function ClassroomsPage() {
 
  const hasClassrooms = mockClassrooms.length > 0;

  return (
    <div className="min-h-screen bg-stone-50/30 p-8">
  
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-stone-100 pb-6">
          <div>
            <h1 className="text-3xl font-bold text-stone-900 tracking-tight mb-2">Ангиуд</h1>
            <p className="text-stone-500 max-w-2xl">
              Сурагчдын жагсаалтаа анги бүрээр хадгалж, дараагийн шалгалтуудад дахин ашиглана.
            </p>
          </div>
          
        
          <Link
            href="/classrooms/new"
            className="bg-[#8B5E3C] hover:bg-[#734d31] text-white px-5 py-2.5 rounded-lg font-medium text-sm inline-flex items-center gap-2 self-start md:self-center shadow-sm transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Шинэ анги үүсгэх
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {hasClassrooms ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockClassrooms.map((classroom) => (
              <ClassroomCard key={classroom.id} classroom={classroom} />
            ))}
          </div>
        ) : (
          <EmptyClassroomState />
        )}
      </div>
    </div>
  );
}