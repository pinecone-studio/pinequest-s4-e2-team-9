'use client';

import React from 'react';
import Link from 'next/link';
import { mockClassrooms, mockRecentExams } from '@/constants/mockData';

export default function DashboardPage() {
  
  const totalClasses = mockClassrooms.length;
  const totalStudents = mockClassrooms.reduce((sum, c) => sum + c.studentCount, 0);

  return (
    <div className="min-h-screen bg-stone-50/30 p-8">
      <div className="max-w-7xl mx-auto">
        
       
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-stone-200 pb-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-stone-900 tracking-tight mb-1">Сайн байна уу, Багшаа! 👋</h1>
            <p className="text-stone-500 text-sm">
              Өнөөдрийн байдлаар таны ангиуд болон шалгалтын явцын хураангуй.
            </p>
          </div>
          
        
          <div className="flex flex-wrap gap-3">
            <Link
              href="/classrooms"
              className="px-4 py-2.5 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors inline-flex items-center gap-2"
            >
              Ангиуд харах
            </Link>
            <button
              onClick={() => alert('Шинэ шалгалт үүсгэх функц (Ирээдүйд AI модуль дээр хийгдэнэ)')}
              className="bg-[#8B5E3C] hover:bg-[#734d31] text-white px-5 py-2.5 rounded-lg font-medium text-sm inline-flex items-center gap-2 shadow-sm transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Шинэ шалгалт үүсгэх
            </button>
          </div>
        </div>

        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          
          <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-stone-500 mb-1">Нийт анги</p>
              <h3 className="text-3xl font-bold text-stone-900">{totalClasses}</h3>
            </div>
            <div className="w-12 h-12 bg-amber-50 text-[#8B5E3C] rounded-xl flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
              </svg>
            </div>
          </div>

          
          <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-stone-500 mb-1">Нийт сурагч</p>
              <h3 className="text-3xl font-bold text-stone-900">{totalStudents}</h3>
            </div>
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
            </div>
          </div>

         
          <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-stone-500 mb-1">Идэвхтэй шалгалт</p>
              <h3 className="text-3xl font-bold text-stone-900">
                {mockRecentExams.filter(e => e.status === 'active').length}
              </h3>
            </div>
            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h.01a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 1 4.5 0 .75.75 0 0 0 .75.75h.01a.75.75 0 0 0 .75-.75c0-.231-.035-.454-.1-.664m-1.155 0c.065-.21.1-.433.1-.664 0-.414-.336-.75-.75-.75h-.01a.75.75 0 0 0-.75.75 2.25 2.25 0 0 1-4.5 0 .75.75 0 0 0-.75-.75h-.01a.75.75 0 0 0-.75.75c0 .231.035.454.1.664M6.75 7.5h10.5M6.75 10.5h10.5M6.75 13.5h10.5M6.75 16.5h10.5" />
              </svg>
            </div>
          </div>
        </div>

       
        <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-stone-900 mb-4">Сүүлийн шалгалтууд</h2>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-200 text-sm text-left text-stone-600">
              <thead className="bg-stone-50 text-xs font-bold text-stone-700 uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-6 py-3">Шалгалтын нэр</th>
                  <th scope="col" className="px-6 py-3">Анги</th>
                  <th scope="col" className="px-6 py-3">Хичээл</th>
                  <th scope="col" className="px-6 py-3">Явц / Гүйцэтгэл</th>
                  <th scope="col" className="px-6 py-3 text-right">Төлөв</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {mockRecentExams.map((exam) => (
                  <tr key={exam.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-stone-900">{exam.title}</td>
                    <td className="px-6 py-4">{exam.classroomName}</td>
                    <td className="px-6 py-4">{exam.subject}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-stone-800">{exam.progress}</span>
                        <div className="w-24 bg-stone-100 rounded-full h-2">
                          <div 
                            className="bg-[#8B5E3C] h-2 rounded-full" 
                            style={{ width: exam.status === 'completed' ? '100%' : '70%' }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        exam.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-stone-100 text-stone-800'
                      }`}>
                        {exam.status === 'active' ? 'Идэвхтэй' : 'Дууссан'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}