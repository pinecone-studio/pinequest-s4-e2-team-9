import { strict as assert } from "node:assert";
import { gradeSubmission, labelsMatch } from "./grading";

assert.equal(labelsMatch("A", "А"), true);

const result = gradeSubmission({
  questions: [
    { number: 1, points: 1.5, options: [{ label: "А", isCorrect: true }] },
    { number: 2, points: 0.5, options: [{ label: "Б", isCorrect: true }] },
  ],
  extractedAnswers: [
    { questionNumber: 1, selectedLabel: "A" },
    { questionNumber: 2, selectedLabel: "" },
  ],
});

assert.equal(result.totalScore, 1.5);
assert.equal(result.maxScore, 2);
assert.equal(result.percentage, 75);
assert.deepEqual(
  result.rows.map((row) => row.selectedLabel),
  ["А", ""]
);

const savedAnswers = Array.from({ length: 13 }, (_, index) => ({
  questionNumber: index + 1,
  selectedLabel: "A",
}));
const initialQuestions = Array.from({ length: 13 }, (_, index) => ({
  number: index + 1,
  points: 1,
  options: [
    { label: "A", isCorrect: true },
    { label: "B", isCorrect: false },
  ],
}));
const changedQuestions = initialQuestions.map((question) =>
  question.number === 1
    ? {
        ...question,
        points: 123,
        options: [
          { label: "A", isCorrect: false },
          { label: "B", isCorrect: true },
        ],
      }
    : question.number === 2
      ? { ...question, points: 123 }
      : question
);
const initialScore = gradeSubmission({
  questions: initialQuestions,
  extractedAnswers: savedAnswers,
});
const changedScore = gradeSubmission({
  questions: changedQuestions,
  extractedAnswers: savedAnswers,
});

assert.equal(initialScore.totalScore, 13);
assert.equal(initialScore.maxScore, 13);
assert.equal(changedScore.totalScore, 134);
assert.equal(changedScore.maxScore, 257);

const partialExtractionScore = gradeSubmission({
  questions: Array.from({ length: 7 }, (_, index) => ({
    number: index + 14,
    points: 1,
    options: [
      { label: "A", isCorrect: true },
      { label: "B", isCorrect: false },
    ],
  })),
  questionCount: 20,
  correctAnswers: Array.from({ length: 20 }, (_, index) => ({
    question: index + 1,
    answer: "A",
  })),
  extractedAnswers: Array.from({ length: 7 }, (_, index) => ({
    questionNumber: index + 14,
    selectedLabel: "A",
  })),
});

assert.equal(partialExtractionScore.totalScore, 7);
assert.equal(partialExtractionScore.maxScore, 20);
assert.equal(partialExtractionScore.rows.length, 20);
assert.deepEqual(
  partialExtractionScore.rows.slice(0, 13).map((row) => ({
    selectedLabel: row.selectedLabel,
    isCorrect: row.isCorrect,
  })),
  Array.from({ length: 13 }, () => ({ selectedLabel: "", isCorrect: false }))
);

console.info("grading self-check ok");
