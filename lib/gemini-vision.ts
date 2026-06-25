import "server-only";
import { GoogleGenerativeAI, type GenerativeModel, type Part } from "@google/generative-ai";

type Confidence = "low" | "medium" | "high";

export type ExamMaterialQuestion = {
  number: number;
  text: string;
  points?: number;
  correctLabel?: string | null;
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
Extract only visible text from the image.
Keep notes under 120 characters.
Do not repeat dotted blank lines.
If question text contains many dots like "................", replace them with "____".
Never output more than 3 consecutive dots.
Keep question text compact.
Do not guess correct answer.
correctLabel must come only from printed "Зөв хариу X"; otherwise null.
Preserve option labels exactly.
Prefer object root with this shape: {"questionCount":number,"confidence":"low"|"medium"|"high","notes":string,"questions":[{"number":number,"text":string,"points":number,"correctLabel":string|null,"options":[{"label":string,"text":string}]}]}`;

const compactRetryPrompt = `Return the same exam structure as VALID COMPACT JSON only. No markdown. No explanation. If unsure, omit unreadable questions. Keep notes under 120 characters. correctLabel only from printed "Зөв хариу X".`;

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

  if (file.type === "application/pdf") {
    return {
      ...manualFallback,
      notes: "PDF файлын автомат уншилтыг дараагийн хувилбарт сайжруулна. Одоогоор асуултын бүтцийг гараар баталгаажуулна.",
    };
  }

  if (!file.type.startsWith("image/")) {
    return {
      ...manualFallback,
      notes: "Зөвхөн зургийн файлыг AI уншина. Асуултын бүтцийг гараар баталгаажуулна уу.",
    };
  }

  const image = Buffer.from(await file.arrayBuffer()).toString("base64");
  const imagePart: Part = {
    inlineData: {
      data: image,
      mimeType: file.type || "image/jpeg",
    },
  };
  const makeParts = (prompt: string): Part[] => [{ text: prompt }, imagePart];
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
  const points =
    typeof item.points === "number" && Number.isFinite(item.points) && item.points > 0
      ? item.points
      : extractPoints(rawText) ?? 1;
  const correctLabel =
    typeof item.correctLabel === "string" && item.correctLabel.trim()
      ? item.correctLabel.trim()
      : null;
  const options = Array.isArray(item.options)
    ? item.options.map((option, optionIndex) =>
        parseOption(option, optionIndex, correctLabel)
      ).filter(isOption)
    : [];

  return {
    number,
    text: normalizeVisibleText(rawText.replace(/^\s*\d+[\).:-]?\s*/, "")),
    points,
    correctLabel,
    options,
  };
}

function parseOption(
  value: unknown,
  index: number,
  correctLabel: string | null
): ExamMaterialQuestion["options"][number] | null {
  if (Array.isArray(value)) {
    const label = value[0] == null ? "" : String(value[0]);
    const text = normalizeVisibleText(value[1] == null ? "" : String(value[1]));

    return label.trim() || text
      ? {
          label: label || String(index + 1),
          text,
          isCorrect: labelsMatch(label, correctLabel),
        }
      : null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Record<string, unknown>;

  const label = item.label == null ? "" : String(item.label);
  const text = normalizeVisibleText(typeof item.text === "string" ? item.text : "");

  return label.trim() || text
    ? {
        label: label || String(index + 1),
        text,
        isCorrect: labelsMatch(label, correctLabel),
      }
    : null;
}

function hasVisibleQuestionContent(question: ExamMaterialQuestion) {
  return (
    question.text.trim().length > 0 ||
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

function labelsMatch(label: string, correctLabel: string | null) {
  if (!correctLabel) {
    return false;
  }

  const left = label.trim();
  const right = correctLabel.trim();

  return left === right || normalizeComparableLabel(left) === normalizeComparableLabel(right);
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
