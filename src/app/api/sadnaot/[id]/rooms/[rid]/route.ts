import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const FROZEN_STATUSES = ["CLOSING", "CLOSED", "CANCELLED"]

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; rid: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const roles = session.user.roles
  const isManager = roles.includes("MANAGER")
  const isTech = roles.includes("TECH")
  if (!isManager && !isTech)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id, rid } = await params
  const w = await prisma.workshop.findUnique({ where: { id }, select: { status: true } })
  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const frozen = FROZEN_STATUSES.includes(w.status)

  const room = await prisma.room.findUnique({ where: { id: rid } })
  if (!room || room.workshopId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { facilitatorId, facilitatorTentative, pptReceived, letterReceived } = await req.json()

  const data: Record<string, unknown> = {}

  // Manager only: assign facilitator
  if (facilitatorId !== undefined) {
    if (!isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (!frozen) {
      data.facilitatorId = facilitatorId || null
    }
  }
  if (facilitatorTentative !== undefined && isManager && !frozen) {
    data.facilitatorTentative = facilitatorTentative
  }

  // Manager + Tech: PPT and letter
  if (pptReceived !== undefined) data.pptReceived = pptReceived
  if (letterReceived !== undefined) data.letterReceived = letterReceived

  const updated = await prisma.room.update({ where: { id: rid }, data, include: { facilitator: { select: { id: true, name: true } } } })
  return NextResponse.json({
    id: updated.id,
    roomNumber: updated.roomNumber,
    facilitatorId: updated.facilitatorId,
    facilitatorName: updated.facilitator?.name ?? null,
    facilitatorTentative: updated.facilitatorTentative,
    pptReceived: updated.pptReceived,
    letterReceived: updated.letterReceived,
    cancelled: updated.cancelled,
  })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; rid: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!session.user.roles.includes("MANAGER"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id, rid } = await params
  const w = await prisma.workshop.findUnique({ where: { id }, select: { status: true } })
  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (FROZEN_STATUSES.includes(w.status))
    return NextResponse.json({ error: "הסדנה נעולה לעריכה" }, { status: 403 })

  const room = await prisma.room.findUnique({ where: { id: rid } })
  if (!room || room.workshopId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.room.update({ where: { id: rid }, data: { cancelled: true } })
  return NextResponse.json({ ok: true })
}