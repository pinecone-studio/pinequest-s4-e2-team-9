export type QuestionType =
  | "MULTIPLE_CHOICE"
  | "MATCHING"
  | "SHORT_ANSWER"
  | "NUMERIC_EXPRESSION";

export type GradingMode =
  | "exact_option"
  | "matching_pairs"
  | "numeric_equivalence"
  | "short_text_manual_review";

export type MatchingPair = {
  left: string;
  right: string;
};

export type KeyTextItem = {
  key: string;
  text: string;
};

export type MultipleChoiceOption = {
  label: string;
  text: string;
};

export type ParsedAnswerKey = {
  type: QuestionType;
  gradingMode: GradingMode;
  correctAnswer: string;
  correctPairs: MatchingPair[];
  acceptedEquivalentAnswers: string[];
  leftItems: KeyTextItem[];
  rightItems: KeyTextItem[];
};

export type GradeQuestion = {
  number: number;
  points?: number | null;
  options?: Array<{ label: string; text?: string | null; isCorrect?: boolean | null }>;
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
  rawAnswer?: string | null;
  normalizedAnswer?: string | null;
};

export type GradeRow = {
  questionNumber: number;
  selectedLabel: string;
  selectedStoredAnswer: string;
  correctLabel: string;
  questionType: QuestionType;
  gradingMode: GradingMode;
  isCorrect: boolean;
  needsReview: boolean;
  earnedPoints: number;
  maxPoints: number;
};

const numericTolerance = 1e-9;
const latinOptionKeys = ["a", "b", "c", "d"];

export function normalizeAnswerLabel(value: string | null | undefined) {
  const keys: Record<string, string> = {
    a: "a",
    "а": "a",
    b: "b",
    "б": "b",
    c: "c",
    "в": "c",
    d: "d",
    "г": "d",
  };

  return keys[String(value ?? "").trim().toLowerCase()] ?? "";
}

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
      normalizeExtractedAnswer(item),
    ])
  );

  const rows = questions.map((question) => {
    const optionLabels =
      question.options?.map((option) => normalizeAnswerLabel(option.label) || option.label) ?? [];
    const rawOptionCorrect = question.options?.find((option) => option.isCorrect)?.label ?? "";
    const optionCorrect = normalizeAnswerLabel(rawOptionCorrect) || rawOptionCorrect;
    const answerKey = parseStoredAnswerKey(
      fallbackCorrect.get(question.number) || optionCorrect
    );
    const extracted = selected.get(question.number) ?? {
      rawAnswer: "",
      normalizedAnswer: "",
      storedAnswer: "",
    };
    const maxPoints =
      typeof question.points === "number" && Number.isFinite(question.points) && question.points > 0
        ? question.points
        : 1;

    return gradeQuestion(question.number, maxPoints, optionLabels, answerKey, extracted);
  });
  const totalScore = rows.reduce((sum, row) => sum + row.earnedPoints, 0);
  const maxScore = rows.reduce((sum, row) => sum + row.maxPoints, 0);

  return {
    rows,
    totalScore,
    maxScore,
    needsReview: rows.some((row) => row.needsReview),
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

  const matched =
    optionLabels.find((option) => option.trim() === value) ??
    optionLabels.find((option) => labelsMatch(option, value)) ??
    value;

  return normalizeAnswerLabel(matched) || matched;
}

