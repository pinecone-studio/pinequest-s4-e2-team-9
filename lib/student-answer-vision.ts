import "server-only";
import {
  GoogleGenerativeAI,
  SchemaType,
  type Part,
  type ResponseSchema,
} from "@google/generative-ai";
import {
  findOptionLabel,
  formatMatchingPairs,
  parseMatchingPairs,
  parseStoredAnswerKey,
} from "@/lib/grading";

type Confidence = "low" | "medium" | "high";

export type StudentAnswerSheetAnalysis = {
  confidence: Confidence;
  notes: string;
  answers: Array<{
    questionNumber: number;
    selectedLabel: string | null;
    rawAnswer?: string | null;
    normalizedAnswer?: string | null;
    confidence?: Confidence;
  }>;
};

type StudentAnswerQuestion = {
  number: number;
  options?: Array<{ label: string }>;
};

type StudentAnswerKey = {
  question?: number;
  questionNumber?: number;
  answer?: string | null;
};

const emptyAnalysis: StudentAnswerSheetAnalysis = {
  confidence: "low",
  notes: "AI уншилт амжилтгүй боллоо. Багш хариултыг гараар бөглөнө.",
  answers: [],
};

const imageTypes = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const studentAnswerResponseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    confidence: {
      type: SchemaType.STRING,
      format: "enum",
      enum: ["low", "medium", "high"],
    },
    notes: { type: SchemaType.STRING },
    answers: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          questionNumber: { type: SchemaType.INTEGER },
          selectedLabel: { type: SchemaType.STRING, nullable: true },
          rawAnswer: { type: SchemaType.STRING, nullable: true },
          normalizedAnswer: { type: SchemaType.STRING, nullable: true },
          confidence: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["low", "medium", "high"],
            nullable: true,
          },
        },
        required: ["questionNumber"],
      },
    },
  },
  required: ["confidence", "notes", "answers"],
};

export async function analyzeStudentAnswerSheet(
  file: File,
  questions: StudentAnswerQuestion[],
  answerKeys: StudentAnswerKey[]
): Promise<StudentAnswerSheetAnalysis> {
  const modelName = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const questionSpecs = buildQuestionSpecs(questions, answerKeys);

  console.info("[student-answer-vision] model name", modelName);
  console.info(
    "[student-answer-vision] material name/type/size",
    file?.name,
    file?.type,
    file?.size
  );

  try {
    if (!file || file.size === 0) {
      return { ...emptyAnalysis, notes: "Хариултын хуудасны файл хоосон байна." };
    }

    if (file.type === "application/pdf") {
      return {
        ...emptyAnalysis,
        notes: "PDF хариултын хуудсыг энэ хувилбарт уншихгүй. Зургийн файл оруулна уу.",
      };
    }

    if (!imageTypes.has(file.type)) {
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

    const imagePart: Part = {
      inlineData: {
        data: Buffer.from(await file.arrayBuffer()).toString("base64"),
        mimeType: file.type || "image/jpeg",
      },
    };
    const prompt = `You are reading a student answer sheet image for a Mongolian mixed-format exam.
Extract only the student's answer for each question. Do not grade. Do not decide correctness. Do not invent answers.
For MULTIPLE_CHOICE, selectedLabel is the marked option label.
Use Latin English answer labels only: a, b, c, d. Do not output Cyrillic labels: а, б, в, г.
For MATCHING, rawAnswer and normalizedAnswer should be pairs like "1-c, 2-d".
For NUMERIC_EXPRESSION or SHORT_ANSWER, preserve the handwritten rawAnswer; normalizedAnswer may remove spacing only.
Do not modify formula text such as "a × b", "1/2 a × h", "a²", "2πr".
The student may circle, mark, tick, underline, darken, draw matching lines, or write by hand.
Return only JSON. Do not grade. Do not decide correctness. Do not invent answers.
If not visible, selectedLabel/rawAnswer should be null.
Use the provided Latin option labels for multiple-choice questions.
Questions: ${JSON.stringify(questionSpecs)}
Expected JSON: {"confidence":"medium","notes":"string","answers":[{"questionNumber":1,"selectedLabel":"a","rawAnswer":"a","normalizedAnswer":"a","confidence":"high"},{"questionNumber":5,"rawAnswer":"1-c 2-d","normalizedAnswer":"1-c, 2-d","confidence":"medium"},{"questionNumber":6,"rawAnswer":"6/2","normalizedAnswer":"6/2","confidence":"high"}]}`;
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: studentAnswerResponseSchema,
        temperature: 0,
        maxOutputTokens: 4096,
      },
    });
    const generateStartedAt = Date.now();
    const result = await model.generateContent([{ text: prompt }, imagePart], {
      timeout: 90000,
    });
    console.info(`[submission-speed] geminiGenerateMs=${Date.now() - generateStartedAt}`);
    const raw = result.response.text();

    console.info("[student-answer-vision] raw response first 500 chars", raw.slice(0, 500));
    console.info("[student-answer-vision] raw response length", raw.length);

    const parsed = parseAnalysis(raw, questionSpecs);

    console.info(
      "[student-answer-vision] parse result",
      JSON.stringify({
        root: raw.trim().startsWith("[") ? "array" : "object",
        answers: parsed.answers.length,
        confidence: parsed.confidence,
      })
    );

    return parsed;
  } catch (error) {
    console.error("[student-answer-vision] failed", error);
    console.info("[student-answer-vision] parsed answers length", 0);
    return emptyAnalysis;
  }
}

