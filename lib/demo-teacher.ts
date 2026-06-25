import { prisma } from "@/lib/prisma"

export async function getDemoTeacher() {
  const email = process.env.DEMO_TEACHER_EMAIL || "demo@duntuslah.mn"

  return prisma.teacher.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Demo багш",
      school: "Demo сургууль",
    },
  })
}