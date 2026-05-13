import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const FROZEN_STATUSES = ["CLOSING", "CLOSED", "CANCELLED"]

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
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
    notes: w.notes,
    frozen: FROZEN_STATUSES.includes(w.status),
    groupId: w.participantGroup.id,
    groupName: w.participantGroup.name,
    orgId: w.participantGroup.organization.id,
    orgName: w.participantGroup.organization.name,
    orgShiyuchPedagogi: w.participantGroup.organization.shiyuchPedagogi,
    authorId: w.author?.id ?? null,
    authorName: w.author?.name ?? null,
    rooms: w.rooms.map((r) => ({
      id: r.id,
      roomNumber: r.roomNumber,
      facilitatorId: r.facilitatorId,
      facilitatorName: r.facilitator?.name ?? null,
      facilitatorTentative: r.facilitatorTentative,
      pptReceived: r.pptReceived,
      letterReceived: r.letterReceived,
      cancelled: r.cancelled,
    })),
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
  if (!session.user.roles.includes("MANAGER"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const w = await prisma.workshop.findUnique({ where: { id }, select: { status: true, cancelled: true } })
  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json()

  // feedbackFormAdded can always be toggled (Manager + handled below for Tech)
  // All other fields freeze at CLOSING+
  const isFrozen = FROZEN_STATUSES.includes(w.status)

  if (body.feedbackFormAdded !== undefined) {
    // allow Tech too for feedbackFormAdded — handled in dedicated body key
  }

  const {
    date, startTime, endTime, locationType, locationName,
    authorId, directorRequested, directorNotes,
    castingMaleNeeded, castingFemaleNeeded, castingNotes,
    tentative, notes, status, cancelled, postponedWarning,
    feedbackFormAdded,
  } = body

  // Status advance: only Manager; validate progression
  if (status !== undefined) {
    const allowed: Record<string, string[]> = {
      NEW:      ["SPECIFIED"],
      SPECIFIED:["NEW"],          // allow undo for now
    }
    if (!allowed[w.status]?.includes(status))
      return NextResponse.json({ error: "מעבר סטטוס לא חוקי" }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  if (feedbackFormAdded !== undefined) data.feedbackFormAdded = feedbackFormAdded
  if (status !== undefined) data.status = status
  if (cancelled !== undefined) data.cancelled = cancelled
  if (postponedWarning !== undefined) data.postponedWarning = postponedWarning

  if (!isFrozen) {
    if (date !== undefined) data.date = new Date(date)
    if (startTime !== undefined) data.startTime = startTime
    if (endTime !== undefined) data.endTime = endTime
    if (locationType !== undefined) data.locationType = locationType
    if (locationName !== undefined) data.locationName = locationName?.trim() || null
    if (authorId !== undefined) data.authorId = authorId || null
    if (directorRequested !== undefined) data.directorRequested = directorRequested
    if (directorNotes !== undefined) data.directorNotes = directorNotes?.trim() || null
    if (castingMaleNeeded !== undefined) data.castingMaleNeeded = castingMaleNeeded === "" ? null : Number(castingMaleNeeded)
    if (castingFemaleNeeded !== undefined) data.castingFemaleNeeded = castingFemaleNeeded === "" ? null : Number(castingFemaleNeeded)
    if (castingNotes !== undefined) data.castingNotes = castingNotes?.trim() || null
    if (tentative !== undefined) data.tentative = tentative
    if (notes !== undefined) data.notes = notes?.trim() || null
  }

  const updated = await prisma.workshop.update({ where: { id }, data })
  return NextResponse.json({ status: updated.status, cancelled: updated.cancelled })
}