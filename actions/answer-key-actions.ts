"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export async function saveAnswerKeyAction(examId: string, answers: string[]) {
  if (!answers.length) {
    throw new Error("Зөв хариулт дутуу байна.");
  }

  await prisma.answerKey.deleteMany({
    where: { examId },
  });

  await prisma.answerKey.createMany({
    data: answers.map((answer, index) => ({
      examId,
      question: index + 1,
      answer,
    })),
  });

  redirect(`/exams/${examId}/submissions`);
}