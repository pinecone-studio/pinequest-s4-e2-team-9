import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/supabase/server";

export default async function ExamUploadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCurrentUser();
  const exam = await prisma.exam.findFirst({
    where: { id, ownerUserId: user.id },
    select: { id: true },
  });

  if (!exam) {
    notFound();
  }

  redirect(`/exams/${id}/submissions`);
}
