'use client';

import React, { useState } from 'react';

interface AddStudentFormProps {
  onAddStudent: (name: string) => void;
}

export default function AddStudentForm({ onAddStudent }: AddStudentFormProps) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    onAddStudent(name.trim());
    setName(''); 
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm max-w-md">
      <h3 className="text-sm font-bold text-stone-900 mb-3">Шинэ сурагч нэмэх</h3>
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Сурагчийн бүтэн нэр"
          required
          className="flex-1 px-3 py-1.5 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5E3C] focus:border-[#8B5E3C] text-stone-900"
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="px-4 py-1.5 text-sm font-medium text-white bg-[#8B5E3C] hover:bg-[#734d31] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          Нэмэх
        </button>
      </div>
    </form>
  );
}