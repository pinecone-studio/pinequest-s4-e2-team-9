import "server-only";
import { GoogleGenerativeAI, type GenerativeModel, type Part } from "@google/generative-ai";
import {
  evaluateNumericExpression,
  labelsMatch,
  normalizeAnswerLabel,
  normalizeMultipleChoiceAnswer,
  normalizeMultipleChoiceOption,
  parseMatchingPairs,
  type GradingMode,
  type KeyTextItem,
  type MatchingPair,
  type QuestionType,
} from "@/lib/grading";

type Confidence = "low" | "medium" | "high";

export type ExamMaterialQuestion = {
  number: number;
  type: QuestionType;
  gradingMode: GradingMode;
  text: string;
  points?: number;
  correctAnswer?: string | null;
  correctLabel?: string | null;
  acceptedEquivalentAnswers?: string[];
  leftItems?: KeyTextItem[];
  rightItems?: KeyTextItem[];
  correctPairs?: MatchingPair[];
  options: Array<{
    label: string;
    text: string;
    isCorrect?: boolean;
  }>;
};

export type ExamMaterialAnalysis = {
  questionCount: number | null;
  notes: string;
  confidence: Confidence;
  questions: ExamMaterialQuestion[];
};

const manualFallback: ExamMaterialAnalysis = {
  questionCount: null,
  notes: "GEMINI_API_KEY тохируулаагүй тул AI уншилт хийгдсэнгүй.",
  confidence: "low",
  questions: [],
};

const defaultGeminiModel = "gemini-2.5-flash";
const jsonParseFallback: ExamMaterialAnalysis = {
  ...manualFallback,
  notes: "AI шалгалтын материалыг уншсан боловч JSON бүтэц бүрэн биш байна. Дахин оролдоно уу.",
};

const examPrompt = `Return compact JSON only. No markdown. No explanation.
Extract visible exam text and solve answers when the answer is clear from the exam.
Keep notes under 120 characters.
Do not repeat dotted blank lines.
If question text contains many dots like "................", replace them with "____".
Never output more than 3 consecutive dots.
Keep question text compact.
Support these types: MULTIPLE_CHOICE, MATCHING, SHORT_ANSWER, NUMERIC_EXPRESSION.
Use gradingMode: exact_option, matching_pairs, numeric_equivalence, short_text_manual_review.
For multiple choice, option label/key and option text must be separate.
Use Latin English option labels only: a, b, c, d.
Do not output Cyrillic option labels: а, б, в, г.
Do not translate Mongolian question text.
Do not modify formula text such as "a × b", "1/2 a × h", "a²", "2πr".
For multiple choice, correctLabel and correctAnswer must be only the Latin option key, like "a"; never include "a) 3".
For multiple choice, correctPairs must be [].
For matching questions, do not classify them as multiple choice. If the question asks to "харгалзуул", "холбо", "тохирох", or has numbered left items and lettered right items, return type MATCHING and gradingMode matching_pairs. Right item labels and correctPairs right-side labels must use Latin labels a, b, c, d. If the correct pairs are not explicitly printed, infer the correct pairs from the question content using math/domain knowledge when it is safe. Do not leave correctPairs empty when the pairs can be inferred.
For numeric expressions, compute the expected numeric answer and use gradingMode numeric_equivalence.
For unknown written text answers, use SHORT_ANSWER and gradingMode short_text_manual_review.
Preserve option text exactly.
Prefer object root with this shape: {"questionCount":number,"confidence":"low"|"medium"|"high","notes":string,"questions":[{"number":number,"type":"MULTIPLE_CHOICE","text":string,"points":number,"correctAnswer":"a","correctLabel":"a","gradingMode":"exact_option","options":[{"label":"a","text":"3"},{"label":"b","text":"2"}],"leftItems":[],"rightItems":[],"correctPairs":[]}]}`;

const compactRetryPrompt = `Return the same mixed-question exam structure as VALID COMPACT JSON only. No markdown. No explanation. If unsure, omit unreadable questions. Keep notes under 120 characters.`;