export function parseStoredAnswerKey(value: string | null | undefined): ParsedAnswerKey {
  const text = String(value ?? "").trim();
  const parsed = parseJsonRecord(text);

  if (!parsed) {
    return {
      type: "MULTIPLE_CHOICE",
      gradingMode: "exact_option",
      correctAnswer: normalizeMultipleChoiceAnswer(text) || text,
      correctPairs: [],
      acceptedEquivalentAnswers: [],
      leftItems: [],
      rightItems: [],
    };
  }

  const type = normalizeQuestionType(parsed.type);
  const gradingMode = normalizeGradingMode(parsed.gradingMode, type);
  const rawCorrectAnswer = getStringValue(
    parsed.correctAnswer,
    parsed.correctLabel,
    parsed.answer
  );
  const correctAnswer =
    gradingMode === "exact_option"
      ? normalizeMultipleChoiceAnswer(rawCorrectAnswer)
      : rawCorrectAnswer;
  const parsedPairs = parsePairsArray(parsed.correctPairs);
  const correctPairs =
    gradingMode !== "matching_pairs"
      ? []
      : parsedPairs.length > 0
        ? parsedPairs
        : parseMatchingPairs(correctAnswer);

  return {
    type,
    gradingMode,
    correctAnswer:
      gradingMode === "matching_pairs"
        ? formatMatchingPairs(correctPairs) || correctAnswer
        : correctAnswer || formatMatchingPairs(correctPairs),
    correctPairs,
    acceptedEquivalentAnswers: parseStringArray(parsed.acceptedEquivalentAnswers),
    leftItems: parseKeyTextItems(parsed.leftItems),
    rightItems: parseKeyTextItems(parsed.rightItems, true),
  };
}

export function serializeStoredAnswerKey(answerKey: {
  type: QuestionType;
  gradingMode?: GradingMode;
  correctAnswer?: string | null;
  correctPairs?: MatchingPair[];
  acceptedEquivalentAnswers?: string[];
  leftItems?: KeyTextItem[];
  rightItems?: KeyTextItem[];
}) {
  const gradingMode =
    answerKey.gradingMode ?? defaultGradingModeForType(answerKey.type);
  const correctAnswer =
    gradingMode === "exact_option"
      ? normalizeMultipleChoiceAnswer(answerKey.correctAnswer)
      : String(answerKey.correctAnswer ?? "").trim();
  const correctPairs =
    gradingMode === "matching_pairs"
      ? answerKey.correctPairs?.length
        ? normalizeMatchingPairs(answerKey.correctPairs)
        : parseMatchingPairs(correctAnswer)
      : [];

  return JSON.stringify({
    type: answerKey.type,
    gradingMode,
    correctAnswer:
      gradingMode === "matching_pairs"
        ? formatMatchingPairs(correctPairs) || correctAnswer
        : correctAnswer || formatMatchingPairs(correctPairs),
    ...(correctPairs.length ? { correctPairs } : {}),
    ...(answerKey.acceptedEquivalentAnswers?.length
      ? { acceptedEquivalentAnswers: answerKey.acceptedEquivalentAnswers }
      : {}),
    ...(answerKey.leftItems?.length ? { leftItems: answerKey.leftItems } : {}),
    ...(answerKey.rightItems?.length ? { rightItems: normalizeKeyTextItems(answerKey.rightItems, true) } : {}),
  });
}

export function updateStoredAnswerKeyAnswer({
  existing,
  answer,
  type,
  gradingMode,
}: {
  existing: string | null | undefined;
  answer: string;
  type: QuestionType;
  gradingMode?: GradingMode;
}) {
  const current = parseStoredAnswerKey(existing);
  const nextMode = gradingMode ?? defaultGradingModeForType(type);

  return serializeStoredAnswerKey({
    ...current,
    type,
    gradingMode: nextMode,
    correctAnswer: answer,
    correctPairs: nextMode === "matching_pairs" ? parseMatchingPairs(answer) : current.correctPairs,
  });
}

export function formatStoredAnswerKey(value: string | null | undefined) {
  const answerKey = parseStoredAnswerKey(value);

  return answerKey.gradingMode === "matching_pairs"
    ? formatMatchingPairs(answerKey.correctPairs) || answerKey.correctAnswer
    : answerKey.correctAnswer;
}

export function formatStoredSelectedAnswer(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  const parsed = parseJsonRecord(text);

  return parsed
    ? getStringValue(parsed.rawAnswer, parsed.normalizedAnswer)
    : text;
}

export function parseMatchingPairs(value: string | null | undefined): MatchingPair[] {
  const text = String(value ?? "").trim();

  if (!text) {
    return [];
  }

  const pairs: MatchingPair[] = [];
  const pattern = /([0-9]+|[A-Za-zА-Яа-яЁёӨөҮү]+)\s*(?:->|=>|[-–—:.=)\]→➡])\s*([0-9]+|[A-Za-zА-Яа-яЁёӨөҮү]+)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    pairs.push({ left: match[1].trim(), right: normalizeMatchingRightLabel(match[2]) });
  }

  return pairs;
}

