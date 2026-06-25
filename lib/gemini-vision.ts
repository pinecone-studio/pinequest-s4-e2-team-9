import { GoogleGenerativeAI } from "@google/generative-ai";

type Confidence = "low" | "medium" | "high";

export type ExamMaterialAnalysis = {
  questionCount: number | null;
  notes: string;
  confidence: Confidence;
};

const manualFallback: ExamMaterialAnalysis = {
  questionCount: null,
  notes: "Асуултын тоог гараар баталгаажуулна уу.",
  confidence: "low",
};

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
      notes: "GEMINI_API_KEY тохируулаагүй тул асуултын тоог гараар баталгаажуулна уу.",
    };
  }

  if (!file.type.startsWith("image/")) {
    return {
      ...manualFallback,
      notes: "Энэ эхний хувилбарт AI зөвхөн зургийн файлыг уншина. PDF бол асуултын тоог гараар баталгаажуулна уу.",
    };
  }

  try {
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });
    const image = Buffer.from(await file.arrayBuffer()).toString("base64");
    const result = await model.generateContent(
      [
        {
          text: 'Шалгалтын материалыг уншаад зөвхөн JSON буцаа: {"questionCount": number | null, "notes": string, "confidence": "low" | "medium" | "high"}.',
        },
        {
          inlineData: {
            data: image,
            mimeType: file.type,
          },
        },
      ],
      { timeout: 5000 }
    );

    return parseAnalysis(result.response.text());
  } catch {
    return {
      ...manualFallback,
      notes: "AI уншилт амжилтгүй боллоо. Асуултын тоог гараар баталгаажуулна уу.",
    };
  }
}

function parseAnalysis(raw: string): ExamMaterialAnalysis {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const questionCount =
      typeof value.questionCount === "number" &&
      Number.isInteger(value.questionCount) &&
      value.questionCount > 0
        ? value.questionCount
        : null;
    const confidence =
      value.confidence === "medium" || value.confidence === "high"
        ? value.confidence
        : "low";

    return {
      questionCount,
      notes:
        typeof value.notes === "string" && value.notes.trim()
          ? value.notes.trim()
          : manualFallback.notes,
      confidence,
    };
  } catch {
    return manualFallback;
  }
}
