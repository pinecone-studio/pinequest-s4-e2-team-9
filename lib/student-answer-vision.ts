import "server-only";
import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import { findOptionLabel } from "@/lib/grading";

type Confidence = "low" | "medium" | "high";

export type StudentAnswerSheetAnalysis = {
  confidence: Confidence;
  notes: string;
  answers: Array<{
    questionNumber: number;
    selectedLabel: string | null;
    sourcePageNumber?: number | null;
    confidence?: Confidence | number;
    needsReview?: boolean;
    reason?: string | null;
  }>;
};

const emptyAnalysis: StudentAnswerSheetAnalysis = {
  confidence: "low",
  notes: "AI уншилт амжилтгүй боллоо. Багш хариултыг гараар бөглөнө.",
  answers: [],
};

const imageTypes = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

export async function analyzeStudentAnswerSheet(
  file: File,
  questionNumbers: number[],
  optionLabelsByQuestion: Record<number, string[]>
): Promise<StudentAnswerSheetAnalysis> {
  return analyzeStudentAnswerPages(
    [{ file, pageNumber: 1 }],
    questionNumbers,
    optionLabelsByQuestion
  );
}

export async function analyzeStudentAnswerPages(
  pages: Array<{ file: File; pageNumber: number }>,
  questionNumbers: number[],
  optionLabelsByQuestion: Record<number, string[]>
): Promise<StudentAnswerSheetAnalysis> {
  const modelName = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const files = pages.filter((page) => page.file.size > 0);

  console.info("[student-answer-vision] model name", modelName);
  console.info(
    "[student-answer-vision] page count",
    files.length
  );

  try {
    if (files.length === 0) {
      return { ...emptyAnalysis, notes: "Хариултын хуудасны файл хоосон байна." };
    }

    if (files.some((page) => page.file.type === "application/pdf")) {
      return {
        ...emptyAnalysis,
        notes: "PDF хариултын хуудсыг энэ хувилбарт уншихгүй. Зургийн файл оруулна уу.",
      };
    }

    if (files.some((page) => !imageTypes.has(page.file.type))) {
      return {
        ...emptyAnalysis,
        notes: "Зөвхөн PNG, JPG, JPEG, WEBP зураг уншина.",
      };
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return {
        ...emptyAnalysis,
        notes: "GEMINI_API_KEY тохируулаагүй тул AI уншилт хийгдсэнгүй.",
      };
    }

    const imageParts = await Promise.all(
      files.map(async (page) => [
        { text: `Page ${page.pageNumber}` } satisfies Part,
        {
          inlineData: {
            data: Buffer.from(await page.file.arrayBuffer()).toString("base64"),
            mimeType: page.file.type || "image/jpeg",
          },
        } satisfies Part,
      ])
    );
    const prompt = `You are reading a student's multi-page answer sheet for a Mongolian multiple-choice exam.
Pages are provided in order. Extract answers across all pages as one submission.
Return one JSON object. Do not return separate objects per page.
The exam is multiple-choice A/B/C/D only for now.
Extract only the answer selected by the student for each question.
The student may circle, mark, tick, underline, darken, or otherwise indicate an option.
Return only JSON. Do not grade. Do not decide correctness. Do not invent answers.
If not visible or unclear, selectedLabel should be null and needsReview true.
Include sourcePageNumber per answer.
Use the provided valid option labels for each question. Preserve labels exactly as shown.
Questions and valid labels: ${JSON.stringify(
      questionNumbers.map((questionNumber) => ({
        questionNumber,
        optionLabels: optionLabelsByQuestion[questionNumber] ?? [],
      }))
    )}
Expected JSON: {"confidence":"medium","notes":"string","answers":[{"questionNumber":1,"selectedLabel":"B","sourcePageNumber":1,"confidence":"high","needsReview":false,"reason":null},{"questionNumber":2,"selectedLabel":null,"sourcePageNumber":1,"confidence":"low","needsReview":true,"reason":"unclear"}]}`;
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0,
        maxOutputTokens: 4096,
      },
    });
    const generateStartedAt = Date.now();
    const result = await model.generateContent(
      [{ text: prompt }, ...imageParts.flat()],
      { timeout: 90000 }
    );
    console.info(`[submission-speed] geminiGenerateMs=${Date.now() - generateStartedAt}`);
    const raw = result.response.text();

    console.info("[student-answer-vision] raw response first 500 chars", raw.slice(0, 500));

    const parsed = parseAnalysis(raw, optionLabelsByQuestion);

    console.info("[student-answer-vision] parsed answers length", parsed.answers.length);

    return parsed;
  } catch (error) {
    console.error("[student-answer-vision] failed", error);
    console.info("[student-answer-vision] parsed answers length", 0);
    return emptyAnalysis;
  }
}

function parseAnalysis(
  raw: string,
  optionLabelsByQuestion: Record<number, string[]>
): StudentAnswerSheetAnalysis {
  const parsed = JSON.parse(cleanJson(raw)) as unknown;

  if (Array.isArray(parsed)) {
    return {
      confidence: "medium",
      notes: "AI сурагчийн сонгосон хариултыг уншлаа.",
      answers: normalizeAnswers(parsed, optionLabelsByQuestion),
    };
  }

  if (!isRecord(parsed)) {
    return emptyAnalysis;
  }

  return {
    confidence: normalizeConfidence(parsed.confidence) ?? "medium",
    notes:
      typeof parsed.notes === "string" && parsed.notes.trim()
        ? parsed.notes.trim()
        : "AI сурагчийн сонгосон хариултыг уншлаа.",
    answers: Array.isArray(parsed.answers)
      ? normalizeAnswers(parsed.answers, optionLabelsByQuestion)
      : [],
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
  const useArray = arrayStart !== -1 && (objectStart === -1 || arrayStart < objectStart);
  const start = useArray ? arrayStart : objectStart;
  const end = useArray ? trimmed.lastIndexOf("]") : trimmed.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return "[]";
  }

  return trimmed.slice(start, end + 1);
}

function normalizeAnswers(
  values: unknown[],
  optionLabelsByQuestion: Record<number, string[]>
) {
  return values.map((value, index) => {
    const item = isRecord(value) ? value : {};
    const questionNumber =
      typeof item.questionNumber === "number" && Number.isInteger(item.questionNumber)
        ? item.questionNumber
        : index + 1;
    const selectedLabel =
      typeof item.selectedLabel === "string"
        ? findOptionLabel(item.selectedLabel, optionLabelsByQuestion[questionNumber] ?? [])
        : typeof item.selectedAnswer === "string"
          ? findOptionLabel(item.selectedAnswer, optionLabelsByQuestion[questionNumber] ?? [])
        : null;
    const confidence = normalizeConfidence(item.confidence);
    const numericConfidence =
      typeof item.confidence === "number" && Number.isFinite(item.confidence)
        ? item.confidence
        : null;
    const sourcePageNumber =
      typeof item.sourcePageNumber === "number" &&
      Number.isInteger(item.sourcePageNumber) &&
      item.sourcePageNumber > 0
        ? item.sourcePageNumber
        : null;

    return {
      questionNumber,
      selectedLabel: selectedLabel || null,
      sourcePageNumber,
      ...(confidence ? { confidence } : numericConfidence !== null ? { confidence: numericConfidence } : {}),
      ...(typeof item.needsReview === "boolean" ? { needsReview: item.needsReview } : {}),
      ...(typeof item.reason === "string" ? { reason: item.reason } : {}),
    };
  });
}

function normalizeConfidence(value: unknown): Confidence | null {
  return value === "high" || value === "medium" || value === "low" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