export function formatMatchingPairs(pairs: MatchingPair[]) {
  return pairs.map((pair) => `${pair.left}-${pair.right}`).join(", ");
}

function normalizeMatchingRightLabel(value: string) {
  return normalizeAnswerLabel(value) || value.trim();
}

function normalizeMatchingPairs(pairs: MatchingPair[]) {
  return pairs
    .map((pair) => ({
      left: pair.left.trim(),
      right: normalizeMatchingRightLabel(pair.right),
    }))
    .filter((pair) => pair.left && pair.right);
}

export function normalizeMultipleChoiceOption({
  label,
  text,
  index,
}: {
  label?: string | null;
  text?: string | null;
  index: number;
}): MultipleChoiceOption {
  const rawLabel = String(label ?? "").trim();
  const rawText = String(text ?? "").trim();
  const labelParts = splitMultipleChoiceLabel(rawLabel, index);
  const textParts = rawLabel ? null : splitMultipleChoiceLabel(rawText, index);
  const key =
    labelParts?.label ||
    textParts?.label ||
    normalizeMultipleChoiceOptionKey(rawLabel, index) ||
    normalizeMultipleChoiceOptionKey(rawText, index) ||
    latinOptionKeys[index] ||
    rawLabel;

  return {
    label: key,
    text: rawText || labelParts?.text || textParts?.text || "",
  };
}

export function normalizeMultipleChoiceAnswer(
  value: string | null | undefined,
  options: MultipleChoiceOption[] = []
) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return "";
  }

  const directParts = splitMultipleChoiceLabel(raw);
  const directKey = normalizeMultipleChoiceOptionKey(raw);

  if (directParts?.label || directKey) {
    return directParts?.label ?? directKey ?? "";
  }

  const leading = raw.match(/^([A-Za-zА-Яа-яЁёӨөҮү0-9])\s*(?:[\).:\-–—]\s*|\s+)(.+)$/);

  if (leading && options.length > 0) {
    const [, token, answerText] = leading;
    const indexedOption = options.find(
      (option, index) =>
        normalizeMultipleChoiceOptionKey(token, index) === option.label &&
        normalizeOptionText(option.text) === normalizeOptionText(answerText)
    );

    if (indexedOption) {
      return indexedOption.label;
    }

    const sameTextOptions = options.filter(
      (option) => normalizeOptionText(option.text) === normalizeOptionText(answerText)
    );

    if (sameTextOptions.length === 1) {
      return sameTextOptions[0].label;
    }
  }

  const sameTextOptions = options.filter(
    (option) => normalizeOptionText(option.text) === normalizeOptionText(raw)
  );

  return sameTextOptions.length === 1 ? sameTextOptions[0].label : raw;
}

export function evaluateNumericExpression(value: string | null | undefined) {
  const expression = normalizeMathExpression(value);
  let index = 0;

  if (!expression || /[^0-9+\-*/^().a-z]/i.test(expression)) {
    return null;
  }

  try {
    const result = parseExpression();

    if (index !== expression.length || !Number.isFinite(result)) {
      return null;
    }

    return result;
  } catch {
    return null;
  }

  function parseExpression(): number {
    let value = parseTerm();

    while (index < expression.length) {
      if (consume("+")) {
        value += parseTerm();
      } else if (consume("-")) {
        value -= parseTerm();
      } else {
        break;
      }
    }

    return value;
  }

  function parseTerm(): number {
    let value = parsePower();

    while (index < expression.length) {
      if (consume("*")) {
        value *= parsePower();
      } else if (consume("/")) {
        const divisor = parsePower();

        if (Math.abs(divisor) < numericTolerance) {
          throw new Error("division by zero");
        }

        value /= divisor;
      } else {
        break;
      }
    }

    return value;
  }

  function parsePower(): number {
    let value = parseUnary();

    if (consume("**") || consume("^")) {
      value = value ** parsePower();
    }

    return value;
  }

  function parseUnary(): number {
    if (consume("+")) {
      return parseUnary();
    }

    if (consume("-")) {
      return -parseUnary();
    }

    return parsePrimary();
  }

  function parsePrimary(): number {
    if (consume("sqrt")) {
      const value = consume("(") ? parseExpressionWithClosingParen() : parsePrimary();

      if (value < 0) {
        throw new Error("sqrt of negative");
      }

      return Math.sqrt(value);
    }

    if (consume("pi")) {
      return Math.PI;
    }

    if (consume("(")) {
      return parseExpressionWithClosingParen();
    }

    const match = expression.slice(index).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);

    if (!match) {
      throw new Error("expected number");
    }

    index += match[0].length;
    return Number(match[0]);
  }

  function parseExpressionWithClosingParen() {
    const value = parseExpression();

    if (!consume(")")) {
      throw new Error("expected closing paren");
    }

    return value;
  }

  function consume(token: string) {
    if (expression.startsWith(token, index)) {
      index += token.length;
      return true;
    }

    return false;
  }
}

