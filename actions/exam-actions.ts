"use server";

import { prisma } from "@/lib/prisma";
import { analyzeExamMaterial } from "@/lib/gemini-vision";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createExamAction(formData: FormData) {
  const title = String(formData.get("title") || "").trim();
  const subject = String(formData.get("subject") || "").trim();
  const classroomId = String(formData.get("classroomId") || "").trim();
  const questionCount = Number(formData.get("questionCount") || 0);
  const material = formData.get("material");
  const materialFile =
    typeof File !== "undefined" && material instanceof File && material.size > 0
      ? material
      : null;

  if (!title || !subject || !classroomId || !Number.isInteger(questionCount) || questionCount < 1) {
    throw new Error("Шалгалтын мэдээлэл дутуу байна.");
  }

  await analyzeExamMaterial(materialFile);

  const exam = await prisma.exam.create({
    data: {
      title,
      subject,
      classroomId,
      questionCount,
      // ponytail: demo stores the filename only; add object storage when teachers need to reopen files.
      materialUrl: materialFile?.name || null,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/classrooms");
  revalidatePath(`/classrooms/${classroomId}`);
  redirect(`/exams/${exam.id}/answer-key`);
}
