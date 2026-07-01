import { createHash } from "node:crypto";
import { labelsMatch } from "@/lib/grading";

type Confidence = "low" | "medium" | "high";

type SubmissionStateRow = {
  id: string;
  status: string | null;
  score?: number | null;
  total?: number | null;
  percentage?: number | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

type SubmissionAnalysis = {
  confidence?: Confidence;
  answers: Array<{
    questionNumber: number;
    selectedLabel: string | null;
    confidence?: Confidence;
  }>;
};

export const submissionStatuses = {
  draft: "DRAFT",
  processing: "PROCESSING",
  saved: "SAVED",
  failed: "FAILED",
} as const;

const activeStatuses = new Set<string>([submissionStatuses.processing]);
const confidenceThreshold = 0.7;

export function getSubmissionStatusText(status: string | null | undefined) {
  if (status === submissionStatuses.processing) {
    return "AI уншиж байна";
  }

  if (status === submissionStatuses.failed) {
    return "Алдаа гарсан";
  }

  if (status === submissionStatuses.draft) {
    return "Хянах шаардлагатай";
  }

  if (status === submissionStatuses.saved) {
    return "Дууссан";
  }

  return status || "Тодорхойгүй";
}

export function isActiveSubmissionStatus(status: string | null | undefined) {
  return activeStatuses.has(status ?? "");
}

export function buildSubmissionsSignature(submissions: SubmissionStateRow[]) {
  const value = [...submissions]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((submission) =>
      [
        submission.id,
        submission.status ?? "",
        toDateToken(submission.updatedAt),
        numberToken(submission.score),
        numberToken(submission.total),
        numberToken(submission.percentage),
      ].join(":")
    )
    .join("|");

  return createHash("sha1").update(value).digest("hex");
}

export function summarizeSubmissions(submissions: SubmissionStateRow[]) {
  const latestUpdatedAt =
    submissions
      .map((submission) => toDateToken(submission.updatedAt ?? submission.createdAt))
      .filter(Boolean)
      .sort()
      .at(-1) || null;

  return {
    signature: buildSubmissionsSignature(submissions),
    total: submissions.length,
    active: submissions.filter((submission) => isActiveSubmissionStatus(submission.status)).length,
    completed: submissions.filter((submission) => submission.status === submissionStatuses.saved)
      .length,
    needsReview: submissions.filter((submission) => submission.status === submissionStatuses.draft)
      .length,
    failed: submissions.filter((submission) => submission.status === submissionStatuses.failed)
      .length,
    latestUpdatedAt,
  };
}

export function decideProcessedSubmissionStatus({
  analysis,
  questionNumbers,
  optionLabelsByQuestion,
  answerKeyReady,
}: {
  analysis: SubmissionAnalysis;
  questionNumbers: number[];
  optionLabelsByQuestion: Record<number, string[]>;
  answerKeyReady: boolean;
}) {
  const reviewReason = getReviewReason({
    analysis,
    questionNumbers,
    optionLabelsByQuestion,
    answerKeyReady,
  });

  return {
    status: reviewReason ? submissionStatuses.draft : submissionStatuses.saved,
    needsReview: Boolean(reviewReason),
    reviewReason,
  };
}

function getReviewReason({
  analysis,
  questionNumbers,
  optionLabelsByQuestion,
  answerKeyReady,
}: {
  analysis: SubmissionAnalysis;
  questionNumbers: number[];
  optionLabelsByQuestion: Record<number, string[]>;
  answerKeyReady: boolean;
}) {
  if (!answerKeyReady || questionNumbers.length === 0) {
    return "answer_key_not_ready";
  }

  if (analysis.answers.length === 0) {
    return "no_answers";
  }

  const expectedQuestions = new Set(questionNumbers);
  const seenQuestions = new Set<number>();

  for (const answer of analysis.answers) {
    if (!expectedQuestions.has(answer.questionNumber) || seenQuestions.has(answer.questionNumber)) {
      return "question_mismatch";
    }

    seenQuestions.add(answer.questionNumber);

    if (
      answer.selectedLabel &&
      !isValidOptionLabel(answer.selectedLabel, optionLabelsByQuestion[answer.questionNumber] ?? [])
    ) {
      return "invalid_option";
    }
  }

  if (seenQuestions.size / questionNumbers.length < confidenceThreshold) {
    return "missing_many_answers";
  }

  if (analysis.confidence === "low") {
    return "low_confidence";
  }

  const selectedConfidenceScores = analysis.answers
    .filter((answer) => answer.selectedLabel)
    .map((answer) => toConfidenceScore(answer.confidence))
    .filter((score): score is number => score !== null);
  const confidenceScore =
    selectedConfidenceScores.length > 0
      ? selectedConfidenceScores.reduce((sum, score) => sum + score, 0) /
        selectedConfidenceScores.length
      : toConfidenceScore(analysis.confidence) ?? 1;

  return confidenceScore < confidenceThreshold ? "low_confidence" : "";
}

function isValidOptionLabel(selectedLabel: string, optionLabels: string[]) {
  return optionLabels.some((optionLabel) => labelsMatch(optionLabel, selectedLabel));
}

function toConfidenceScore(confidence: Confidence | undefined): number | null {
  if (confidence === "high") {
    return 1;
  }

  if (confidence === "medium") {
    return 0.75;
  }

  if (confidence === "low") {
    return 0.4;
  }

  return null;
}

function toDateToken(value: Date | string | null | undefined) {
  if (!value) {
    return "";
  }

  return value instanceof Date ? value.toISOString() : value;
}

function numberToken(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}
