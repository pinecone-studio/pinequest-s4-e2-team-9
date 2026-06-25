import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {

  const classrooms = await prisma.classroom.count()

  return NextResponse.json({
    ok: true,
    database: "connected",
  
    classrooms,
  })
}
