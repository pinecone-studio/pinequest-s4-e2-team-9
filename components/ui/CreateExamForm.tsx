'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { mockClassrooms } from '@/constants/mockData';

export default function CreateExamForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [classroomId, setClassroomId] = useState('');
  const [subject, setSubject] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  const [scorePerQuestion, setScorePerQuestion] = useState(5);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !classroomId) return;

    setIsLoading(true);

    const examId = `exam_${Date.now()}`;

    setTimeout(() => {
      setIsLoading(false);
      router.push(`/exams/${examId}/setup`);
    }, 800);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm max-w-xl mx-auto">
      <div className="space-y-5">
        <div>
          <label htmlFor="title" className="block text-sm font-semibold text-stone-700 mb-1.5">
            Шалгалтын нэр <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Жишээ нь: Unit Test 3, Midterm Exam"
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5E3C] focus:border-[#8B5E3C] text-stone-900"
          />
        </div>

        <div>
          <label htmlFor="classroom" className="block text-sm font-semibold text-stone-700 mb-1.5">
            Анги сонгох <span className="text-red-500">*</span>
          </label>
          <select
            id="classroom"
            required
            value={classroomId}
            onChange={(e) => setClassroomId(e.target.value)}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#8B5E3C] focus:border-[#8B5E3C] text-stone-900"
          >
            <option value="">-- Анги сонгох --</option>
            {mockClassrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="subject" className="block text-sm font-semibold text-stone-700 mb-1.5">
            Хичээл
          </label>
          <input
            type="text"
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Жишээ нь: Математик, Физик"
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5E3C] focus:border-[#8B5E3C] text-stone-900"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="questionCount" className="block text-sm font-semibold text-stone-700 mb-1.5">
              Асуултын тоо
            </label>
            <input
              type="number"
              id="questionCount"
              min={1}
              max={100}
              value={questionCount}
              onChange={(e) => setQuestionCount(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5E3C] focus:border-[#8B5E3C] text-stone-900"
            />
          </div>

          <div>
            <label htmlFor="scorePerQuestion" className="block text-sm font-semibold text-stone-700 mb-1.5">
              Нэг асуултын оноо
            </label>
            <input
              type="number"
              id="scorePerQuestion"
              min={1}
              max={100}
              value={scorePerQuestion}
              onChange={(e) => setScorePerQuestion(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5E3C] focus:border-[#8B5E3C] text-stone-900"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors"
          >
            Цуцлах
          </button>
          <button
            type="submit"
            disabled={isLoading || !title.trim() || !classroomId}
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
              'Шалгалт үүсгэх'
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
