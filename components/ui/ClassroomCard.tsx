import React from 'react';
import { Classroom } from '@/types';
import Link from 'next/link';

interface ClassroomCardProps {
  classroom: Classroom;
}

export default function ClassroomCard({ classroom }: ClassroomCardProps) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
      <div>
      
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-bold text-stone-900">{classroom.name}</h3>
          <span className="bg-stone-100 text-stone-700 text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
            {classroom.studentCount} сурагч
          </span>
        </div>

        <div className="space-y-3 text-sm text-stone-600 mb-6">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-stone-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            <span>{classroom.academicYear}</span>
          </div>
          
          {classroom.lastExam && (
            <div className="flex items-start gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-stone-400 mt-0.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              <div>
                <span className="text-stone-400 block text-xs">Сүүлийн шалгалт:</span>
                <span className="font-medium text-stone-700">{classroom.lastExam}</span>
              </div>
            </div>
          )}
        </div>
      </div>

   
      <div className="grid grid-cols-2 gap-3 mt-auto">
        <button className="px-4 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors">
          Засах
        </button>
        <Link 
          href={`/classrooms/${classroom.id}`}
          className="px-4 py-2 text-sm font-medium text-white bg-[#8B5E3C] rounded-lg hover:bg-[#734d31] transition-colors text-center inline-flex items-center justify-center gap-1"
        >
          Нээх 
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>
    </div>
  );
}