function gradeQuestion(
  questionNumber: number,
  maxPoints: number,
  optionLabels: string[],
  answerKey: ParsedAnswerKey,
  extracted: { rawAnswer: string; normalizedAnswer: string; storedAnswer: string }
): GradeRow {
  if (answerKey.gradingMode === "matching_pairs") {
    return gradeMatching(questionNumber, maxPoints, answerKey, extracted);
  }

  if (answerKey.gradingMode === "numeric_equivalence") {
    return gradeNumeric(questionNumber, maxPoints, answerKey, extracted);
  }

  if (answerKey.gradingMode === "short_text_manual_review") {
    return gradeShortText(questionNumber, maxPoints, answerKey, extracted);
  }

  const correctLabel = findOptionLabel(answerKey.correctAnswer, optionLabels);
  const selectedLabel = findOptionLabel(
    extracted.normalizedAnswer || extracted.rawAnswer,
    optionLabels
  );
  const isCorrect = Boolean(selectedLabel) && labelsMatch(selectedLabel, correctLabel);

  return makeRow({
    questionNumber,
    maxPoints,
    answerKey,
    selectedLabel,
    selectedStoredAnswer: selectedLabel || extracted.storedAnswer,
    correctLabel,
    isCorrect,
    needsReview: false,
  });
}

function gradeMatching(
  questionNumber: number,
  maxPoints: number,
  answerKey: ParsedAnswerKey,
  extracted: { rawAnswer: string; normalizedAnswer: string; storedAnswer: string }
) {
  const correctPairs = answerKey.correctPairs;
  const selectedPairs = parseMatchingPairs(extracted.normalizedAnswer || extracted.rawAnswer);
  const selectedLabel =
    formatMatchingPairs(selectedPairs) || extracted.rawAnswer || extracted.normalizedAnswer;
  const correctCount = correctPairs.filter((correctPair) =>
    selectedPairs.some(
      (selectedPair) =>
        labelsMatch(selectedPair.left, correctPair.left) &&
        labelsMatch(selectedPair.right, correctPair.right)
    )
  ).length;
  const earnedPoints =
    correctPairs.length === 0
      ? 0
      : Math.round((maxPoints / correctPairs.length) * correctCount * 1000) / 1000;

  return makeRow({
    questionNumber,
    maxPoints,
    answerKey,
    selectedLabel,
    selectedStoredAnswer: selectedPairs.length ? selectedLabel : extracted.storedAnswer,
    correctLabel: formatMatchingPairs(correctPairs) || answerKey.correctAnswer,
    isCorrect: correctPairs.length > 0 && correctCount === correctPairs.length,
    needsReview: Boolean(selectedLabel && selectedPairs.length === 0),
    earnedPoints,
  });
}

