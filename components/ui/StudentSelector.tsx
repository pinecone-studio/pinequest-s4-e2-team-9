'use client';

import React from 'react';
import type { Student } from '@/types';

interface StudentSelectorProps {
  students: Student[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export default function StudentSelector({ students, selectedId, onSelect }: StudentSelectorProps) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
      <label htmlFor="studentSelect" className="block text-sm font-semibold text-stone-700 mb-1.5">
        Сурагч сонгох
      </label>
      <select
        id="studentSelect"
        value={selectedId}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#8B5E3C] focus:border-[#8B5E3C] text-stone-900"
      >
        <option value="">-- Сурагч сонгох --</option>
        {students.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}
