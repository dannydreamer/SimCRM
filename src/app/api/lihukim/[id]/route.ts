import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const roles = session.user.roles
  if (!roles.includes("CASTER") && !roles.includes("MANAGER"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  const w = await prisma.workshop.findUnique({
    where: { id },
    include: {
      participantGroup: {
        include: { organization: { select: { name: true } } },
      },
      scenarios: {
        where: { cancelled: false },
        orderBy: { orderIndex: "asc" },
        include: { topic: { select: { name: true } } },
      },
      rooms: {
        where: { cancelled: false },
        orderBy: { roomNumber: "asc" },
      },
      castings: {
        include: { actor: { select: { id: true, name: true } } },
      },
      actorAvailabilities: true,
      castingChangeLogs: {
        where: {
          dismissed: false,
          changeType: { in: ["SCENARIO_REQ", "SCENARIO_CANCELLED", "ROOM_CANCELLED", "COUNTS_CHANGED"] },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // All actors with availability for this workshop
  const actors = await prisma.actor.findMany({
    orderBy: { name: "asc" },
  })

  const availSet = new Set(
    w.actorAvailabilities.filter((a) => a.available).map((a) => a.actorId)
  )

  return NextResponse.json({
    id:               w.id,
    date:             w.date.toISOString(),
    startTime:        w.startTime,
    endTime:          w.endTime,
    groupName:        w.participantGroup.name,
    orgName:          w.participantGroup.organization.name,
    directorRequested: w.directorRequested,
    castingMaleNeeded:   w.castingMaleNeeded,
    castingFemaleNeeded: w.castingFemaleNeeded,
    castingNotes:     w.castingNotes,
    castingSentAt:    w.castingSentAt?.toISOString() ?? null,
    status:           w.status,
    cancelled:        w.cancelled,

    scenarios: w.scenarios.map((s) => ({
      id:                s.id,
      name:              s.name,
      topicName:         s.topic.name,
      actorRequirements: s.actorRequirements,
      maleActorsNeeded:  s.maleActorsNeeded,
      femaleActorsNeeded: s.femaleActorsNeeded,
      orderIndex:        s.orderIndex,
    })),

    rooms: w.rooms.map((r) => ({
      id:         r.id,
      roomNumber: r.roomNumber,
    })),

    actors: actors.map((a) => ({
      id:          a.id,
      name:        a.name,
      gender:      a.gender,
      specialties: a.specialties,
      canDirect:   a.canDirect,
      available:   availSet.has(a.id),
    })),

    assignments: w.castings.map((c) => ({
      id:         c.id,
      scenarioId: c.scenarioId,
      roomId:     c.roomId,
      actorId:    c.actorId,
      actorName:  c.actor.name,
      isDirector: c.isDirector,
      slotGender: c.slotGender,
      slotIndex:  c.slotIndex,
    })),

    changeLogs: w.castingChangeLogs.map((l) => ({
      id:         l.id,
      changeType: l.changeType,
      detail:     l.detail,
      createdAt:  l.createdAt.toISOString(),
    })),
  })
}
