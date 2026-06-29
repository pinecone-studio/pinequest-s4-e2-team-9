"use server";

import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createClassroomAction(formData: FormData) {
  const user = await requireCurrentUser();
  const name = String(formData.get("name") || "").trim();

  if (!name) {
    throw new Error("Ангийн нэр шаардлагатай.");
  }

  const classroom = await prisma.classroom.create({
    data: {
      name,
      ownerUserId: user.id,
    },
  });

  revalidatePath("/classrooms");
  revalidatePath("/dashboard");
  redirect(`/classrooms/${classroom.id}`);
}

export async function createStudentAction(formData: FormData) {
  const user = await requireCurrentUser();
  const name = String(formData.get("name") || "").trim();
  const classroomId = String(formData.get("classroomId") || "").trim();

  if (!name || !classroomId) {
    throw new Error("Сурагчийн нэр болон анги шаардлагатай.");
  }

  const classroom = await prisma.classroom.findFirst({
    where: { id: classroomId, ownerUserId: user.id },
    select: { id: true },
  });

  if (!classroom) {
    redirect("/classrooms");
  }

  await prisma.student.create({
    data: {
      name,
      classroomId,
    },
  });

  revalidatePath("/classrooms");
  revalidatePath(`/classrooms/${classroomId}`);
  revalidatePath("/dashboard");
  redirect(`/classrooms/${classroomId}`);
}
