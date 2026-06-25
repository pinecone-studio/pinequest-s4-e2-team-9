import React from 'react';
import type { AnswerKey } from '@/lib/types';

interface AnswerKeyPreviewTableProps {
  keys: AnswerKey[];
}

export default function AnswerKeyPreviewTable({ keys }: AnswerKeyPreviewTableProps) {
  if (keys.length === 0) return null;

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-stone-900 mb-4">Хариултын түлхүүр харах</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200">
              <th className="text-left py-2.5 px-3 font-semibold text-stone-700">Асуулт</th>
              <th className="text-left py-2.5 px-3 font-semibold text-stone-700">Зөв хариулт</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr key={key.question} className="border-b border-stone-100 last:border-none hover:bg-stone-50/50">
                <td className="py-2.5 px-3 text-stone-900 font-medium">{key.question}</td>
                <td className="py-2.5 px-3">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#8B5E3C]/10 text-[#8B5E3C] font-bold text-sm">
                    {key.answer}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-stone-400 mt-3">
        Нийт {keys.length} хариулт
      </p>
    </div>
  );
}