function gradeNumeric(
  questionNumber: number,
  maxPoints: number,
  answerKey: ParsedAnswerKey,
  extracted: { rawAnswer: string; normalizedAnswer: string; storedAnswer: string }
) {
  const selectedLabel = extracted.rawAnswer || extracted.normalizedAnswer;
  const selectedValue = evaluateNumericExpression(selectedLabel);
  const candidates = [answerKey.correctAnswer, ...answerKey.acceptedEquivalentAnswers].filter(Boolean);
  const candidateValues = candidates.map(evaluateNumericExpression);
  const exactMatch = candidates.some(
    (candidate) => normalizeMathExpression(candidate) === normalizeMathExpression(selectedLabel)
  );
  const numericMatch =
    selectedValue !== null &&
    candidateValues.some(
      (candidateValue) =>
        candidateValue !== null && Math.abs(selectedValue - candidateValue) <= numericTolerance
    );
  const isCorrect = Boolean(selectedLabel) && (exactMatch || numericMatch);

  return makeRow({
    questionNumber,
    maxPoints,
    answerKey,
    selectedLabel,
    selectedStoredAnswer: extracted.storedAnswer,
    correctLabel: answerKey.correctAnswer,
    isCorrect,
    needsReview: Boolean(
      selectedLabel &&
        !isCorrect &&
        (selectedValue === null || candidateValues.every((value) => value === null))
    ),
  });
}

function gradeShortText(
  questionNumber: number,
  maxPoints: number,
  answerKey: ParsedAnswerKey,
  extracted: { rawAnswer: string; normalizedAnswer: string; storedAnswer: string }
) {
  const selectedLabel = extracted.rawAnswer || extracted.normalizedAnswer;
  const isCorrect =
    Boolean(selectedLabel) &&
    normalizeTextAnswer(selectedLabel) === normalizeTextAnswer(answerKey.correctAnswer);

  return makeRow({
    questionNumber,
    maxPoints,
    answerKey,
    selectedLabel,
    selectedStoredAnswer: extracted.storedAnswer,
    correctLabel: answerKey.correctAnswer,
    isCorrect,
    needsReview: Boolean(selectedLabel && !isCorrect),
  });
}

function makeRow({
  questionNumber,
  maxPoints,
  answerKey,
  selectedLabel,
  selectedStoredAnswer,
  correctLabel,
  isCorrect,
  needsReview,
  earnedPoints,
}: {
  questionNumber: number;
  maxPoints: number;
  answerKey: ParsedAnswerKey;
  selectedLabel: string;
  selectedStoredAnswer: string;
  correctLabel: string;
  isCorrect: boolean;
  needsReview: boolean;
  earnedPoints?: number;
}): GradeRow {
  return {
    questionNumber,
    selectedLabel,
    selectedStoredAnswer,
    correctLabel,
    questionType: answerKey.type,
    gradingMode: answerKey.gradingMode,
    isCorrect,
    needsReview,
    earnedPoints: earnedPoints ?? (isCorrect ? maxPoints : 0),
    maxPoints,
  };
}

function normalizeExtractedAnswer(answer: GradeExtractedAnswer) {
  const stored = getStringValue(answer.rawAnswer, answer.normalizedAnswer, answer.selectedLabel, answer.selected);
  const parsed = parseJsonRecord(stored);
  const rawAnswer = getStringValue(
    answer.rawAnswer,
    parsed?.rawAnswer,
    answer.selectedLabel,
    parsed ? "" : answer.selected
  );
  const normalizedAnswer = getStringValue(
    answer.normalizedAnswer,
    parsed?.normalizedAnswer,
    answer.selectedLabel,
    parsed ? "" : answer.selected,
    rawAnswer
  );
  const storedAnswer =
    rawAnswer && normalizedAnswer && rawAnswer !== normalizedAnswer
      ? JSON.stringify({ rawAnswer, normalizedAnswer })
      : rawAnswer || normalizedAnswer;

  return {
    rawAnswer,
    normalizedAnswer,
    storedAnswer,
  };
}

function normalizeQuestionType(value: unknown): QuestionType {
  return value === "MATCHING" ||
    value === "SHORT_ANSWER" ||
    value === "NUMERIC_EXPRESSION" ||
    value === "MULTIPLE_CHOICE"
    ? value
    : "MULTIPLE_CHOICE";
}

