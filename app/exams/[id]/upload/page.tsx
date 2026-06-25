'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import StudentSelector from '@/components/ui/StudentSelector';
import UploadStudentPaperCard from '@/components/ui/UploadStudentPaperCard';
import DetectedAnswersTable from '@/components/ui/DetectedAnswersTable';
import SaveResultButton from '@/components/ui/SaveResultButton';
import { mockStudents } from '@/constants/mockData';

interface DetectedAnswer {
  question: number;
  selected: string;
  correct: string;
  isCorrect: boolean;
}

export default function ExamUploadPage() {
  const params = useParams();
  const examId = params.id as string;
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mockAnswers] = useState<DetectedAnswer[]>([
    { question: 1, selected: 'A', correct: 'A', isCorrect: true },
    { question: 2, selected: 'B', correct: 'C', isCorrect: false },
    { question: 3, selected: 'D', correct: 'D', isCorrect: true },
    { question: 4, selected: 'B', correct: 'B', isCorrect: true },
    { question: 5, selected: 'A', correct: 'A', isCorrect: true },
    { question: 6, selected: 'C', correct: 'C', isCorrect: true },
    { question: 7, selected: 'B', correct: 'B', isCorrect: true },
    { question: 8, selected: 'D', correct: 'D', isCorrect: true },
    { question: 9, selected: 'A', correct: 'A', isCorrect: true },
    { question: 10, selected: 'C', correct: 'C', isCorrect: true },
  ]);
  const [saved, setSaved] = useState(false);

  const correctCount = mockAnswers.filter((a) => a.isCorrect).length;
  const totalScore = correctCount * 5;
  const totalPossible = mockAnswers.length * 5;

  const handleSave = () => {
    setSaved(true);
    alert('Үр дүн амжилттай хадгалагдлаа!');
  };

  const selectedStudent = mockStudents.find((s) => s.id === selectedStudentId);

  return (
    <div className="min-h-screen bg-stone-50/30 p-8">
      <div className="max-w-2xl mx-auto mb-6">
        <Link
          href={`/exams/${examId}/setup`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-[#8B5E3C] transition-colors mb-4"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Буцах
        </Link>

        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Шалгалт оруулах</h1>
        <p className="text-sm text-stone-500 mt-1">
          Сурагчийн шалгалтын хуудсыг оруулж, дүнг тооцоолох.
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        <StudentSelector
          students={mockStudents}
          selectedId={selectedStudentId}
          onSelect={setSelectedStudentId}
        />

        {selectedStudent && (
          <>
            <UploadStudentPaperCard
              onFileSelect={setSelectedFile}
            />

            <DetectedAnswersTable
              answers={mockAnswers}
              totalScore={totalScore}
              totalPossible={totalPossible}
            />

            <SaveResultButton
              onClick={handleSave}
              disabled={saved || !selectedFile}
            />
          </>
        )}
      </div>
    </div>
  );
}
