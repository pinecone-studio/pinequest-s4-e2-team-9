import assert from "node:assert/strict";
import { gradeSubmission } from "./grading";

const uploadedFiles = ["page-1.jpg", "page-2.jpg"];
const submission = { id: "submission-1", pageCount: uploadedFiles.length };
const pages = uploadedFiles.map((fileName, index) => ({
  submissionId: submission.id,
  pageNumber: index + 1,
  fileName,
}));

assert.equal(submission.pageCount, 2);
assert.equal(new Set(pages.map((page) => page.submissionId)).size, 1);
assert.deepEqual(
  pages.map((page) => page.pageNumber),
  [1, 2]
);
assert.deepEqual(
  pages
    .slice()
    .sort((left, right) => left.pageNumber - right.pageNumber)
    .map((page) => page.pageNumber),
  [1, 2]
);

const savedAnswers = Array.from({ length: 13 }, (_, index) => ({
  questionNumber: index + 1,
  selectedLabel: "A",
}));
const initialQuestions = Array.from({ length: 13 }, (_, index) => ({
  number: index + 1,
  points: 1,
  options: [{ label: "A", isCorrect: true }],
}));
const changedQuestions = initialQuestions.map((question) =>
  question.number === 1 || question.number === 2
    ? { ...question, points: 123 }
    : question
);

assert.equal(
  gradeSubmission({ questions: initialQuestions, extractedAnswers: savedAnswers }).maxScore,
  13
);
assert.equal(
  gradeSubmission({ questions: changedQuestions, extractedAnswers: savedAnswers }).maxScore,
  257
);

console.info("multi-page self-check ok");
