import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { checkAndAdvanceStatus } from "@/lib/workshop-status"

const FROZEN_STATUSES = ["CLOSING", "CLOSED", "CANCELLED"]

function mapRoom(r: { id: string; roomNumber: number; facilitatorId: string | null; facilitator?: { name: string } | null; facilitatorTentative: boolean; pptReceived: boolean; letterReceived: boolean; cancelled: boolean }) {
  return {
    id: r.id,
    roomNumber: r.roomNumber,
    facilitatorId: r.facilitatorId,
    facilitatorName: r.facilitator?.name ?? null,
    facilitatorTentative: r.facilitatorTentative,
    pptReceived: r.pptReceived,
    letterReceived: r.letterReceived,
    cancelled: r.cancelled,
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  // Auto-advance status (date-based CLOSING, etc.) before serving response
  await checkAndAdvanceStatus(id)

  const w = await prisma.workshop.findUnique({
    where: { id },
    include: {
      participantGroup: { include: { organization: true } },
      author: { select: { id: true, name: true } },
      rooms: {
        orderBy: { roomNumber: "asc" },
        include: { facilitator: { select: { id: true, name: true } } },
      },
      scenarios: {
        orderBy: { orderIndex: "asc" },
        include: { topic: { select: { id: true, name: true } } },
      },
    },
  })

  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({
    id: w.id,
    date: w.date.toISOString(),
    startTime: w.startTime,
    endTime: w.endTime,
    numRooms: w.numRooms,
    locationType: w.locationType,
    locationName: w.locationName,
    directorRequested: w.directorRequested,
    directorNotes: w.directorNotes,
    castingMaleNeeded: w.castingMaleNeeded,
    castingFemaleNeeded: w.castingFemaleNeeded,
    castingNotes: w.castingNotes,
    status: w.status,
    cancelled: w.cancelled,
    tentative: w.tentative,
    postponedWarning: w.postponedWarning,
    feedbackFormAdded: w.feedbackFormAdded,
    castingSentAt: w.castingSentAt?.toISOString() ?? null,
    notes: w.notes,
    frozen: FROZEN_STATUSES.includes(w.status),
    groupId: w.participantGroup.id,
    groupName: w.participantGroup.name,
    orgId: w.participantGroup.organization.id,
    orgName: w.participantGroup.organization.name,
    orgShiyuchPedagogi: w.participantGroup.organization.shiyuchPedagogi,
    authorId: w.author?.id ?? null,
    authorName: w.author?.name ?? null,
    rooms: w.rooms.map(mapRoom),
    scenarios: w.scenarios.map((s) => ({
      id: s.id,
      name: s.name,
      topicId: s.topicId,
      topicName: s.topic.name,
      actorRequirements: s.actorRequirements,
      written: s.written,
      cancelled: s.cancelled,
      orderIndex: s.orderIndex,
    })),
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const isManager = session.user.roles.includes("MANAGER")
  const isTech    = session.user.roles.includes("TECH")
  if (!isManager && !isTech)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const w = await prisma.workshop.findUnique({
    where: { id },
    select: {
      status: true, cancelled: true,
      castingSentAt: true, castingMaleNeeded: true, castingFemaleNeeded: true,
      rooms: { where: { cancelled: false }, select: { facilitatorId: true } },
    },
  })
  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json()
  const isFrozen = FROZEN_STATUSES.includes(w.status)

  const {
    date, startTime, endTime, locationType, locationName,
    numRooms, authorId, directorRequested, directorNotes,
    castingMaleNeeded, castingFemaleNeeded, castingNotes,
    tentative, notes, status, cancelled, postponedWarning,
    feedbackFormAdded,
  } = body

  // Status advance: validate progression
  if (status !== undefined) {
    const allowed: Record<string, string[]> = {
      NEW: ["SPECIFIED"],
    }
    if (!allowed[w.status]?.includes(status))
      return NextResponse.json({ error: "מעבר סטטוס לא חוקי" }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  // Status is allowed for both Manager and Tech
  if (status !== undefined) data.status = status

  // All other fields: Manager only
  if (isManager) {
    if (feedbackFormAdded !== undefined) data.feedbackFormAdded = feedbackFormAdded
    if (cancelled !== undefined) data.cancelled = cancelled
    if (postponedWarning !== undefined) data.postponedWarning = postponedWarning

    if (!isFrozen) {
      if (date !== undefined) {
        data.date = new Date(date)
        // Auto-set postponed warning if workshop has assigned resources
        const hasResources = !!w.castingSentAt || w.rooms.some((r) => r.facilitatorId)
        if (hasResources) data.postponedWarning = true
      }
      if (startTime !== undefined) data.startTime = startTime
      if (endTime !== undefined) data.endTime = endTime
      if (locationType !== undefined) data.locationType = locationType
      if (locationName !== undefined) data.locationName = locationName?.trim() || null
      if (numRooms !== undefined) data.numRooms = Number(numRooms)
      if (authorId !== undefined) data.authorId = authorId || null
      if (directorRequested !== undefined) data.directorRequested = directorRequested
      if (directorNotes !== undefined) data.directorNotes = directorNotes?.trim() || null
      if (castingMaleNeeded !== undefined) data.castingMaleNeeded = castingMaleNeeded === "" ? null : Number(castingMaleNeeded)
      if (castingFemaleNeeded !== undefined) data.castingFemaleNeeded = castingFemaleNeeded === "" ? null : Number(castingFemaleNeeded)
      if (castingNotes !== undefined) data.castingNotes = castingNotes?.trim() || null
      if (tentative !== undefined) data.tentative = tentative
      if (notes !== undefined) data.notes = notes?.trim() || null
    }
  }

  let updated: Awaited<ReturnType<typeof prisma.workshop.update>>
  try {
    updated = await prisma.workshop.update({ where: { id }, data })
  } catch (e) {
    console.error("[PATCH /api/sadnaot/[id]] Prisma error:", e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }

  // Sync rooms when numRooms changed (Manager only)
  let updatedRooms: ReturnType<typeof mapRoom>[] | undefined
  if (isManager && numRooms !== undefined && !isFrozen) {
    const newNum = Number(numRooms)
    const allRooms = await prisma.room.findMany({
      where: { workshopId: id },
      orderBy: { roomNumber: "asc" },
      include: { facilitator: { select: { id: true, name: true } } },
    })
    const activeRooms = allRooms.filter((r) => !r.cancelled)
    const cancelledRooms = allRooms.filter((r) => r.cancelled)

    if (newNum > activeRooms.length) {
      const needed = newNum - activeRooms.length
      // Reinstate cancelled rooms first (sorted by roomNumber)
      const toReinstate = cancelledRooms.slice(0, needed)
      for (const r of toReinstate) {
        await prisma.room.update({ where: { id: r.id }, data: { cancelled: false } })
      }
      // Create brand-new rooms if still needed
      const stillNeeded = needed - toReinstate.length
      const maxNum = allRooms.length > 0 ? Math.max(...allRooms.map((r) => r.roomNumber)) : 0
      if (stillNeeded > 0) {
        await prisma.room.createMany({
          data: Array.from({ length: stillNeeded }, (_, i) => ({
            workshopId: id,
            roomNumber: maxNum + i + 1,
          })),
        })
      }
    } else if (newNum < activeRooms.length) {
      // Cancel the highest-numbered active rooms
      const toCancel = activeRooms.slice(newNum)
      for (const r of toCancel) {
        await prisma.room.update({ where: { id: r.id }, data: { cancelled: true } })
      }
    }

    // Return fresh rooms list
    const freshRooms = await prisma.room.findMany({
      where: { workshopId: id },
      orderBy: { roomNumber: "asc" },
      include: { facilitator: { select: { id: true, name: true } } },
    })
    updatedRooms = freshRooms.map(mapRoom)
  }

  // Log if casting integers changed after casting was sent
  if (w.castingSentAt) {
    const maleChanged = castingMaleNeeded !== undefined && Number(castingMaleNeeded) !== w.castingMaleNeeded
    const femaleChanged = castingFemaleNeeded !== undefined && Number(castingFemaleNeeded) !== w.castingFemaleNeeded
    if (maleChanged || femaleChanged) {
      await prisma.castingChangeLog.create({
        data: {
          workshopId: id,
          changeType: "COUNTS_CHANGED",
          detail: "המספרים הכמותיים עודכנו",
        },
      })
    }
  }

  // Auto-advance after patch (e.g. castingSentAt just set)
  const advancedStatus = await checkAndAdvanceStatus(id)

  return NextResponse.json({
    status: advancedStatus ?? updated.status,
    cancelled: updated.cancelled,
    numRooms: updated.numRooms,
    ...(updatedRooms !== undefined && { rooms: updatedRooms }),
  })
}