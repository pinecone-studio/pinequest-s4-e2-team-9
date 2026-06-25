'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateClassroomForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [academicYear, setAcademicYear] = useState('2026 оны хичээлийн жил');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsLoading(true);

    
    setTimeout(() => {
      setIsLoading(false);
      alert(`${name} амжилттай үүсгэгдлээ! (Mock Data)`);
      
      router.push('/classrooms');
    }, 1000);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm max-w-xl mx-auto">
      <div className="space-y-5">
        
        <div>
          <label htmlFor="className" className="block text-sm font-semibold text-stone-700 mb-1.5">
            Ангийн нэр <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="className"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Жишээ нь: 10А анги, 12Б анги"
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5E3C] focus:border-[#8B5E3C] text-stone-900"
          />
        </div>

       
        <div>
          <label htmlFor="academicYear" className="block text-sm font-semibold text-stone-700 mb-1.5">
            Хичээлийн жил
          </label>
          <select
            id="academicYear"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#8B5E3C] focus:border-[#8B5E3C] text-stone-900"
          >
            <option value="2025 оны хичээлийн жил">2025 оны хичээлийн жил</option>
            <option value="2026 оны хичээлийн жил">2026 оны хичээлийн жил</option>
            <option value="2027 оны хичээлийн жил">2027 оны хичээлийн жил</option>
          </select>
        </div>

       
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
          <button
            type="button"
            onClick={() => router.push('/classrooms')}
            className="px-4 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors"
          >
            Цуцлах
          </button>
          <button
            type="submit"
            disabled={isLoading || !name.trim()}
            className="px-5 py-2 text-sm font-medium text-white bg-[#8B5E3C] hover:bg-[#734d31] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Түр хүлээнэ үү...
              </>
            ) : (
              'Анги үүсгэх'
            )}
          </button>
        </div>
      </div>
    </form>
  );
}