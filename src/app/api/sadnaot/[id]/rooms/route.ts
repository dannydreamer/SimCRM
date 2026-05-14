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
  if (!session.user.roles.includes("MANAGER"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const w = await prisma.workshop.findUnique({ where: { id }, select: { status: true } })
  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (FROZEN_STATUSES.includes(w.status))
    return NextResponse.json({ error: "הסדנה נעולה לעריכה" }, { status: 403 })

  // Find next room number
  const existing = await prisma.room.findMany({ where: { workshopId: id }, select: { roomNumber: true } })
  const maxNum = existing.length > 0 ? Math.max(...existing.map((r) => r.roomNumber)) : 0
  const room = await prisma.room.create({ data: { workshopId: id, roomNumber: maxNum + 1 } })

  return NextResponse.json({ id: room.id, roomNumber: room.roomNumber, facilitatorId: null, facilitatorName: null, facilitatorTentative: false, pptReceived: false, letterReceived: false, cancelled: false }, { status: 201 })
}