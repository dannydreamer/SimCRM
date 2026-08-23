import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { countedRooms } from "@/lib/counted-rooms"

/**
 * The two pivot-only fields on a workshop. Manager and Tech, spec §8.12.
 *
 * Deliberately NOT gated on FROZEN_STATUSES the way `/api/sadnaot/[id]` is:
 * cancelled and closed workshops are precisely the rows that need correcting
 * here, and that guard would block every one of them. Nothing writable through
 * this route can affect status, casting or any checklist, so the guard has
 * nothing to protect.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const roles = session.user.roles
  if (!roles.includes("MANAGER") && !roles.includes("TECH"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const { pivotNotes, countedRoomsOverride } = await req.json()

  const data: { pivotNotes?: string | null; countedRoomsOverride?: number | null } = {}

  if (pivotNotes !== undefined) {
    data.pivotNotes = typeof pivotNotes === "string" && pivotNotes.trim()
      ? pivotNotes.trim()
      : null
  }

  if (countedRoomsOverride !== undefined) {
    // Empty clears the override and hands the row back to the computed default.
    if (countedRoomsOverride === null || countedRoomsOverride === "") {
      data.countedRoomsOverride = null
    } else {
      const n = Number(countedRoomsOverride)
      if (!Number.isInteger(n) || n < 0)
        return NextResponse.json({ error: "חדרים לספירה חייב להיות מספר שלם לא שלילי" }, { status: 400 })
      data.countedRoomsOverride = n
    }
  }

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: "pivotNotes or countedRoomsOverride required" }, { status: 400 })

  const updated = await prisma.workshop.update({
    where: { id },
    data,
    select: {
      status: true,
      cancelled: true,
      pivotNotes: true,
      countedRoomsOverride: true,
      rooms: { where: { cancelled: false }, select: { cancelled: true } },
    },
  })

  return NextResponse.json({
    pivotNotes:           updated.pivotNotes,
    countedRoomsOverride: updated.countedRoomsOverride,
    countedRooms:         countedRooms(updated),
  })
}
