"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Save } from "lucide-react";
import { saveReviewedSubmissionAction } from "@/actions/submission-actions";
import LoadingSubmitButton from "@/components/ui/loading-submit-button";
import { gradeSubmission } from "@/lib/grading";

type ReviewQuestion = {
  number: number;
  text: string;
  points: number;
  answerKey: string;
  gradingMode: "exact_option" | "matching_pairs" | "numeric_equivalence" | "short_text_manual_review";
  selectedLabel: string;
  correctLabel: string;
  options: Array<{ label: string; text: string }>;
};

export default function SubmissionReviewForm({
  examId,
  submissionId,
  questions,
}: {
  examId: string;
  submissionId: string;
  questions: ReviewQuestion[];
}) {
  const [selected, setSelected] = useState<Record<number, string>>(
    Object.fromEntries(
      questions.map((question) => [question.number, question.selectedLabel])
    )
  );
  const rows = useMemo(
    () => {
      const grading = gradeSubmission({
        questions: questions.map((question) => ({
          number: question.number,
          points: question.points,
          options: question.options,
        })),
        correctAnswers: questions.map((question) => ({
          questionNumber: question.number,
          answer: question.answerKey || question.correctLabel,
        })),
        extractedAnswers: questions.map((question) => ({
          questionNumber: question.number,
          rawAnswer: selected[question.number] ?? "",
        })),
      });
      const byQuestion = new Map(
        grading.rows.map((row) => [row.questionNumber, row])
      );

      return questions.map((question) => {
        const row = byQuestion.get(question.number);

        return {
          ...question,
          selectedLabel: row?.selectedLabel ?? "",
          correctLabel: row?.correctLabel ?? question.correctLabel,
          isCorrect: row?.isCorrect ?? false,
          needsReview: row?.needsReview ?? false,
          earnedPoints: row?.earnedPoints ?? 0,
        };
      });
    },
    [questions, selected]
  );
  const totalScore = rows.reduce((sum, row) => sum + row.earnedPoints, 0);
  const maxScore = rows.reduce((sum, row) => sum + row.points, 0);
  const percentage = maxScore === 0 ? 0 : Math.round((totalScore / maxScore) * 100);

  return (
    <form action={saveReviewedSubmissionAction} className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
      <input type="hidden" name="examId" value={examId} />
      <input type="hidden" name="submissionId" value={submissionId} />
      {rows.map((row) => (
        <input
          key={row.number}
          type="hidden"
          name={`answer-${row.number}`}
          value={row.selectedLabel}
          readOnly
        />
      ))}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900">Хариулт хянах</h2>
          <p className="mt-1 text-sm text-stone-500">
            AI уншсан хариултыг засаж болно. Дүн хадгалах үед оноог дахин бодно.
          </p>
        </div>
        <div className="rounded-lg bg-amber-50 px-4 py-2 text-right text-sm font-semibold text-[#8B5E3C]">
          {formatNumber(totalScore)} / {formatNumber(maxScore)} оноо · {percentage}%
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-stone-200">
        <table className="min-w-full divide-y divide-stone-200 text-left text-sm text-stone-600">
          <thead className="bg-stone-50 text-xs font-bold uppercase tracking-wider text-stone-700">
            <tr>
              <th className="w-[42%] px-4 py-3">Асуулт</th>
              <th className="px-4 py-3">AI уншсан / сонгосон хариу</th>
              <th className="px-4 py-3">Зөв хариу</th>
              <th className="px-4 py-3">Оноо</th>
              <th className="px-4 py-3">Төлөв</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {rows.map((row) => {
              const hasUnknownSelected =
                row.selectedLabel &&
                row.options.every((option) => option.label !== row.selectedLabel);
              const isOptionQuestion = row.gradingMode === "exact_option";

              return (
                <tr key={row.number} className="align-top hover:bg-stone-50/60">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-stone-900">{row.number}-р асуулт</p>
                    <p className="mt-1 max-w-xl whitespace-pre-wrap leading-6 text-stone-600">
                      {row.text || "Асуултын текст хоосон байна."}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {isOptionQuestion ? (
                      <select
                        value={row.selectedLabel}
                        onChange={(event) =>
                          setSelected((current) => ({
                            ...current,
                            [row.number]: event.target.value,
                          }))
                        }
                        className="w-full min-w-[150px] rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-[#8B5E3C] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]"
                      >
                        <option value="">Хоосон</option>
                        {hasUnknownSelected ? (
                          <option value={row.selectedLabel}>
                            AI уншсан: {row.selectedLabel}
                          </option>
                        ) : null}
                        {row.options.map((option) => (
                          <option key={option.label} value={option.label}>
                            {option.label}
                            {option.text ? ` · ${option.text}` : ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <textarea
                        value={row.selectedLabel}
                        onChange={(event) =>
                          setSelected((current) => ({
                            ...current,
                            [row.number]: event.target.value,
                          }))
                        }
                        rows={2}
                        className="w-full min-w-[180px] rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-[#8B5E3C] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-stone-900">
                    {row.correctLabel || "Тодорхойгүй"}
                  </td>
                  <td className="px-4 py-3">
                    {formatNumber(row.earnedPoints)} / {formatNumber(row.points)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={getStatusClass(row.selectedLabel, row.isCorrect, row.needsReview)}>
                      {!row.selectedLabel
                        ? "Хоосон"
                        : row.needsReview
                          ? "Хянах"
                          : row.isCorrect
                            ? "Зөв"
                            : "Буруу"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex items-center justify-end gap-3 border-t border-stone-100 pt-5">
        <Link
          href={`/exams/${examId}/submissions`}
          className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
        >
          Буцах
        </Link>
        <LoadingSubmitButton
          loadingText="Хадгалж байна..."
          className="px-5 py-2 text-sm font-medium"
        >
          <Save className="size-4" aria-hidden="true" />
          Дүн хадгалах
        </LoadingSubmitButton>
      </div>
    </form>
  );
}

function getStatusClass(selectedLabel: string, isCorrect: boolean, needsReview: boolean) {
  if (!selectedLabel) {
    return "inline-flex rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-700";
  }

  if (needsReview) {
    return "inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800";
  }

  return isCorrect
    ? "inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800"
    : "inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800";
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
