import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { checkAndAdvanceStatus } from "@/lib/workshop-status"

const FROZEN_STATUSES = ["CLOSING", "CLOSED", "CANCELLED"]

function dayOnly(d: Date) {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  return out
}

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
  const workshop = await prisma.workshop.findUnique({ where: { id }, select: { status: true, date: true } })
  if (!workshop) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const frozen = FROZEN_STATUSES.includes(workshop.status)

  const room = await prisma.room.findUnique({ where: { id: rid } })
  if (!room || room.workshopId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json()
  const { facilitatorId, facilitatorTentative, pptReceived, letterReceived } = body

  const data: Record<string, unknown> = {}

  // Manager only: assign/unassign facilitator
  if (facilitatorId !== undefined) {
    if (!isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (!frozen) {
      // Prevent assigning a facilitator already slotted to another active room
      if (facilitatorId) {
        const conflict = await prisma.room.findFirst({
          where: { workshopId: id, facilitatorId, cancelled: false, id: { not: rid } },
        })
        if (conflict)
          return NextResponse.json({ error: "מתחקר/ת זה/זו כבר משובץ/ת בחדר אחר בסדנה זו" }, { status: 400 })
      }
      data.facilitatorId = facilitatorId || null
      // Auto-uncheck PPT and letter when facilitator is removed
      if (!facilitatorId) {
        data.pptReceived = false
        data.letterReceived = false
      }
    }
  }
  if (facilitatorTentative !== undefined && isManager && !frozen) {
    data.facilitatorTentative = facilitatorTentative
  }

  // PPT / Letter — Manager + Tech
  if (pptReceived !== undefined) {
    if (pptReceived === true) {
      // Must have a facilitator assigned
      const effectiveFacilitatorId = facilitatorId !== undefined ? (facilitatorId || null) : room.facilitatorId
      if (!effectiveFacilitatorId)
        return NextResponse.json({ error: "יש לשבץ מתחקר/ת לפני סימון מצגת" }, { status: 400 })
      // PPT only allowed before or on workshop date
      const today = dayOnly(new Date())
      const wDate = dayOnly(new Date(workshop.date))
      if (today > wDate)
        return NextResponse.json({ error: "לא ניתן לסמן מצגת לאחר תאריך הסדנה" }, { status: 400 })
    }
    data.pptReceived = pptReceived
  }

  if (letterReceived !== undefined) {
    if (letterReceived === true) {
      // Must have a facilitator assigned
      const effectiveFacilitatorId = facilitatorId !== undefined ? (facilitatorId || null) : room.facilitatorId
      if (!effectiveFacilitatorId)
        return NextResponse.json({ error: "יש לשבץ מתחקר/ת לפני סימון מכתב" }, { status: 400 })
      // Letter only allowed on or after workshop date
      const today = dayOnly(new Date())
      const wDate = dayOnly(new Date(workshop.date))
      if (today < wDate)
        return NextResponse.json({ error: "לא ניתן לסמן מכתב לפני תאריך הסדנה" }, { status: 400 })
    }
    data.letterReceived = letterReceived
  }

  const updated = await prisma.room.update({
    where: { id: rid },
    data,
    include: { facilitator: { select: { id: true, name: true } } },
  })

  // Auto-advance workshop status (slotting → READY, PPT+letter → CLOSED)
  await checkAndAdvanceStatus(id)

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

  // Log if casting was already sent
  const workshop = await prisma.workshop.findUnique({ where: { id }, select: { castingSentAt: true } })
  if (workshop?.castingSentAt) {
    await prisma.castingChangeLog.create({
      data: {
        workshopId: id,
        changeType: "ROOM_CANCELLED",
        detail: `חדר ${room.roomNumber} בוטל`,
      },
    })
  }

  return NextResponse.json({ ok: true })
}
