import { createHash } from "node:crypto";
import { labelsMatch } from "@/lib/grading";

type Confidence = "low" | "medium" | "high";

type SubmissionStateRow = {
  id: string;
  status: string | null;
  score?: number | null;
  total?: number | null;
  percentage?: number | null;
  pageCount?: number | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

type SubmissionAnalysis = {
  confidence?: Confidence;
  answers: Array<{
    questionNumber: number;
    selectedLabel: string | null;
    confidence?: Confidence | number;
    needsReview?: boolean;
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

export function buildSubmissionsSignature(submissions: SubmissionStateRow[], seed = "") {
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
        numberToken(submission.pageCount),
      ].join(":")
    )
    .join("|");

  return createHash("sha1").update(`${seed}|${value}`).digest("hex");
}

export function summarizeSubmissions(submissions: SubmissionStateRow[], seed = "") {
  let active = 0;
  let completed = 0;
  let needsReview = 0;
  let failed = 0;
  let latestUpdatedAt: string | null = null;

  for (const submission of submissions) {
    const updatedAt = toDateToken(submission.updatedAt ?? submission.createdAt);

    if (updatedAt && (!latestUpdatedAt || updatedAt > latestUpdatedAt)) {
      latestUpdatedAt = updatedAt;
    }

    if (isActiveSubmissionStatus(submission.status)) {
      active += 1;
    } else if (submission.status === submissionStatuses.saved) {
      completed += 1;
    } else if (submission.status === submissionStatuses.draft) {
      needsReview += 1;
    } else if (submission.status === submissionStatuses.failed) {
      failed += 1;
    }
  }

  return {
    signature: buildSubmissionsSignature(submissions, seed),
    total: submissions.length,
    active,
    completed,
    needsReview,
    failed,
    latestUpdatedAt,
  };
}

export function buildAnswerKeySignatureSeed({
  questions,
  answerKeys,
}: {
  questions: Array<{ number: number; points?: number | null }>;
  answerKeys: Array<{ question: number; answer?: string | null }>;
}) {
  const totalPossibleScore = questions.reduce(
    (sum, question) =>
      sum +
      (typeof question.points === "number" && Number.isFinite(question.points)
        ? question.points
        : 0),
    0
  );

  return [
    numberToken(totalPossibleScore),
    questions.map((question) => `${question.number}:${numberToken(question.points)}`).join(","),
    answerKeys.map((answer) => `${answer.question}:${answer.answer ?? ""}`).join(","),
  ].join("|");
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

    if (answer.needsReview) {
      return "needs_review";
    }

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

function toConfidenceScore(confidence: Confidence | number | undefined): number | null {
  if (typeof confidence === "number" && Number.isFinite(confidence)) {
    return confidence > 1 ? confidence / 100 : confidence;
  }

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
