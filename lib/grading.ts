type AnswerOption = "A" | "B" | "C" | "D";

type AnswerKeyInput = {
  question: number;
  answer: AnswerOption;
};

type StudentAnswerInput = {
  question: number;
  selected: AnswerOption;
};

export function gradeSubmission(
  answerKey: AnswerKeyInput[],
  studentAnswers: StudentAnswerInput[]
) {
  const keyMap = new Map(answerKey.map((item) => [item.question, item.answer]));

  const answers = studentAnswers.map((item) => {
    const correct = keyMap.get(item.question);

    return {
      question: item.question,
      selected: item.selected,
      correct: correct ?? "A",
      isCorrect: correct === item.selected,
    };
  });

  const score = answers.filter((item) => item.isCorrect).length;
  const total = answerKey.length;
  const percentage = total === 0 ? 0 : Math.round((score / total) * 100);

  return {
    score,
    total,
    percentage,
    answers,
  };
}