export async function analyzeExamMaterial(
  file: File | null | undefined
): Promise<ExamMaterialAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!file || file.size === 0) {
    return manualFallback;
  }

  if (!apiKey) {
    return {
      ...manualFallback,
      notes: "GEMINI_API_KEY тохируулаагүй тул AI уншилт хийгдсэнгүй.",
    };
  }

  if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
    return {
      ...manualFallback,
      notes: "Зөвхөн зураг эсвэл PDF файлыг AI уншина. Асуултын бүтцийг гараар баталгаажуулна уу.",
    };
  }

  const material = Buffer.from(await file.arrayBuffer()).toString("base64");
  const materialPart: Part = {
    inlineData: {
      data: material,
      mimeType: file.type || "image/jpeg",
    },
  };
  const makeParts = (prompt: string): Part[] => [{ text: prompt }, materialPart];
  const genAI = new GoogleGenerativeAI(apiKey);

  for (const modelName of getGeminiModels()) {
    const startedAt = Date.now();
    const startedAtIso = new Date(startedAt).toISOString();

    try {
      console.info("[gemini] model name", modelName);
      console.info("[gemini] request start timestamp", startedAtIso);

      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0,
          maxOutputTokens: 16384,
        },
      });
      const raw = await generateJson(model, makeParts(examPrompt));
      const finishedAt = Date.now();

      console.info("[gemini] request finish timestamp", new Date(finishedAt).toISOString());
      console.info("[gemini] duration ms", finishedAt - startedAt);
      console.info("[gemini] model succeeded", modelName);

      try {
        return parseAnalysis(raw);
      } catch (error) {
        logJsonParseFailure(error, raw);
        console.info("[gemini] JSON parse failed, retrying once with compact prompt");
      }

      const retryRaw = await generateJson(model, makeParts(compactRetryPrompt));

      try {
        return parseAnalysis(retryRaw);
      } catch (error) {
        logJsonParseFailure(error, retryRaw);
        return jsonParseFallback;
      }
    } catch (error) {
      const finishedAt = Date.now();

      console.info("[gemini] request finish timestamp", new Date(finishedAt).toISOString());
      console.info("[gemini] duration ms", finishedAt - startedAt);
      console.info("[gemini] model failed", modelName);
      console.info("[gemini] error name", getGeminiErrorName(error));
      console.info("[gemini] error message", getGeminiErrorMessage(error));
      console.info("[gemini] error status", getGeminiErrorStatus(error));
    }
  }

  return {
    ...manualFallback,
    notes: "AI шалгалтын материалыг унших үед алдаа гарлаа. Та асуултын бүтцийг гараар баталгаажуулна уу.",
  };
}

function getGeminiModels() {
  return [process.env.GEMINI_MODEL?.trim() || defaultGeminiModel];
}

async function generateJson(model: GenerativeModel, parts: Part[]) {
  const result = await model.generateContent(parts, { timeout: 90000 });
  const raw = result.response.text();

  console.info("[gemini] raw response first 500 chars", raw.slice(0, 500));
  console.info("[gemini] raw response length", raw.length);
  console.info("[gemini] raw response last 300 chars", raw.slice(-300));

  return raw;
}

function getGeminiErrorName(error: unknown) {
  if (error instanceof Error) {
    return error.name;
  }

  return typeof error;
}

function getGeminiErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function getGeminiErrorStatus(error: unknown) {
  if (error && typeof error === "object" && "status" in error) {
    return String(error.status);
  }

  const status = getGeminiErrorMessage(error).match(/\[(\d{3})[^\]]*\]/)?.[1];

  return status ?? "unknown";
}

