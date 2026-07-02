type QuestionAnswerState = {
  number: number;
  options?: Array<{ isCorrect?: boolean | null }>;
};

type StoredAnswerKey = {
  question: number;
  answer?: string | null;
};

export function isAnswerKeyReady(
  questions: QuestionAnswerState[],
  answerKeys: StoredAnswerKey[]
) {
  const fallback = new Map<number, string>();

  for (const item of answerKeys) {
    fallback.set(item.question, item.answer?.trim() ?? "");
  }

  return (
    questions.length > 0 &&
    questions.every(
      (question) =>
        question.options?.some((option) => option.isCorrect) ||
        Boolean(fallback.get(question.number))
    )
  );
}
