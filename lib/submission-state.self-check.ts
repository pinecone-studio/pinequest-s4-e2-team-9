import assert from "node:assert/strict";
import { decideProcessedSubmissionStatus, submissionStatuses } from "./submission-state";

const questionNumbers = [1, 2, 3, 4];
const optionLabelsByQuestion = {
  1: ["A", "B", "C", "D"],
  2: ["A", "B", "C", "D"],
  3: ["A", "B", "C", "D"],
  4: ["A", "B", "C", "D"],
};

const confident = decideProcessedSubmissionStatus({
  answerKeyReady: true,
  questionNumbers,
  optionLabelsByQuestion,
  analysis: {
    confidence: "medium",
    answers: [
      { questionNumber: 1, selectedLabel: "A", confidence: "high" },
      { questionNumber: 2, selectedLabel: null, confidence: "low" },
      { questionNumber: 3, selectedLabel: "C", confidence: "medium" },
      { questionNumber: 4, selectedLabel: "D", confidence: "medium" },
    ],
  },
});

const invalid = decideProcessedSubmissionStatus({
  answerKeyReady: true,
  questionNumbers,
  optionLabelsByQuestion,
  analysis: {
    confidence: "high",
    answers: [{ questionNumber: 1, selectedLabel: "Z", confidence: "high" }],
  },
});

const lowConfidence = decideProcessedSubmissionStatus({
  answerKeyReady: true,
  questionNumbers,
  optionLabelsByQuestion,
  analysis: {
    confidence: "low",
    answers: questionNumbers.map((questionNumber) => ({
      questionNumber,
      selectedLabel: "A",
      confidence: "high" as const,
    })),
  },
});

assert.equal(confident.status, submissionStatuses.saved);
assert.equal(invalid.status, submissionStatuses.draft);
assert.equal(lowConfidence.status, submissionStatuses.draft);
