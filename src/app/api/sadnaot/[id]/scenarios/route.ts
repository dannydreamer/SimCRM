import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const FROZEN_STATUSES = ["CLOSING", "CLOSED", "CANCELLED"]

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const roles = session.user.roles
  if (!roles.includes("MANAGER") && !roles.includes("TECH"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const w = await prisma.workshop.findUnique({ where: { id }, select: { status: true, authorId: true } })
  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (FROZEN_STATUSES.includes(w.status))
    return NextResponse.json({ error: "הסדנה נעולה לעריכה" }, { status: 403 })
  if (!w.authorId)
    return NextResponse.json({ error: "יש להגדיר כותב/ת תרחיש לפני הוספת תרחישים" }, { status: 400 })

  const { topicId, name, actorRequirements, maleActorsNeeded, femaleActorsNeeded } = await req.json()
  if (!topicId) return NextResponse.json({ error: "יש לבחור נושא" }, { status: 400 })

  const existing = await prisma.scenario.findMany({ where: { workshopId: id }, select: { orderIndex: true } })
  const maxIdx = existing.length > 0 ? Math.max(...existing.map((s) => s.orderIndex)) : -1

  const s = await prisma.scenario.create({
    data: {
      workshopId: id, topicId,
      name: name?.trim() || null,
      actorRequirements: actorRequirements?.trim() || null,
      maleActorsNeeded:   Math.max(0, Number(maleActorsNeeded)   || 0),
      femaleActorsNeeded: Math.max(0, Number(femaleActorsNeeded) || 0),
      orderIndex: maxIdx + 1,
    },
    include: { topic: { select: { id: true, name: true } } },
  })

  return NextResponse.json({
    id: s.id, name: s.name, topicId: s.topicId, topicName: s.topic.name,
    actorRequirements: s.actorRequirements,
    maleActorsNeeded: s.maleActorsNeeded, femaleActorsNeeded: s.femaleActorsNeeded,
    written: s.written, cancelled: s.cancelled, orderIndex: s.orderIndex,
  }, { status: 201 })
}