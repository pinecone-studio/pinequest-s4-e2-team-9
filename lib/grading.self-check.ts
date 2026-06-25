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

console.info("grading self-check ok");
