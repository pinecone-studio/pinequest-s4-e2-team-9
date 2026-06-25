export type GradeQuestion = {
  number: number;
  points?: number | null;
  options?: Array<{ label: string; isCorrect?: boolean | null }>;
};

export type GradeCorrectAnswer = {
  question?: number;
  questionNumber?: number;
  answer?: string | null;
  correct?: string | null;
  correctLabel?: string | null;
};

export type GradeExtractedAnswer = {
  question?: number;
  questionNumber?: number;
  selected?: string | null;
  selectedLabel?: string | null;
};

export type GradeRow = {
  questionNumber: number;
  selectedLabel: string;
  correctLabel: string;
  isCorrect: boolean;
  earnedPoints: number;
  maxPoints: number;
};

export function gradeSubmission({
  questions,
  correctAnswers = [],
  extractedAnswers,
}: {
  questions: GradeQuestion[];
  correctAnswers?: GradeCorrectAnswer[];
  extractedAnswers: GradeExtractedAnswer[];
}) {
  const fallbackCorrect = new Map(
    correctAnswers.map((item) => [
      item.questionNumber ?? item.question ?? 0,
      item.correctLabel ?? item.correct ?? item.answer ?? "",
    ])
  );
  const selected = new Map(
    extractedAnswers.map((item) => [
      item.questionNumber ?? item.question ?? 0,
      item.selectedLabel ?? item.selected ?? "",
    ])
  );

  const rows = questions.map((question) => {
    const optionLabels = question.options?.map((option) => option.label) ?? [];
    const correctLabel = findOptionLabel(
      question.options?.find((option) => option.isCorrect)?.label ??
        fallbackCorrect.get(question.number) ??
        "",
      optionLabels
    );
    const selectedLabel = findOptionLabel(
      selected.get(question.number) ?? "",
      optionLabels
    );
    const maxPoints =
      typeof question.points === "number" && Number.isFinite(question.points) && question.points > 0
        ? question.points
        : 1;
    const isCorrect = Boolean(selectedLabel) && labelsMatch(selectedLabel, correctLabel);

    return {
      questionNumber: question.number,
      selectedLabel,
      correctLabel,
      isCorrect,
      earnedPoints: isCorrect ? maxPoints : 0,
      maxPoints,
    };
  });
  const totalScore = rows.reduce((sum, row) => sum + row.earnedPoints, 0);
  const maxScore = rows.reduce((sum, row) => sum + row.maxPoints, 0);

  return {
    rows,
    totalScore,
    maxScore,
    percentage: maxScore === 0 ? 0 : Math.round((totalScore / maxScore) * 10000) / 100,
  };
}

export function labelsMatch(left: string | null | undefined, right: string | null | undefined) {
  const leftLabel = String(left ?? "").trim();
  const rightLabel = String(right ?? "").trim();

  return (
    Boolean(leftLabel && rightLabel) &&
    (leftLabel === rightLabel ||
      normalizeComparableLabel(leftLabel) === normalizeComparableLabel(rightLabel))
  );
}

export function findOptionLabel(label: string | null | undefined, optionLabels: string[]) {
  const value = String(label ?? "").trim();

  if (!value) {
    return "";
  }

  return (
    optionLabels.find((option) => option.trim() === value) ??
    optionLabels.find((option) => labelsMatch(option, value)) ??
    value
  );
}

function normalizeComparableLabel(label: string) {
  const lookalikes: Record<string, string> = {
    A: "A",
    А: "A",
    B: "B",
    В: "B",
    C: "C",
    С: "C",
    E: "E",
    Е: "E",
    H: "H",
    Н: "H",
    P: "P",
    Р: "P",
    X: "X",
    Х: "X",
  };

  return label
    .toUpperCase()
    .replace(/[AАBВCСEЕHНPРXХ]/g, (character) => lookalikes[character] ?? character);
}
