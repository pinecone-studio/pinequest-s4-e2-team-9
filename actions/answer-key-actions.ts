"use server";

import { prisma } from "@/lib/prisma";
import { isValidAnswerLabel, isValidOptionLabel } from "@/lib/answer-key-parser";
import { requireCurrentUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function saveAnswerKeyAction(formData: FormData) {
  const user = await requireCurrentUser();
  const examId = String(formData.get("examId") || "").trim();

  if (!examId) {
    throw new Error("Шалгалтын ID дутуу байна.");
  }

  const exam = await prisma.exam.findFirst({
    where: { id: examId, ownerUserId: user.id },
    include: {
      questions: {
        orderBy: { number: "asc" },
        include: {
          options: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });

  if (!exam) {
    throw new Error("Шалгалт олдсонгүй.");
  }

  if (!exam.questions.length) {
    throw new Error("Асуултын бүтэц дутуу байна.");
  }

  const questionUpdates: Array<{ id: string; text: string; points: number }> = [];
  const optionUpdates: Array<{ id: string; label: string; text: string; isCorrect: boolean }> = [];
  const answerKeys: Array<{ examId: string; question: number; answer: string }> = [];

  for (const question of exam.questions) {
    if (question.options.length < 2) {
      throw new Error("Асуулт бүр дор хаяж 2 сонголттой байх ёстой.");
    }

    const formPoints = Number(formData.get(`question-${question.id}-points`) || 0);
    const points = formPoints;
    const correctOptionId = String(formData.get(`correct-${question.id}`) || "");
    const correctOption = question.options.find((option) => option.id === correctOptionId);
    const labels = question.options.map((option) =>
      String(formData.get(`option-${option.id}-label`) || "").trim()
    );

    if (!Number.isFinite(points) || points <= 0) {
      throw new Error("Асуулт бүрийн оноо эерэг тоо байх ёстой.");
    }

    if (!correctOption) {
      throw new Error("Асуулт бүрт нэг зөв хариулт сонгоно уу.");
    }

    if (labels.some((label) => !isValidOptionLabel(label))) {
      throw new Error("Сонголтын тэмдэг хоосон байж болохгүй.");
    }

    if (new Set(labels).size !== labels.length) {
      throw new Error("Нэг асуултын сонголтын тэмдэг давхцахгүй байх ёстой.");
    }

    const correctLabel = String(formData.get(`option-${correctOption.id}-label`) || "").trim();

    if (!isValidAnswerLabel(correctLabel, labels)) {
      throw new Error("Зөв хариултын тэмдэг сонголтуудтай таарахгүй байна.");
    }

    questionUpdates.push({
      id: question.id,
      text: String(formData.get(`question-${question.id}-text`) || "").trim(),
      points,
    });

    for (const option of question.options) {
      optionUpdates.push({
        id: option.id,
        label: String(formData.get(`option-${option.id}-label`) || "").trim(),
        text: String(formData.get(`option-${option.id}-text`) || "").trim(),
        isCorrect: option.id === correctOptionId,
      });
    }

    answerKeys.push({
      examId,
      question: question.number,
      answer: correctLabel,
    });
  }

  console.info("[saveAnswerKeyAction] questions count", exam.questions.length);
  console.info("[saveAnswerKeyAction] option updates count", optionUpdates.length);
  console.info("[saveAnswerKeyAction] answer keys count", answerKeys.length);

  await prisma.$transaction(
    async (tx) => {
      await Promise.all([
        ...questionUpdates.map(({ id, ...data }) =>
          tx.examQuestion.update({
            where: { id },
            data,
          })
        ),
        ...optionUpdates.map(({ id, ...data }) =>
          tx.examOption.update({
            where: { id },
            data,
          })
        ),
      ]);

      await tx.answerKey.deleteMany({ where: { examId } });
      await tx.answerKey.createMany({ data: answerKeys });
    },
    {
      timeout: 30000,
    }
  );

  console.info("[saveAnswerKeyAction] save completed");

  revalidatePath(`/exams/${examId}/answer-key`);
  revalidatePath(`/exams/${examId}/submissions`);
  redirect(`/exams/${examId}/submissions`);
}
