'use client';

import React, { useState } from 'react';
import { parseAnswerKey } from '@/lib/answer-key-parser';
import type { AnswerKey } from '@/lib/types';

interface AnswerKeyInputProps {
  onParsed: (keys: AnswerKey[]) => void;
}

export default function AnswerKeyInput({ onParsed }: AnswerKeyInputProps) {
  const [raw, setRaw] = useState('');
  const [error, setError] = useState('');

  const handleParse = () => {
    setError('');
    const result = parseAnswerKey(raw);
    if (result.length === 0) {
      setError('Зөв хариултын дараалал олдсонгүй. Жишээ: 1A 2C 3D 4B 5A');
      return;
    }
    onParsed(result);
  };

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-stone-900 mb-1">Хариултын түлхүүр оруулах</h2>
      <p className="text-sm text-stone-500 mb-4">
        Асуултын дугаар болон хариултыг дараах форматаар бичнэ үү. Жишээ: <code className="bg-stone-100 px-1.5 py-0.5 rounded text-xs">1A 2C 3D 4B 5A 6C 7B 8D 9A 10C</code>
      </p>

      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="1A 2C 3D 4B 5A 6C 7B 8D 9A 10C"
        rows={3}
        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5E3C] focus:border-[#8B5E3C] text-stone-900 resize-none font-mono"
      />

      {error && (
        <p className="text-sm text-red-600 mt-2">{error}</p>
      )}

      <button
        type="button"
        onClick={handleParse}
        disabled={!raw.trim()}
        className="mt-3 px-5 py-2 text-sm font-medium text-white bg-[#8B5E3C] hover:bg-[#734d31] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
      >
        Түлхүүр унших
      </button>
    </div>
  );
}