function parseAnalysis(raw: string): ExamMaterialAnalysis {
  const parsed = JSON.parse(cleanJson(raw)) as unknown;
  const rootType = Array.isArray(parsed) ? "array" : "object";

  console.info("[gemini] parsed root type", rootType);

  if (Array.isArray(parsed)) {
    const questions = normalizeQuestions(parsed);

    console.info("[gemini] normalized questions length", questions.length);
    console.info("[gemini] first normalized question", questions[0]);

    return {
      questionCount: parsed.length,
      confidence: "medium",
      notes: "AI асуулт, сонголтуудыг уншсан. Багш зөв хариултыг баталгаажуулна.",
      questions,
    };
  }

  if (!isRecord(parsed)) {
    throw new Error("Gemini response JSON root was not an object or array");
  }

  const value = parsed;
  const questions = Array.isArray(value.questions)
    ? normalizeQuestions(value.questions)
    : [];
  const questionCount =
    typeof value.questionCount === "number" &&
    Number.isInteger(value.questionCount) &&
    value.questionCount > 0
      ? value.questionCount
      : questions.length || null;
  const confidence =
    value.confidence === "medium" || value.confidence === "high"
      ? value.confidence
      : "low";

  console.info("[gemini] normalized questions length", questions.length);
  console.info("[gemini] first normalized question", questions[0]);

  return {
    questionCount,
    notes:
      typeof value.notes === "string" && value.notes.trim()
        ? value.notes.trim()
        : manualFallback.notes,
    confidence,
    questions,
  };
}

function cleanJson(raw: string) {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();

  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    return trimmed;
  }

  const objectStart = trimmed.indexOf("{");
  const arrayStart = trimmed.indexOf("[");
  const useArray =
    arrayStart !== -1 && (objectStart === -1 || arrayStart < objectStart);
  const start = useArray ? arrayStart : objectStart;
  const end = useArray ? trimmed.lastIndexOf("]") : trimmed.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Gemini response did not contain complete JSON object or array");
  }

  return trimmed.slice(start, end + 1);
}

function logJsonParseFailure(error: unknown, raw: string) {
  console.error("[analyzeExamMaterial] JSON parse failed", {
    error,
    raw: raw.slice(0, 1000),
  });
}

function normalizeQuestions(values: unknown[]) {
  return values.map(parseQuestion).filter(hasVisibleQuestionContent);
}

function parseQuestion(value: unknown, index: number): ExamMaterialQuestion {
  if (!value || typeof value !== "object") {
    return {
      number: index + 1,
      type: "MULTIPLE_CHOICE",
      gradingMode: "exact_option",
      text: "",
      points: 1,
      options: [],
    };
  }

  const item = value as Record<string, unknown>;
  const rawText =
    typeof item.text === "string"
      ? item.text
      : typeof item.questionText === "string"
        ? item.questionText
        : "";
  const extractedNumber = extractLeadingQuestionNumber(rawText);
  const number =
    typeof item.number === "number" && Number.isInteger(item.number) && item.number > 0
      ? item.number
      : extractedNumber ?? index + 1;
  const rawCorrectAnswer = getCorrectAnswer(item);
  const rawOptions = Array.isArray(item.options)
    ? item.options.map((option, optionIndex) =>
        parseOption(option, optionIndex, rawCorrectAnswer)
      ).filter(isOption)
    : [];
  const leftItems = parseKeyTextItems(item.leftItems);
  const rightItems = parseKeyTextItems(item.rightItems, true);
  const parsedPairs = parsePairsArray(item.correctPairs);
  let candidatePairs = parsedPairs.length > 0 ? parsedPairs : parseMatchingPairs(rawCorrectAnswer);

  if (candidatePairs.length === 0) {
    candidatePairs = inferMatchingPairs(rawText, leftItems, rightItems);
  }

  const type = normalizeQuestionType(item, rawText, rawOptions, leftItems, rightItems, candidatePairs);
  const correctPairs = type === "MATCHING" ? candidatePairs : [];
  const gradingMode = normalizeGradingMode(item.gradingMode, type);
  const correctAnswer = getFinalCorrectAnswer({
    rawText,
    type,
    value: correctPairs.length ? formatPairs(correctPairs) : rawCorrectAnswer,
    options: rawOptions,
  });
  const rawPoints =
    typeof item.points === "number" && Number.isFinite(item.points) && item.points > 0
      ? item.points
      : extractPoints(rawText) ??
        (type === "MATCHING" ? correctPairs.length || leftItems.length || 1 : 1);
  const points =
    type === "MATCHING" && correctPairs.length > 1
      ? Math.max(rawPoints, correctPairs.length)
      : rawPoints;
  return {
    number,
    type,
    gradingMode,
    text: normalizeVisibleText(rawText.replace(/^\s*\d+[\).:-]?\s*/, "")),
    points,
    correctAnswer,
    correctLabel: type === "MULTIPLE_CHOICE" ? correctAnswer : null,
    acceptedEquivalentAnswers: parseStringArray(item.acceptedEquivalentAnswers),
    leftItems,
    rightItems,
    correctPairs,
    options: type === "MULTIPLE_CHOICE"
      ? rawOptions.map((option) => ({
          ...option,
          isCorrect: labelsMatch(option.label, correctAnswer),
        }))
      : [],
  };
}
function inferMatchingPairs(
  rawText: string,
  leftItems: KeyTextItem[],
  rightItems: KeyTextItem[]
): MatchingPair[] {
  if (!leftItems.length || !rightItems.length) {
    return [];
  }

  if (!hasMatchingInstruction(rawText)) {
    return [];
  }

  const pairs: MatchingPair[] = [];
  const usedRightKeys = new Set<string>();

  for (const leftItem of leftItems) {
    const leftMeaning = inferFormulaMeaning(leftItem.text);

    if (!leftMeaning) {
      continue;
    }

    const rightItem = rightItems.find((candidate) => {
      if (usedRightKeys.has(candidate.key)) {
        return false;
      }

      return inferFormulaMeaning(candidate.text) === leftMeaning;
    });

    if (!rightItem) {
      continue;
    }

    pairs.push({
      left: leftItem.key.trim(),
      right: normalizeMatchingRightKey(rightItem.key),
    });
    usedRightKeys.add(rightItem.key);
  }

  return pairs.length === leftItems.length ? pairs : [];
}

