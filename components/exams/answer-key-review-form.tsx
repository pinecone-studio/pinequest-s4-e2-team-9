"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { saveAnswerKeyAction } from "@/actions/answer-key-actions";
import LoadingSubmitButton from "@/components/ui/loading-submit-button";

type OptionState = {
  id: string;
  label: string;
  text: string;
  isCorrect: boolean;
};

type QuestionState = {
  id: string;
  number: number;
  text: string;
  points: number;
  options: OptionState[];
};

type AnswerKeyReviewFormProps = {
  examId: string;
  questions: QuestionState[];
  hasEmptyContent: boolean;
};

export default function AnswerKeyReviewForm({
  examId,
  questions: initialQuestions,
  hasEmptyContent,
}: AnswerKeyReviewFormProps) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [editing, setEditing] = useState<Set<string>>(new Set());
  const [isScorePanelOpen, setIsScorePanelOpen] = useState(false);
  const [selectedQuestionNumbers, setSelectedQuestionNumbers] = useState<number[]>([]);
  const [bulkScoreValue, setBulkScoreValue] = useState("");
  const [scoreMessage, setScoreMessage] = useState("");
  const [rangeStart, setRangeStart] = useState(String(initialQuestions[0]?.number ?? ""));
  const [rangeEnd, setRangeEnd] = useState(
    String(initialQuestions[initialQuestions.length - 1]?.number ?? "")
  );

  function updateQuestion(id: string, patch: Partial<QuestionState>) {
    setQuestions((current) =>
      current.map((question) =>
        question.id === id ? { ...question, ...patch } : question
      )
    );
  }

  function updateOption(questionId: string, optionId: string, patch: Partial<OptionState>) {
    setQuestions((current) =>
      current.map((question) =>
        question.id === questionId
          ? {
              ...question,
              options: question.options.map((option) =>
                option.id === optionId ? { ...option, ...patch } : option
              ),
            }
          : question
      )
    );
  }

  function setCorrectOption(questionId: string, optionId: string) {
    setQuestions((current) =>
      current.map((question) =>
        question.id === questionId
          ? {
              ...question,
              options: question.options.map((option) => ({
                ...option,
                isCorrect: option.id === optionId,
              })),
            }
          : question
      )
    );
  }

  function setQuestionEditing(id: string, isEditing: boolean) {
    setEditing((current) => {
      const next = new Set(current);

      if (isEditing) {
        next.add(id);
      } else {
        next.delete(id);
      }

      return next;
    });
  }

  function toggleQuestionSelection(number: number) {
    setSelectedQuestionNumbers((current) =>
      current.includes(number)
        ? current.filter((item) => item !== number)
        : [...current, number]
    );
  }

  function selectRange() {
    const start = Number(rangeStart);
    const end = Number(rangeEnd);

    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      setScoreMessage("Эхлэх болон дуусах асуултаа сонгоно уу.");
      return;
    }

    if (start > end) {
      setScoreMessage("Эхлэх асуулт нь дуусах асуултаас их байж болохгүй.");
      return;
    }

    setSelectedQuestionNumbers(
      questions
        .filter((question) => question.number >= start && question.number <= end)
        .map((question) => question.number)
    );
    setScoreMessage("");
  }

  function applyBulkScore() {
    if (selectedQuestionNumbers.length === 0) {
      setScoreMessage("Оноо өөрчлөх асуултаа сонгоно уу.");
      return;
    }

    const score = Number(bulkScoreValue);

    if (!Number.isFinite(score) || score <= 0) {
      setScoreMessage("Оноо 0-ээс их байх ёстой.");
      return;
    }

    setQuestions((current) =>
      current.map((question) =>
        selectedQuestionNumbers.includes(question.number)
          ? { ...question, points: score }
          : question
      )
    );
    setScoreMessage("Сонгосон асуултуудын оноо шинэчлэгдлээ.");
  }

  return (
    <form action={saveAnswerKeyAction} className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
      <input type="hidden" name="examId" value={examId} />
      {questions.map((question) => {
        const correctOption = question.options.find((option) => option.isCorrect);

        return (
          <div key={question.id}>
            <input type="hidden" name={`question-${question.id}-text`} value={question.text} readOnly />
            <input type="hidden" name={`question-${question.id}-points`} value={question.points} readOnly />
            <input type="hidden" name={`correct-${question.id}`} value={correctOption?.id ?? ""} readOnly />
            {question.options.map((option) => (
              <div key={option.id}>
                <input type="hidden" name={`option-${option.id}-label`} value={option.label} readOnly />
                <input type="hidden" name={`option-${option.id}-text`} value={option.text} readOnly />
              </div>
            ))}
          </div>
        );
      })}

      {hasEmptyContent ? (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-stone-800">
          Энэ шалгалтын асуултууд хоосон байна. AI уншилт амжилтгүй болсон эсвэл хуучин шалгалтын өгөгдөл байна. Шинэ тод зурагтай шалгалт үүсгээд дахин оролдоно уу.
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => setIsScorePanelOpen((current) => !current)}
          className="rounded-lg bg-[#8B5E3C] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#734d31]"
        >
          Оноо өөрчлөх
        </button>
        <button
          type="button"
          onClick={() => setEditing(new Set(questions.map((question) => question.id)))}
          className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
        >
          Бүгдийг засах
        </button>
      </div>

      {isScorePanelOpen ? (
        <div className="mb-6 rounded-xl border border-stone-200 bg-stone-50/70 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-stone-900">
                Оноо бөөнөөр өөрчлөх
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                Оноо нь ижил байх асуултуудаа сонгоод шинэ оноогоо оруулна.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsScorePanelOpen(false)}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
            >
              Хаах
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-stone-700">
              Сонгосон: {selectedQuestionNumbers.length} асуулт
            </span>
            <button
              type="button"
              onClick={() =>
                setSelectedQuestionNumbers(questions.map((question) => question.number))
              }
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
            >
              Бүгдийг сонгох
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedQuestionNumbers([]);
                setScoreMessage("");
              }}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
            >
              Сонголт цэвэрлэх
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-600">
                Эхлэх
              </label>
              <select
                value={rangeStart}
                onChange={(event) => setRangeStart(event.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-[#8B5E3C] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]"
              >
                {questions.map((question) => (
                  <option key={question.id} value={question.number}>
                    {question.number}-р асуулт
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-600">
                Дуусах
              </label>
              <select
                value={rangeEnd}
                onChange={(event) => setRangeEnd(event.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-[#8B5E3C] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]"
              >
                {questions.map((question) => (
                  <option key={question.id} value={question.number}>
                    {question.number}-р асуулт
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={selectRange}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
            >
              Хүрээг сонгох
            </button>
          </div>

          <div className="mt-4 max-h-[320px] space-y-2 overflow-y-auto rounded-lg border border-stone-200 bg-white p-3">
            {questions.map((question) => (
              <label
                key={question.id}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm text-stone-800 hover:bg-stone-50"
              >
                <span className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedQuestionNumbers.includes(question.number)}
                    onChange={() => toggleQuestionSelection(question.number)}
                    className="h-4 w-4 accent-[#8B5E3C]"
                  />
                  {question.number}-р асуулт
                </span>
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-[#8B5E3C]">
                  {question.points} оноо
                </span>
              </label>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <label htmlFor="bulkScoreValue" className="mb-1.5 block text-sm font-semibold text-stone-700">
                Шинэ оноо
              </label>
              <input
                id="bulkScoreValue"
                type="number"
                min="0.5"
                step="0.5"
                value={bulkScoreValue}
                onChange={(event) => setBulkScoreValue(event.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-[#8B5E3C] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]"
              />
            </div>
            <button
              type="button"
              onClick={applyBulkScore}
              className="rounded-lg bg-[#8B5E3C] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#734d31]"
            >
              Сонгосон асуултуудад хэрэглэх
            </button>
          </div>

          {scoreMessage ? (
            <p className="mt-3 text-sm font-medium text-amber-700">{scoreMessage}</p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-4">
        {questions.map((question) => {
          const isEditing = editing.has(question.id);
          const correctOption = question.options.find((option) => option.isCorrect);

          return (
            <section key={question.id} className="rounded-xl border border-stone-200 p-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold text-stone-900">
                      {question.number}-р асуулт
                    </h2>
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-[#8B5E3C]">
                      {question.points} оноо
                    </span>
                  </div>
                  {!isEditing ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-800">
                      {question.text || "Асуултын текст хоосон байна."}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setQuestionEditing(question.id, !isEditing)}
                  className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
                >
                  {isEditing ? "Болсон" : "Засах"}
                </button>
              </div>

              {isEditing ? (
                <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_160px]">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-stone-700">
                      Асуултын текст
                    </label>
                    <textarea
                      value={question.text}
                      onChange={(event) =>
                        updateQuestion(question.id, { text: event.target.value })
                      }
                      rows={2}
                      className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-[#8B5E3C] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-stone-700">
                      Оноо
                    </label>
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={question.points}
                      onChange={(event) =>
                        updateQuestion(question.id, {
                          points: Number(event.target.value),
                        })
                      }
                      className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-[#8B5E3C] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]"
                    />
                  </div>
                </div>
              ) : null}

              <div className="space-y-3">
                {question.options.map((option) => {
                  const isCorrect = correctOption?.id === option.id;

                  return (
                    <div
                      key={option.id}
                      className={`rounded-lg border p-3 ${
                        isCorrect ? "border-[#8B5E3C] bg-amber-50/70" : "border-stone-200 bg-white"
                      }`}
                    >
                      {!isEditing ? (
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex gap-3">
                            <span className="flex h-7 min-w-7 items-center justify-center rounded-full border border-stone-300 px-2 text-sm font-bold text-stone-800">
                              {option.label}
                            </span>
                            <p className="pt-1 text-sm text-stone-800">
                              {option.text || "Хариултын текст хоосон байна."}
                            </p>
                          </div>
                          {isCorrect ? (
                            <span className="rounded-full bg-[#8B5E3C] px-2.5 py-1 text-xs font-semibold text-white">
                              Зөв
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-[96px_1fr_120px]">
                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-stone-500">
                              Тэмдэг
                            </label>
                            <input
                              value={option.label}
                              onChange={(event) =>
                                updateOption(question.id, option.id, {
                                  label: event.target.value,
                                })
                              }
                              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-[#8B5E3C] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]"
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-stone-500">
                              Хариултын текст
                            </label>
                            <input
                              value={option.text}
                              onChange={(event) =>
                                updateOption(question.id, option.id, {
                                  text: event.target.value,
                                })
                              }
                              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-[#8B5E3C] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]"
                            />
                          </div>
                          <label className="flex items-end gap-2 pb-2 text-sm font-medium text-stone-700">
                            <input
                              type="radio"
                              checked={isCorrect}
                              onChange={() => setCorrectOption(question.id, option.id)}
                              className="h-4 w-4 accent-[#8B5E3C]"
                            />
                            Зөв
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {!correctOption ? (
                <p className="mt-3 text-sm font-medium text-amber-700">
                  Зөв хариулт сонгоогүй байна.
                </p>
              ) : null}
            </section>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-end gap-3 border-t border-stone-100 pt-4">
        <LoadingSubmitButton
          loadingText="Хадгалж байна..."
          className="px-5 py-2 text-sm font-medium"
        >
          <Save className="size-4" aria-hidden="true" />
          Зөв хариултыг хадгалах
        </LoadingSubmitButton>
      </div>
    </form>
  );
}
