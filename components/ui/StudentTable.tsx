'use client';

import React from 'react';
import { Student } from '@/types';

interface StudentTableProps {
  students: Student[];
  onRemoveStudent: (id: string) => void;
}

export default function StudentTable({ students, onRemoveStudent }: StudentTableProps) {
  if (students.length === 0) {
    return (
      <div className="text-center py-8 border border-dashed border-stone-200 rounded-xl bg-stone-50/50">
        <p className="text-sm text-stone-500">Энэ ангид одоогоор сурагч бүртгэгдээгүй байна.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-stone-200 rounded-xl bg-white shadow-sm">
      <table className="min-w-full divide-y divide-stone-200 text-sm text-left text-stone-600">
        <thead className="bg-stone-50 text-xs font-bold text-stone-700 uppercase tracking-wider">
          <tr>
            <th scope="col" className="px-6 py-3.5 w-16">#</th>
            <th scope="col" className="px-6 py-3.5">Сурагчийн нэр</th>
            <th scope="col" className="px-6 py-3.5 text-right w-24">Үйлдэл</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-200">
          {students.map((student, index) => (
            <tr key={student.id} className="hover:bg-stone-50/80 transition-colors">
              <td className="px-6 py-3.5 font-medium text-stone-400">{index + 1}</td>
              <td className="px-6 py-3.5 font-semibold text-stone-900">{student.name}</td>
              <td className="px-6 py-3.5 text-right">
                <button
                  onClick={() => onRemoveStudent(student.id)}
                  className="text-stone-400 hover:text-red-600 p-1 rounded transition-colors"
                  title="Устгах"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 inline">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.34 6m-4.74 0l-.34-6m4.74-3.346m-4.042 0a48.536 48.536 0 0 0-5.591.152M23 3a12.01 12.01 0 0 1-2.25.15M2 3c.553.045 1.1.089 1.64.152m5.591-.152l.542-3.342A1.25 1.25 0 0 1 11.16 0h1.68a1.25 1.25 0 0 1 1.197 1.008l.542 3.342m-7.78 0c.617-.005 1.243-.005 1.857 0m-4.23 0a24.166 24.166 0 0 1 3 0m0 0a24.166 24.166 0 0 1 3 0" />
                  </svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}