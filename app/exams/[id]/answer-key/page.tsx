'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AnswerKeyInput from '@/components/ui/AnswerKeyInput';
import AnswerKeyPreviewTable from '@/components/ui/AnswerKeyPreviewTable';
import type { AnswerKey } from '@/lib/types';

export default function AnswerKeyPage() {
  const params = useParams();
  const examId = params.id as string;
  const [keys, setKeys] = useState<AnswerKey[]>([]);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (keys.length === 0) return;
    setSaved(true);
    alert('Хариултын түлхүүр амжилттай хадгалагдлаа!');
  };

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

        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Хариултын түлхүүр</h1>
        <p className="text-sm text-stone-500 mt-1">
          Шалгалтын зөв хариултуудыг оруулна уу.
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        <AnswerKeyInput onParsed={(parsed) => { setKeys(parsed); setSaved(false); }} />

        {keys.length > 0 && (
          <>
            <AnswerKeyPreviewTable keys={keys} />

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => { setKeys([]); setSaved(false); }}
                className="px-4 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors"
              >
                Дахин оруулах
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saved}
                className="px-5 py-2 text-sm font-medium text-white bg-[#8B5E3C] hover:bg-[#734d31] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center gap-2"
              >
                {saved ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    Хадгалсан
                  </>
                ) : (
                  'Хадгалах'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
