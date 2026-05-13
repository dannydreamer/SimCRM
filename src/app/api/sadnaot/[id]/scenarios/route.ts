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
  const w = await prisma.workshop.findUnique({ where: { id }, select: { status: true } })
  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (FROZEN_STATUSES.includes(w.status))
    return NextResponse.json({ error: "הסדנה נעולה לעריכה" }, { status: 403 })

  const { topicId, name, actorRequirements } = await req.json()
  if (!topicId) return NextResponse.json({ error: "יש לבחור נושא" }, { status: 400 })

  const existing = await prisma.scenario.findMany({ where: { workshopId: id }, select: { orderIndex: true } })
  const maxIdx = existing.length > 0 ? Math.max(...existing.map((s) => s.orderIndex)) : -1

  const s = await prisma.scenario.create({
    data: { workshopId: id, topicId, name: name?.trim() || null, actorRequirements: actorRequirements?.trim() || null, orderIndex: maxIdx + 1 },
    include: { topic: { select: { id: true, name: true } } },
  })

  return NextResponse.json({ id: s.id, name: s.name, topicId: s.topicId, topicName: s.topic.name, actorRequirements: s.actorRequirements, written: s.written, cancelled: s.cancelled, orderIndex: s.orderIndex }, { status: 201 })
}