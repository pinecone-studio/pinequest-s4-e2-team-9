import { redirect } from "next/navigation";

export default async function ExamUploadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  redirect(`/exams/${id}/submissions`);
}
