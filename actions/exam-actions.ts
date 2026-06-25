"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export async function createExamAction(formData: FormData) {
  const title = String(formData.get("title") || "");
  const subject = String(formData.get("subject") || "");
  const classroomId = String(formData.get("classroomId") || "");
  const questionCount = Number(formData.get("questionCount") || 0);

  if (!title || !subject || !classroomId || questionCount < 1) {
    throw new Error("Шалгалтын мэдээлэл дутуу байна.");
  }

  const exam = await prisma.exam.create({
    data: {
      title,
      subject,
      classroomId,
      questionCount,
    },
  });

  redirect(`/exams/${exam.id}/answer-key`);
}