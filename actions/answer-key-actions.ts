"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { isValidAnswerLabel, isValidOptionLabel } from "@/lib/answer-key-parser";
import { msSince, perfLog } from "@/lib/perf";
import { requireCurrentUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function saveAnswerKeyAction(formData: FormData) {
  const totalStartedAt = Date.now();
  const authStartedAt = Date.now();
  const user = await requireCurrentUser();
  const authMs = msSince(authStartedAt);
  const examId = String(formData.get("examId") || "").trim();

  if (!examId) {
    throw new Error("Шалгалтын ID дутуу байна.");
  }

  const loadStartedAt = Date.now();
  const exam = await prisma.exam.findFirst({
    where: { id: examId, ownerUserId: user.id },
    select: {
      id: true,
      questions: {
        orderBy: { number: "asc" },
        select: {
          id: true,
          number: true,
          text: true,
          points: true,
          options: {
            orderBy: { createdAt: "asc" },
            select: { id: true, label: true, text: true, isCorrect: true },
          },
        },
      },
    },
  });
  const loadMs = msSince(loadStartedAt);

  if (!exam) {
    throw new Error("Шалгалт олдсонгүй.");
  }

  if (!exam.questions.length) {
    throw new Error("Асуултын бүтэц дутуу байна.");
  }

  const questionUpdates: Array<{ id: string; text: string; points: number }> = [];
  const optionUpdates: Array<{ id: string; label: string; text: string; isCorrect: boolean }> = [];
  const answerKeys: Array<{ examId: string; question: number; answer: string }> = [];

  const parseStartedAt = Date.now();
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

    const questionText = String(formData.get(`question-${question.id}-text`) || "").trim();

    if (question.text !== questionText || question.points !== points) {
      questionUpdates.push({
        id: question.id,
        text: questionText,
        points,
      });
    }

    for (const option of question.options) {
      const optionUpdate = {
        id: option.id,
        label: String(formData.get(`option-${option.id}-label`) || "").trim(),
        text: String(formData.get(`option-${option.id}-text`) || "").trim(),
        isCorrect: option.id === correctOptionId,
      };

      if (
        option.label !== optionUpdate.label ||
        option.text !== optionUpdate.text ||
        option.isCorrect !== optionUpdate.isCorrect
      ) {
        optionUpdates.push(optionUpdate);
      }
    }

    answerKeys.push({
      examId,
      question: question.number,
      answer: correctLabel,
    });
  }
  const parseMs = msSince(parseStartedAt);

  console.info("[saveAnswerKeyAction] questions count", exam.questions.length);
  console.info("[saveAnswerKeyAction] option updates count", optionUpdates.length);
  console.info("[saveAnswerKeyAction] answer keys count", answerKeys.length);

  const transactionStartedAt = Date.now();
  await prisma.$transaction(
    async (tx) => {
      if (questionUpdates.length > 0) {
        await tx.$executeRaw`
          UPDATE "ExamQuestion" AS q
          SET "text" = v.question_text::text,
              "points" = v.points::double precision
          FROM (VALUES ${Prisma.join(
            questionUpdates.map((item) =>
              Prisma.sql`(${item.id}, ${item.text}, ${item.points})`
            )
          )}) AS v(id, question_text, points)
          WHERE q.id = v.id::text
        `;
      }

      if (optionUpdates.length > 0) {
        await tx.$executeRaw`
          UPDATE "ExamOption" AS o
          SET "label" = v.option_label::text,
              "text" = v.option_text::text,
              "isCorrect" = v.is_correct::boolean
          FROM (VALUES ${Prisma.join(
            optionUpdates.map((item) =>
              Prisma.sql`(${item.id}, ${item.label}, ${item.text}, ${item.isCorrect})`
            )
          )}) AS v(id, option_label, option_text, is_correct)
          WHERE o.id = v.id::text
        `;
      }

      await tx.answerKey.deleteMany({ where: { examId } });
      await tx.answerKey.createMany({ data: answerKeys });
    },
    {
      timeout: 30000,
    }
  );
  const transactionMs = msSince(transactionStartedAt);

  console.info("[saveAnswerKeyAction] save completed");

  const revalidateStartedAt = Date.now();
  revalidatePath(`/exams/${examId}/answer-key`);
  revalidatePath(`/exams/${examId}/submissions`);
  revalidatePath(`/exams/${examId}/results`);
  const revalidateMs = msSince(revalidateStartedAt);
  perfLog("answer-key-save", {
    authMs,
    loadMs,
    parseMs,
    questionUpdates: questionUpdates.length,
    optionUpdates: optionUpdates.length,
    transactionMs,
    revalidateMs,
    totalMs: msSince(totalStartedAt),
  });
  redirect(`/exams/${examId}/submissions`);
}