function normalizeGradingMode(value: unknown, type: QuestionType): GradingMode {
  if (
    value === "exact_option" ||
    value === "matching_pairs" ||
    value === "numeric_equivalence" ||
    value === "short_text_manual_review"
  ) {
    return value;
  }

  return defaultGradingModeForType(type);
}

function defaultGradingModeForType(type: QuestionType): GradingMode {
  if (type === "MATCHING") {
    return "matching_pairs";
  }

  if (type === "NUMERIC_EXPRESSION") {
    return "numeric_equivalence";
  }

  if (type === "SHORT_ANSWER") {
    return "short_text_manual_review";
  }

  return "exact_option";
}

function normalizeComparableLabel(label: string) {
  const singleLetterOptions: Record<string, string> = {
    a: "A",
    A: "A",
    а: "A",
    А: "A",
    b: "B",
    B: "B",
    б: "B",
    Б: "B",
    c: "C",
    C: "C",
    в: "C",
    В: "C",
    d: "D",
    D: "D",
    г: "D",
    Г: "D",
  };
  const trimmed = label.trim();

  if (trimmed.length === 1 && singleLetterOptions[trimmed]) {
    return singleLetterOptions[trimmed];
  }

  const lookalikes: Record<string, string> = {
    A: "A",
    А: "A",
    B: "B",
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

  return trimmed
    .toUpperCase()
    .replace(/[AАBCСEЕHНPРXХ]/g, (character) => lookalikes[character] ?? character);
}

function splitMultipleChoiceLabel(value: string, index?: number) {
  const match = value
    .trim()
    .match(/^([A-Za-zА-Яа-яЁёӨөҮү0-9])\s*[\).:\]]\s*(.+)$/);

  if (!match) {
    return null;
  }

  const label = normalizeMultipleChoiceOptionKey(match[1], index);

  return label ? { label, text: match[2].trim() } : null;
}

function normalizeMultipleChoiceOptionKey(value: string | null | undefined, index?: number) {
  const token = String(value ?? "")
    .trim()
    .replace(/^[([{]\s*/, "")
    .replace(/\s*[\).:\]}]$/, "");

  if (token === "6" && index === 1) {
    return "b";
  }

  return normalizeAnswerLabel(token);
}

function normalizeOptionText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeMathExpression(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[×∙·]/g, "*")
    .replace(/[÷／]/g, "/")
    .replace(/π/g, "pi")
    .replace(/,/g, ".")
    .replace(/([0-9.)])²/g, "$1^2")
    .replace(/([0-9.)])³/g, "$1^3")
    .replace(/√\s*\(?\s*([0-9.]+)\s*\)?/g, "sqrt($1)")
    .toLowerCase();
}

function normalizeTextAnswer(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?()"'`]/g, "");
}

function parseJsonRecord(value: string): Record<string, unknown> | null {
  if (!value.trim().startsWith("{")) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function getStringValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function parseStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function parseKeyTextItems(value: unknown, normalizeKey = false) {
  if (!Array.isArray(value)) {
    return [];
  }

  return normalizeKeyTextItems(
    value
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const record = item as Record<string, unknown>;
        const key = getStringValue(record.key, record.label, record.left);
        const text = getStringValue(record.text, record.value);

        return key ? { key, text } : null;
      })
      .filter((item): item is KeyTextItem => item !== null),
    normalizeKey
  );
}

function normalizeKeyTextItems(items: KeyTextItem[], normalizeKey = false) {
  return items
    .map((item) => ({
      key: normalizeKey ? normalizeAnswerLabel(item.key) || item.key.trim() : item.key.trim(),
      text: item.text,
    }))
    .filter((item) => item.key);
}

function parsePairsArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (Array.isArray(item)) {
        const left = getStringValue(item[0]);
        const right = getStringValue(item[1]);

        return left && right ? { left, right: normalizeMatchingRightLabel(right) } : null;
      }

      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const left = getStringValue(record.left, record.key, record.question);
      const right = getStringValue(record.right, record.answer, record.value);

      return left && right ? { left, right: normalizeMatchingRightLabel(right) } : null;
    })
    .filter((item): item is MatchingPair => item !== null);
}
