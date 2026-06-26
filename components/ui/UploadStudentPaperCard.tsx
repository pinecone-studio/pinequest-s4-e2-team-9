'use client';

import React, { useRef, useState } from 'react';

interface UploadStudentPaperCardProps {
  onFileSelect: (file: File | null) => void;
}

export default function UploadStudentPaperCard({ onFileSelect }: UploadStudentPaperCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFileName(file ? file.name : '');
    onFileSelect(file);
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-stone-900 mb-1">Шалгалтын хуудас оруулах</h2>
      <p className="text-sm text-stone-500 mb-4">
        Сурагчийн шалгалтын хуудсыг зураг хэлбэрээр оруулна уу.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <button
        type="button"
        onClick={handleClick}
        className="w-full border-2 border-dashed border-stone-300 rounded-xl py-12 px-6 flex flex-col items-center gap-3 hover:border-[#8B5E3C] hover:bg-stone-50/50 transition-colors cursor-pointer"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-stone-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
        </svg>
        <span className="text-sm font-medium text-stone-600">Зураг оруулах</span>
        <span className="text-xs text-stone-400">PNG, JPG, JPEG</span>
      </button>

      {fileName && (
        <div className="mt-3 flex items-center gap-2 text-sm text-stone-600 bg-stone-50 rounded-lg px-3 py-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-[#8B5E3C] shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 12.75 3 3m0 0 3-3m-3 3v-7.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <span className="truncate">{fileName}</span>
        </div>
      )}
    </div>
  );
}
