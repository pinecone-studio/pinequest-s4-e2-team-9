import "server-only";

import { gradeSubmission } from "@/lib/grading";
import { prisma } from "@/lib/prisma";
import { submissionStatuses } from "@/lib/submission-state";

export async function regradeExamSubmissions(examId: string) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: {
      answerKeys: {
        orderBy: { question: "asc" },
        select: { question: true, answer: true },
      },
      questions: {
        orderBy: { number: "asc" },
        select: {
          number: true,
          points: true,
          sourcePageNumber: true,
          options: {
            orderBy: { createdAt: "asc" },
            select: { label: true, isCorrect: true },
          },
        },
      },
      submissions: {
        where: {
          status: {
            notIn: [submissionStatuses.processing, submissionStatuses.failed],
          },
          answers: { some: {} },
        },
        select: {
          id: true,
          answers: {
            orderBy: { question: "asc" },
            select: { question: true, selected: true },
          },
        },
      },
    },
  });

  if (!exam || exam.questions.length === 0 || exam.submissions.length === 0) {
    return { regraded: 0 };
  }

  const updates = exam.submissions.map((submission) => ({
    submissionId: submission.id,
    grading: gradeSubmission({
      questions: exam.questions,
      correctAnswers: exam.answerKeys,
      extractedAnswers: submission.answers.map((answer) => ({
        questionNumber: answer.question,
        selectedLabel: answer.selected,
      })),
    }),
  }));

  await prisma.$transaction(
    async (tx) => {
      // ponytail: sequential writes are fine for class-size exams; batch per table if this gets slow.
      for (const update of updates) {
        await tx.submissionAnswer.deleteMany({
          where: { submissionId: update.submissionId },
        });
        await tx.submissionAnswer.createMany({
          data: update.grading.rows.map((row) => ({
            submissionId: update.submissionId,
            question: row.questionNumber,
            selected: row.selectedLabel,
            correct: row.correctLabel,
            isCorrect: row.isCorrect,
            earnedPoints: row.earnedPoints,
            maxPoints: row.maxPoints,
          })),
        });
        await tx.submission.update({
          where: { id: update.submissionId },
          data: {
            score: update.grading.totalScore,
            total: update.grading.maxScore,
            percentage: update.grading.percentage,
            gradingDetails: update.grading.rows,
          },
        });
      }
    },
    { timeout: 30000 }
  );

  return { regraded: updates.length };
}
