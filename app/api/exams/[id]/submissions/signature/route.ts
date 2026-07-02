import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildAnswerKeySignatureSeed,
  summarizeSubmissions,
} from "@/lib/submission-state";
import { requireCurrentUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connection();

  const { id } = await params;
  const user = await requireCurrentUser();
  const exam = await prisma.exam.findFirst({
    where: { id, ownerUserId: user.id },
    select: {
      submissions: {
        select: {
          id: true,
          status: true,
          score: true,
          total: true,
          percentage: true,
          pageCount: true,
          updatedAt: true,
        },
      },
      questions: {
        orderBy: { number: "asc" },
        select: { number: true, points: true },
      },
      answerKeys: {
        orderBy: { question: "asc" },
        select: { question: true, answer: true },
      },
    },
  });

  if (!exam) {
    return Response.json({ error: "Шалгалт олдсонгүй." }, { status: 404 });
  }

  const seed = buildAnswerKeySignatureSeed({
    questions: exam.questions,
    answerKeys: exam.answerKeys,
  });
  const summary = summarizeSubmissions(exam.submissions, seed);
  const totalPossibleScore = exam.questions.reduce(
    (sum, question) => sum + question.points,
    0
  );

  return Response.json({ ...summary, totalPossibleScore });
}
