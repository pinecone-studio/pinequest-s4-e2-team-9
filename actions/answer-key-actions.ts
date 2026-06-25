"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

const answerOptions = new Set(["A", "B", "C", "D"]);

export async function saveAnswerKeyAction(formData: FormData) {
  const examId = String(formData.get("examId") || "").trim();

  if (!examId) {
    throw new Error("Шалгалтын ID дутуу байна.");
  }

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { questionCount: true },
  });

  if (!exam) {
    throw new Error("Шалгалт олдсонгүй.");
  }

  const answers = Array.from({ length: exam.questionCount }, (_, index) => {
    const answer = String(formData.get(`q-${index + 1}`) || "");

    if (!answerOptions.has(answer)) {
      throw new Error("Бүх асуултад A/B/C/D хариулт сонгоно уу.");
    }

    return {
      examId,
      question: index + 1,
      answer,
    };
  });

  await prisma.$transaction([
    prisma.answerKey.deleteMany({ where: { examId } }),
    prisma.answerKey.createMany({ data: answers }),
  ]);

  redirect(`/exams/${examId}/submissions`);
}
