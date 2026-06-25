import { redirect } from "next/navigation";

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  redirect(`/exams/${id}/submissions`);
}
