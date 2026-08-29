import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const filter = searchParams.get("filter") ?? "upcoming" // upcoming | past | all
  const facilitatorId = searchParams.get("facilitatorId") ?? null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const dateWhere =
    filter === "upcoming"
      ? { date: { gte: today } }
      : filter === "past"
        ? { date: { lt: today } }
        : {}

  const workshops = await prisma.workshop.findMany({
    where: {
      ...dateWhere,
      ...(facilitatorId
        ? { rooms: { some: { facilitatorId } } }
        : {}),
    },
    include: {
      participantGroup: { include: { organization: true } },
      author: { select: { id: true, name: true } },
      rooms: {
        select: {
          id: true,
          cancelled: true,
          facilitatorId: true,
          pptReceived: true,
          letterReceived: true,
        },
      },
      scenarios: {
        select: { id: true, cancelled: true, written: true },
      },
      castings: {
        select: { id: true, isDirector: true },
      },
      feedbacks: {
        select: { id: true },
      },
    },
    orderBy: { date: filter === "past" ? "desc" : "asc" },
  })

  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const rows = workshops.map((w) => {
    const activeRooms = w.rooms.filter((r) => !r.cancelled)
    const facilitatedCount = activeRooms.filter((r) => r.facilitatorId).length
    const activeScenarios = w.scenarios.filter((s) => !s.cancelled)
    const writtenScenarios = activeScenarios.filter((s) => s.written)
    const castActors = w.castings.filter((c) => !c.isDirector)

    const workshopDate = new Date(w.date)
    workshopDate.setHours(0, 0, 0, 0)
    const isUpcoming = workshopDate >= now

    const needsAssessmentDone = w.status !== "NEW"
    const castingTotal = (w.castingMaleNeeded ?? 0) + (w.castingFemaleNeeded ?? 0)
    const castingDone = castActors.length

    // Removed 29 Aug 2026: a `scenarioUrgency` red/orange rule at 7 and 14 days out,
    // and the `daysUntil` behind it. No screen ever fetched this route, so both were
    // computed and thrown away. The date-proximity warning that shipped instead is
    // the readiness alert — src/lib/workshop-readiness.ts, spec §4.8.

    return {
      id: w.id,
      date: w.date.toISOString(),
      startTime: w.startTime,
      tentative: w.tentative,
      cancelled: w.cancelled,
      status: w.status,
      postponedWarning: w.postponedWarning,

      groupId: w.participantGroup.id,
      groupName: w.participantGroup.name,
      orgId: w.participantGroup.organization.id,
      orgName: w.participantGroup.organization.name,

      authorFirstName: w.author?.name
        ? w.author.name.split(" ")[0]
        : null,

      activeRoomCount: activeRooms.length,
      facilitatedCount,

      needsAssessmentDone,

      scenarioCount: activeScenarios.length,
      scenariosWrittenCount: writtenScenarios.length,

      castingMaleNeeded: w.castingMaleNeeded,
      castingFemaleNeeded: w.castingFemaleNeeded,
      castingTotal,
      castingDone,

      pptCount: activeRooms.filter((r) => r.pptReceived).length,
      feedbackFormAdded: w.feedbackFormAdded,
      lettersCount: activeRooms.filter((r) => r.letterReceived).length,

      feedbackExpected: castActors.length,
      feedbackEntered: w.feedbacks.length,

      isUpcoming,
    }
  })

  return NextResponse.json(rows)
}
