import { strict as assert } from "node:assert";
import {
  gradeSubmission,
  labelsMatch,
  normalizeAnswerLabel,
  normalizeMultipleChoiceAnswer,
  normalizeMultipleChoiceOption,
  parseStoredAnswerKey,
  serializeStoredAnswerKey,
} from "./grading";

assert.equal(labelsMatch("A", "А"), true);
assert.equal(labelsMatch("а", "a"), true);
assert.equal(labelsMatch("б", "b"), true);
assert.equal(labelsMatch("в", "c"), true);
assert.equal(labelsMatch("г", "d"), true);
assert.equal(normalizeAnswerLabel("a"), "a");
assert.equal(normalizeAnswerLabel("A"), "a");
assert.equal(normalizeAnswerLabel("а"), "a");
assert.equal(normalizeAnswerLabel("б"), "b");
assert.equal(normalizeAnswerLabel("в"), "c");
assert.equal(normalizeAnswerLabel("г"), "d");

assert.deepEqual(normalizeMultipleChoiceOption({ label: "a) 3", text: "", index: 0 }), {
  label: "a",
  text: "3",
});
assert.deepEqual(normalizeMultipleChoiceOption({ label: "а) 3", text: "", index: 0 }), {
  label: "a",
  text: "3",
});
assert.deepEqual(normalizeMultipleChoiceOption({ label: "6) 2", text: "", index: 1 }), {
  label: "b",
  text: "2",
});
assert.deepEqual(normalizeMultipleChoiceOption({ label: "", text: "a × b", index: 0 }), {
  label: "a",
  text: "a × b",
});
assert.equal(normalizeMultipleChoiceAnswer("a) 3"), "a");
assert.equal(normalizeMultipleChoiceAnswer("а"), "a");
assert.equal(normalizeMultipleChoiceAnswer("a × b"), "a × b");
assert.equal(parseStoredAnswerKey("а").correctAnswer, "a");
assert.equal(parseStoredAnswerKey("a × b").correctAnswer, "a × b");

const malformedMultipleChoiceKey = parseStoredAnswerKey(
  JSON.stringify({
    type: "MULTIPLE_CHOICE",
    gradingMode: "exact_option",
    correctAnswer: "a) 3",
    correctPairs: [{ left: "a", right: "3" }],
  })
);

assert.equal(malformedMultipleChoiceKey.correctAnswer, "a");
assert.deepEqual(malformedMultipleChoiceKey.correctPairs, []);

const tupleMatchingKey = parseStoredAnswerKey(
  JSON.stringify({
    type: "MATCHING",
    gradingMode: "matching_pairs",
    correctPairs: [
      ["1", "а"],
      ["2", "г"],
    ],
  })
);

assert.deepEqual(tupleMatchingKey.correctPairs, [
  { left: "1", right: "a" },
  { left: "2", right: "d" },
]);

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
  ["a", ""]
);
assert.deepEqual(
  result.rows.map((row) => row.selectedStoredAnswer),
  ["a", ""]
);

const savedAnswers = Array.from({ length: 13 }, (_, index) => ({
  questionNumber: index + 1,
  selectedLabel: "a",
}));
const initialQuestions = Array.from({ length: 13 }, (_, index) => ({
  number: index + 1,
  points: 1,
  options: [
    { label: "a", isCorrect: true },
    { label: "b", isCorrect: false },
  ],
}));
const changedQuestions = initialQuestions.map((question) =>
  question.number === 1
    ? {
        ...question,
        points: 123,
        options: [
          { label: "a", isCorrect: false },
          { label: "b", isCorrect: true },
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

for (const [correctAnswer, studentAnswer, expected] of [
  ["2", "2/1", true],
  ["2", "4/2", true],
  ["3", "6/2", true],
  ["3", "15-12", true],
  ["3", "2", false],
] as const) {
  const numeric = gradeSubmission({
    questions: [{ number: 1, points: 1 }],
    correctAnswers: [
      {
        questionNumber: 1,
        answer: serializeStoredAnswerKey({
          type: "NUMERIC_EXPRESSION",
          gradingMode: "numeric_equivalence",
          correctAnswer,
        }),
      },
    ],
    extractedAnswers: [{ questionNumber: 1, rawAnswer: studentAnswer }],
  });

  assert.equal(numeric.rows[0].isCorrect, expected);
}

const matching = gradeSubmission({
  questions: [{ number: 5, points: 4 }],
  correctAnswers: [
    {
      questionNumber: 5,
      answer: serializeStoredAnswerKey({
        type: "MATCHING",
        gradingMode: "matching_pairs",
        correctAnswer: "1-c, 2-d, 3-a, 4-b",
      }),
    },
  ],
  extractedAnswers: [{ questionNumber: 5, rawAnswer: "1-в 2-г 3-а 4-б" }],
});

assert.equal(matching.totalScore, 4);
assert.equal(matching.rows[0].isCorrect, true);
assert.equal(matching.rows[0].correctLabel, "1-c, 2-d, 3-a, 4-b");
assert.equal(matching.rows[0].selectedLabel, "1-c, 2-d, 3-a, 4-b");
assert.equal(matching.rows[0].selectedStoredAnswer, "1-c, 2-d, 3-a, 4-b");

const question5Matching = parseStoredAnswerKey(
  serializeStoredAnswerKey({
    type: "MATCHING",
    gradingMode: "matching_pairs",
    correctAnswer: "1-в, 2-г, 3-а, 4-б",
    rightItems: [
      { key: "а", text: "a × b" },
      { key: "б", text: "1/2 a × h" },
      { key: "в", text: "a²" },
      { key: "г", text: "2πr" },
    ],
  })
);

assert.equal(question5Matching.correctAnswer, "1-c, 2-d, 3-a, 4-b");
assert.deepEqual(question5Matching.correctPairs, [
  { left: "1", right: "c" },
  { left: "2", right: "d" },
  { left: "3", right: "a" },
  { left: "4", right: "b" },
]);
assert.deepEqual(question5Matching.rightItems, [
  { key: "a", text: "a × b" },
  { key: "b", text: "1/2 a × h" },
  { key: "c", text: "a²" },
  { key: "d", text: "2πr" },
]);

console.info("grading self-check ok");
