import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { summarizeSubmissions } from "@/lib/submission-state";
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
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!exam) {
    return Response.json({ error: "Шалгалт олдсонгүй." }, { status: 404 });
  }

  return Response.json(summarizeSubmissions(exam.submissions));
}
