import { connection } from "next/server";
import { expandQuestionsToCount } from "@/lib/grading";
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
      questionCount: true,
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

  const questions = expandQuestionsToCount(
    exam.questions,
    exam.questionCount,
    exam.answerKeys
  );
  const seed = buildAnswerKeySignatureSeed({
    questions,
    answerKeys: exam.answerKeys,
  });
  const summary = summarizeSubmissions(exam.submissions, seed);
  const totalPossibleScore = questions.reduce(
    (sum, question) => sum + (question.points ?? 1),
    0
  );

  return Response.json({ ...summary, totalPossibleScore });
}
