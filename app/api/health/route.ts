import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  const teachers = await prisma.teacher.count()

  return NextResponse.json({
    ok: true,
    database: "connected",
    teachers,
  })
}