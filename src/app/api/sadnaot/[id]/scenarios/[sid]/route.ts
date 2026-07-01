import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { checkAndAdvanceStatus } from "@/lib/workshop-status"

const FROZEN_STATUSES = ["CLOSING", "CLOSED", "CANCELLED"]

async function logIfCastingSent(workshopId: string, changeType: string, detail: string) {
  const w = await prisma.workshop.findUnique({ where: { id: workshopId }, select: { castingSentAt: true } })
  if (w?.castingSentAt) {
    await prisma.castingChangeLog.create({ data: { workshopId, changeType, detail } })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sid: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const roles = session.user.roles
  const isManager = roles.includes("MANAGER")
  const isTech = roles.includes("TECH")
  if (!isManager && !isTech)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id, sid } = await params
  const w = await prisma.workshop.findUnique({ where: { id }, select: { status: true, castingSentAt: true } })
  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (FROZEN_STATUSES.includes(w.status))
    return NextResponse.json({ error: "הסדנה נעולה לעריכה" }, { status: 403 })

  const sc = await prisma.scenario.findUnique({ where: { id: sid } })
  if (!sc || sc.workshopId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { topicId, name, actorRequirements, maleActorsNeeded, femaleActorsNeeded, written } = await req.json()
  const data: Record<string, unknown> = {}
  if (topicId !== undefined) data.topicId = topicId
  if (name !== undefined) data.name = name?.trim() || null
  if (actorRequirements !== undefined) data.actorRequirements = actorRequirements?.trim() || null
  if (maleActorsNeeded !== undefined)   data.maleActorsNeeded   = Math.max(0, Number(maleActorsNeeded)   || 0)
  if (femaleActorsNeeded !== undefined) data.femaleActorsNeeded = Math.max(0, Number(femaleActorsNeeded) || 0)
  if (written !== undefined) data.written = written

  const updated = await prisma.scenario.update({
    where: { id: sid },
    data,
    include: { topic: { select: { id: true, name: true } } },
  })

  // Log if requirements changed after casting was sent
  if (
    w.castingSentAt &&
    actorRequirements !== undefined &&
    (actorRequirements?.trim() || null) !== sc.actorRequirements
  ) {
    const label = sc.name ? `תרחיש "${sc.name}"` : `תרחיש ${sc.orderIndex + 1}`
    await prisma.castingChangeLog.create({
      data: {
        workshopId: id,
        changeType: "SCENARIO_REQ",
        detail: `דרישות ${label} עודכנו`,
      },
    })
  }

  // Auto-advance workshop status (all written → READY)
  if (written !== undefined) await checkAndAdvanceStatus(id)

  // Bug 1: if a scenario is un-written, auto-uncheck PPT on all active rooms
  if (written === false) {
    await prisma.room.updateMany({
      where: { workshopId: id, cancelled: false, pptReceived: true },
      data: { pptReceived: false },
    })
  }

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    topicId: updated.topicId,
    topicName: updated.topic.name,
    actorRequirements: updated.actorRequirements,
    maleActorsNeeded: updated.maleActorsNeeded,
    femaleActorsNeeded: updated.femaleActorsNeeded,
    written: updated.written,
    cancelled: updated.cancelled,
    orderIndex: updated.orderIndex,
  })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sid: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!session.user.roles.includes("MANAGER"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id, sid } = await params
  const w = await prisma.workshop.findUnique({ where: { id }, select: { status: true } })
  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (FROZEN_STATUSES.includes(w.status))
    return NextResponse.json({ error: "הסדנה נעולה לעריכה" }, { status: 403 })

  const sc = await prisma.scenario.findUnique({ where: { id: sid } })
  if (!sc || sc.workshopId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.scenario.update({ where: { id: sid }, data: { cancelled: true } })

  // Log if casting was already sent
  const label = sc.name ? `תרחיש "${sc.name}"` : `תרחיש ${sc.orderIndex + 1}`
  await logIfCastingSent(id, "SCENARIO_CANCELLED", `${label} בוטל`)

  return NextResponse.json({ ok: true })
}
