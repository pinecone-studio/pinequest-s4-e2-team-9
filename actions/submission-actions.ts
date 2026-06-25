"use server";

import { prisma } from "@/lib/prisma";
import { gradeSubmission } from "@/lib/grading";
import { redirect } from "next/navigation";

export async function createSubmissionAction(
  examId: string,
  studentId: string,
  selectedAnswers: string[]
) {
  const answerKey = await prisma.answerKey.findMany({
    where: { examId },
    orderBy: { question: "asc" },
  });

  const gradingResult = gradeSubmission(
    answerKey.map((item) => ({
      question: item.question,
      answer: item.answer as "A" | "B" | "C" | "D",
    })),
    selectedAnswers.map((selected, index) => ({
      question: index + 1,
      selected: selected as "A" | "B" | "C" | "D",
    }))
  );

  await prisma.submission.create({
    data: {
      examId,
      studentId,
      score: gradingResult.score,
      total: gradingResult.total,
      percentage: gradingResult.percentage,
      answers: {
        create: gradingResult.answers,
      },
    },
  });

  redirect(`/exams/${examId}/results`);
}