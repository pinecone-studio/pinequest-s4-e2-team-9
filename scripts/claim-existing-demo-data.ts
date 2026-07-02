import { generateCaptureToken } from "../lib/capture-token";
import { prisma } from "../lib/prisma";

async function main() {
  const ownerUserId = process.argv[2] || process.env.SUPABASE_USER_ID;

  if (!ownerUserId) {
    throw new Error("Usage: bun scripts/claim-existing-demo-data.ts <supabase-user-id>");
  }

  const [classrooms, exams] = await Promise.all([
    prisma.classroom.updateMany({
      where: { ownerUserId: null },
      data: { ownerUserId },
    }),
    prisma.exam.updateMany({
      where: { ownerUserId: null },
      data: { ownerUserId },
    }),
  ]);
  const examsMissingToken = await prisma.exam.findMany({
    where: { captureToken: null },
    select: { id: true },
  });

  for (const exam of examsMissingToken) {
    await prisma.exam.update({
      where: { id: exam.id },
      data: { captureToken: generateCaptureToken() },
    });
  }

  console.info(
    `Claimed ${classrooms.count} classrooms, ${exams.count} exams, generated ${examsMissingToken.length} capture tokens.`
  );
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
