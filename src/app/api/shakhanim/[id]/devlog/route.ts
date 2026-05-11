import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const canWrite =
    session.user.roles.includes("MANAGER") ||
    session.user.roles.includes("FEEDBACK_DOCUMENTER")
  if (!canWrite) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const { note, date } = await req.json()
  if (!note?.trim()) return NextResponse.json({ error: "תוכן הרשומה הוא שדה חובה" }, { status: 400 })

  const actor = await prisma.actor.findUnique({ where: { id } })
  if (!actor) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const log = await prisma.actorDevelopmentLog.create({
    data: {
      actorId:     id,
      note:        note.trim(),
      date:        date ? new Date(date) : new Date(),
      enteredById: session.user.id,
    },
    include: { enteredBy: { select: { name: true } } },
  })

  return NextResponse.json({
    id:           log.id,
    date:         log.date.toISOString(),
    note:         log.note,
    enteredByName: log.enteredBy.name,
  }, { status: 201 })
}