function inferFormulaMeaning(text: string) {
  const value = normalizeFormulaText(text);

  if (
    value.includes("квадратынталбай") ||
    value === "a2" ||
    value === "a^2" ||
    value === "a**2"
  ) {
    return "square_area";
  }

  if (
    value.includes("тойргийнурт") ||
    value.includes("2πr") ||
    value.includes("2pir") ||
    value.includes("2pi*r")
  ) {
    return "circle_circumference";
  }

  if (
    value.includes("тэгшөнцөгтийнталбай") ||
    value === "axb" ||
    value === "a*b" ||
    value === "ab"
  ) {
    return "rectangle_area";
  }

  if (
    value.includes("гурвалжныталбай") ||
    value.includes("1/2axh") ||
    value.includes("1/2*a*h") ||
    value.includes("0.5axh") ||
    value.includes("0.5*a*h")
  ) {
    return "triangle_area";
  }

  return null;
}

function normalizeFormulaText(text: string) {
  return text
    .toLowerCase()
    .replaceAll("²", "2")
    .replaceAll("×", "x")
    .replaceAll("*", "*")
    .replaceAll("½", "1/2")
    .replace(/\s+/g, "")
    .replace(/[().,]/g, "");
}

function normalizeMatchingRightKey(key: string) {
  const value = key.trim().toLowerCase().replace(/[).:\-\s]/g, "");

  if (value === "6") return "b";

  const label = normalizeAnswerLabel(value);

  if (label) {
    return label;
  }

  return key.trim();
}
function parseOption(
  value: unknown,
  index: number,
  correctLabel: string | null
): ExamMaterialQuestion["options"][number] | null {
  if (Array.isArray(value)) {
    const rawLabel = value[0] == null ? "" : String(value[0]);
    const rawText = normalizeVisibleText(value[1] == null ? "" : String(value[1]));
    const option = normalizeMultipleChoiceOption({
      label: rawLabel,
      text: rawText,
      index,
    });
    const correctKey = normalizeMultipleChoiceAnswer(correctLabel, [option]);

    return rawLabel.trim() || rawText
      ? {
          ...option,
          isCorrect: labelsMatch(option.label, correctKey),
        }
      : null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Record<string, unknown>;

  const rawLabel = getStringValue(item.label, item.key);
  const rawText = normalizeVisibleText(typeof item.text === "string" ? item.text : "");
  const option = normalizeMultipleChoiceOption({
    label: rawLabel,
    text: rawText,
    index,
  });
  const correctKey = normalizeMultipleChoiceAnswer(correctLabel, [option]);

  return rawLabel.trim() || rawText
    ? {
        ...option,
        isCorrect: labelsMatch(option.label, correctKey),
      }
    : null;
}

function hasVisibleQuestionContent(question: ExamMaterialQuestion) {
  return (
    question.text.trim().length > 0 ||
    Boolean(question.correctAnswer?.trim()) ||
    Boolean(question.leftItems?.length || question.rightItems?.length) ||
    question.options.filter(
      (option) => option.label.trim().length > 0 || option.text.trim().length > 0
    ).length >= 2
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isOption(
  option: ExamMaterialQuestion["options"][number] | null
): option is ExamMaterialQuestion["options"][number] {
  return option !== null;
}

function normalizeVisibleText(text: string) {
  return text.replace(/\.{4,}/g, "____").trim();
}

function extractLeadingQuestionNumber(text: string) {
  const match = text.match(/^\s*(\d+)[\).:-]?\s+/);
  const number = match ? Number(match[1]) : NaN;

  return Number.isInteger(number) && number > 0 ? number : null;
}

function extractPoints(text: string) {
  const match = text.match(/\/\s*(\d+(?:\.\d+)?)\s*оноо\s*\//i);
  const points = match ? Number(match[1]) : NaN;

  return Number.isFinite(points) && points > 0 ? points : null;
}

function getCorrectAnswer(item: Record<string, unknown>) {
  return getStringValue(item.correctAnswer, item.correctLabel, item.answer);
}

function getFinalCorrectAnswer({
  rawText,
  type,
  value,
  options,
}: {
  rawText: string;
  type: QuestionType;
  value: string;
  options: ExamMaterialQuestion["options"];
}) {
  if (type === "MULTIPLE_CHOICE") {
    return normalizeMultipleChoiceAnswer(value, options) || null;
  }

  if (value || type !== "NUMERIC_EXPRESSION") {
    return value || null;
  }

  const expression = rawText.split("=")[0]?.trim();
  const result = evaluateNumericExpression(expression);

  return result === null ? null : String(result);
}

function normalizeQuestionType(
  item: Record<string, unknown>,
  rawText: string,
  options: ExamMaterialQuestion["options"],
  leftItems: KeyTextItem[],
  rightItems: KeyTextItem[],
  correctPairs: MatchingPair[]
): QuestionType {
  const textLooksMatching = hasMatchingInstruction(rawText);

  if (
    item.gradingMode === "matching_pairs" ||
    correctPairs.length > 0 ||
    leftItems.length > 0 ||
    rightItems.length > 0 ||
    textLooksMatching
  ) {
    return "MATCHING";
  }

  if (
    item.type === "MULTIPLE_CHOICE" ||
    item.type === "MATCHING" ||
    item.type === "SHORT_ANSWER" ||
    item.type === "NUMERIC_EXPRESSION"
  ) {
    return item.type;
  }

  if (options.length >= 2) {
    return "MULTIPLE_CHOICE";
  }

  if (item.gradingMode === "numeric_equivalence" || (!options.length && /=/.test(rawText))) {
    return "NUMERIC_EXPRESSION";
  }

  return "SHORT_ANSWER";
}

function hasMatchingInstruction(text: string) {
  const value = text.toLowerCase();

  return (
    value.includes("харгалзуул") ||
    value.includes("холбоорой") ||
    value.includes("холбо") ||
    value.includes("тохирох") ||
    value.includes("тааруул")
  );
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

function parseStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function parseKeyTextItems(value: unknown, normalizeKey = false) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const rawKey = getStringValue(record.key, record.label);
      const key = normalizeKey ? normalizeMatchingRightKey(rawKey) : rawKey;
      const text = getStringValue(record.text, record.value);

      return key ? { key, text } : null;
    })
    .filter((item): item is KeyTextItem => item !== null);
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

        return left && right ? { left, right: normalizeMatchingRightKey(right) } : null;
      }

      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const left = getStringValue(record.left, record.key);
      const right = getStringValue(record.right, record.answer);

      return left && right ? { left, right: normalizeMatchingRightKey(right) } : null;
    })
    .filter((item): item is MatchingPair => item !== null);
}

function formatPairs(pairs: MatchingPair[]) {
  return pairs.map((pair) => `${pair.left}-${pair.right}`).join(", ");
}

function getStringValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}
