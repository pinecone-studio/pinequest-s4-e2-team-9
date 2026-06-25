import React from 'react';

interface DetectedAnswer {
  question: number;
  selected: string;
  correct: string;
  isCorrect: boolean;
}

interface DetectedAnswersTableProps {
  answers: DetectedAnswer[];
  totalScore?: number;
  totalPossible?: number;
}

export default function DetectedAnswersTable({ answers, totalScore, totalPossible }: DetectedAnswersTableProps) {
  if (answers.length === 0) return null;

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-stone-900 mb-1">Илрүүлсэн хариултууд</h2>
      <p className="text-sm text-stone-500 mb-4">
        AI-ийн уншсан сурагчийн хариултууд
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200">
              <th className="text-left py-2.5 px-3 font-semibold text-stone-700">Асуулт</th>
              <th className="text-left py-2.5 px-3 font-semibold text-stone-700">Сурагчийн хариулт</th>
              <th className="text-left py-2.5 px-3 font-semibold text-stone-700">Зөв хариулт</th>
              <th className="text-left py-2.5 px-3 font-semibold text-stone-700">Төлөв</th>
            </tr>
          </thead>
          <tbody>
            {answers.map((a) => (
              <tr key={a.question} className="border-b border-stone-100 last:border-none hover:bg-stone-50/50">
                <td className="py-2.5 px-3 text-stone-900 font-medium">{a.question}</td>
                <td className="py-2.5 px-3">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-stone-100 text-stone-700 font-bold text-sm">
                    {a.selected}
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#8B5E3C]/10 text-[#8B5E3C] font-bold text-sm">
                    {a.correct}
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  {a.isCorrect ? (
                    <span className="inline-flex items-center gap-1 text-sm text-green-700 bg-green-50 px-2.5 py-0.5 rounded-full font-medium">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      Зөв
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sm text-red-700 bg-red-50 px-2.5 py-0.5 rounded-full font-medium">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                      Буруу
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalScore !== undefined && totalPossible !== undefined && (
        <div className="mt-4 pt-4 border-t border-stone-200 flex items-center justify-between">
          <span className="text-sm font-semibold text-stone-700">Нийт оноо</span>
          <span className="text-lg font-bold text-[#8B5E3C]">
            {totalScore} / {totalPossible}
            <span className="text-sm text-stone-500 ml-2 font-normal">
              ({totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0}%)
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