function parseAnalysis(
  raw: string,
  questionSpecs: ReturnType<typeof buildQuestionSpecs>
): StudentAnswerSheetAnalysis {
  const parsed = JSON.parse(cleanJson(raw)) as unknown;

  if (Array.isArray(parsed)) {
    return {
      confidence: "medium",
      notes: "AI сурагчийн сонгосон хариултыг уншлаа.",
      answers: normalizeAnswers(parsed, questionSpecs),
    };
  }

  if (!isRecord(parsed)) {
    throw new Error("Gemini response JSON root was not an object or array");
  }

  return {
    confidence: normalizeConfidence(parsed.confidence) ?? "medium",
    notes:
      typeof parsed.notes === "string" && parsed.notes.trim()
        ? parsed.notes.trim()
        : "AI сурагчийн сонгосон хариултыг уншлаа.",
    answers: Array.isArray(parsed.answers)
      ? normalizeAnswers(parsed.answers, questionSpecs)
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
    throw new Error("Gemini response did not contain complete JSON object or array");
  }

  return trimmed.slice(start, end + 1);
}

function normalizeAnswers(
  values: unknown[],
  questionSpecs: ReturnType<typeof buildQuestionSpecs>
) {
  const specsByQuestion = new Map(
    questionSpecs.map((question) => [question.questionNumber, question])
  );

  return values.map((value, index) => {
    const item = isRecord(value) ? value : {};
    const questionNumber =
      typeof item.questionNumber === "number" && Number.isInteger(item.questionNumber)
        ? item.questionNumber
        : index + 1;
    const spec = specsByQuestion.get(questionNumber);
    const rawAnswer = getStringValue(item.rawAnswer, item.answer, item.selectedLabel);
    const rawNormalizedAnswer = getStringValue(
      item.normalizedAnswer,
      item.selectedLabel,
      rawAnswer
    );
    const normalizedAnswer =
      spec?.gradingMode === "matching_pairs"
        ? normalizeMatchingAnswer(rawNormalizedAnswer) || rawNormalizedAnswer
        : rawNormalizedAnswer;
    const selectedLabel =
      spec?.gradingMode === "exact_option"
        ? findOptionLabel(normalizedAnswer, spec.optionLabels)
        : normalizedAnswer || rawAnswer;
    const confidence = normalizeConfidence(item.confidence);

    return {
      questionNumber,
      selectedLabel: selectedLabel || null,
      rawAnswer: rawAnswer || selectedLabel || null,
      normalizedAnswer: normalizedAnswer || selectedLabel || null,
      ...(confidence ? { confidence } : {}),
    };
  });
}

function normalizeMatchingAnswer(value: string) {
  const pairs = parseMatchingPairs(value);

  return pairs.length ? formatMatchingPairs(pairs) : "";
}

function buildQuestionSpecs(
  questions: StudentAnswerQuestion[],
  answerKeys: StudentAnswerKey[]
) {
  const answerByQuestion = new Map(
    answerKeys.map((answer) => [
      answer.questionNumber ?? answer.question ?? 0,
      answer.answer ?? "",
    ])
  );

  return questions.map((question) => {
    const answerKey = parseStoredAnswerKey(answerByQuestion.get(question.number));

    return {
      questionNumber: question.number,
      type: answerKey.type,
      gradingMode: answerKey.gradingMode,
      optionLabels:
        question.options?.map((option) => findOptionLabel(option.label, [option.label])) ?? [],
      leftItems: answerKey.leftItems,
      rightItems: answerKey.rightItems,
    };
  });
}

function getStringValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function normalizeConfidence(value: unknown): Confidence | null {
  return value === "high" || value === "medium" || value === "low" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
