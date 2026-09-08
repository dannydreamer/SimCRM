import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { castingProgress } from "@/lib/casting-progress"
import { readinessAlert } from "@/lib/workshop-readiness"
import { workshopHasEnded } from "@/lib/workshop-status"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const workshops = await prisma.workshop.findMany({
    orderBy: { date: "asc" },
    include: {
      participantGroup: {
        include: { organization: { select: { id: true, name: true } } },
      },
      author: { select: { id: true, name: true } },
      rooms: {
        select: {
          id: true, cancelled: true, facilitatorId: true,
          facilitatorTentative: true, pptReceived: true, letterReceived: true,
          facilitator: { select: { id: true, name: true } },
        },
      },
      scenarios: { select: { id: true, cancelled: true, written: true, maleActorsNeeded: true, femaleActorsNeeded: true, topic: { select: { id: true, name: true } } } },
      castings:  { select: { actorId: true, isDirector: true, roomId: true } },
      feedbacks: {
        select: {
          actorId: true, roomId: true,
          aspect1PrepText: true, aspect2SimText: true,
          aspect3ReflectionText: true, aspect4ProfessionalText: true,
        },
      },
      // Needed by the readiness alert — condition 5 turns on whether a חדר אחר
      // is in use at the centre.
      roomLocations: { select: { location: true } },
    },
  })

  // One clock for the whole response, so two rows a millisecond apart can never
  // land on different days.
  const now = new Date()

  // Date-based CLOSING for the whole table, in one write.
  //
  // checkAndAdvanceStatus() is pull-based — it runs only when someone opens or
  // edits a particular workshop — and nothing sweeps on a clock. A workshop that
  // finished and that nobody has touched since would therefore sit here in מוכן
  // indefinitely, which is exactly how a past workshop was found still showing
  // מוכן the morning after. This is the one transition that needs no per-workshop
  // evaluation (the SPECIFIED/READY → CLOSING leg depends on the date alone), so
  // it can be settled for every row at once; everything else — READY, CLOSED and
  // both regressions — still belongs to checkAndAdvanceStatus. §4.4.
  const nowClosing = workshops.filter(
    (w) => !w.cancelled &&
           (w.status === "SPECIFIED" || w.status === "READY") &&
           workshopHasEnded(w.date, w.endTime, now)
  )
  if (nowClosing.length > 0) {
    await prisma.workshop.updateMany({
      where: { id: { in: nowClosing.map((w) => w.id) } },
      data:  { status: "CLOSING" },
    })
    // Serve the new status in this same response rather than making the table
    // wait for a refetch to stop lying.
    for (const w of nowClosing) w.status = "CLOSING"
  }

  return NextResponse.json(
    workshops.map((w) => {
      const activeRooms      = w.rooms.filter((r) => !r.cancelled)
      const activeScenarios  = w.scenarios.filter((s) => !s.cancelled)
      const nonDirCastings   = w.castings.filter((c) => !c.isDirector)
      const directorCasting  = w.castings.find((c) => c.isDirector)

      const slottingTotal    = activeRooms.length
      const slottingFilled   = activeRooms.filter((r) => r.facilitatorId).length
      const slottingTentative = activeRooms.some((r) => r.facilitatorTentative)

      // Raw Step 2 slot counts. No longer feed the ליהוק badge — they still drive the
      // "ממתין לליהוק לחדרים" filter and the משוב משתתפים column's "is this workshop
      // far enough along to owe a feedback form" test (castingTotal > 0). The הזנת
      // פידבק column deliberately does not use them; see feedbackExpected below.
      // See spec §8.2.
      const slotsPerRoom  = activeScenarios.reduce((sum, s) => sum + s.maleActorsNeeded + s.femaleActorsNeeded, 0)
      const castingTotal  = slotsPerRoom * activeRooms.length + (w.directorRequested ? 1 : 0)
      const castingFilled = nonDirCastings.filter((c) => c.actorId).length + (w.directorRequested && directorCasting ? 1 : 0)

      const casting = castingProgress({
        directorRequested: w.directorRequested,
        castingSentAt:     w.castingSentAt,
        rooms:     w.rooms,
        scenarios: w.scenarios,
        castings:  w.castings,
      })

      const scenarioWritten = activeScenarios.length > 0 && activeScenarios.every((s) => s.written)

      const pptTotal  = activeRooms.length
      const pptFilled = activeRooms.filter((r) => r.pptReceived).length

      const letterTotal  = activeRooms.length
      const letterFilled = activeRooms.filter((r) => r.letterReceived).length

      const activeRoomIds = new Set(activeRooms.map((r) => r.id))
      const completedFeedbackSet = new Set(
        w.feedbacks
          .filter((f) =>
            f.aspect1PrepText?.trim() || f.aspect2SimText?.trim() ||
            f.aspect3ReflectionText?.trim() || f.aspect4ProfessionalText?.trim()
          )
          .map((f) => `${f.actorId}:${f.roomId}`)
      )
      const feedbackMissing =
        nonDirCastings.filter(
          (c) => c.roomId && activeRoomIds.has(c.roomId) &&
                 !completedFeedbackSet.has(`${c.actorId}:${c.roomId}`)
        ).length +
        (w.directorRequested && directorCasting &&
         !completedFeedbackSet.has(`${directorCasting.actorId}:null`) ? 1 : 0)

      // How much feedback this workshop actually expects: one record per actor
      // genuinely cast into an active room, plus the director if one was cast.
      // Deliberately NOT castingTotal — that is the theoretical slot count from
      // scenarios × rooms, which is already > 0 before anyone has been cast, so
      // gating the badge on it made an uncast workshop's zero missing records
      // read as "all feedback in". Counted the same way as feedbackMissing above
      // so that missing can never exceed expected. Matches the Detail page's
      // feedbackExpected. See spec §8.2.
      const feedbackExpected =
        nonDirCastings.filter((c) => c.roomId && activeRoomIds.has(c.roomId)).length +
        (w.directorRequested && directorCasting ? 1 : 0)

      const roomFacilitators = activeRooms
        .filter((r) => r.facilitator)
        .map((r) => ({ id: r.facilitator!.id, name: r.facilitator!.name }))

      // Computed here rather than on the client: the day boundary is Israel's,
      // not the browser's, and the five conditions must match the status gate
      // exactly. Null for anything ready, cancelled, past, or over a week out.
      const readiness = readinessAlert({
        status:                w.status,
        cancelled:             w.cancelled,
        date:                  w.date,
        castingSentAt:         w.castingSentAt,
        directorRequested:     w.directorRequested,
        feedbackFormAdded:     w.feedbackFormAdded,
        estimatedParticipants: w.estimatedParticipants,
        locationType:          w.locationType,
        otherRoomApproved:     w.otherRoomApproved,
        roomLocations:         w.roomLocations.map((l) => l.location),
        rooms:      w.rooms,
        scenarios:  w.scenarios,
        castings:   w.castings,
      }, now)

      return {
        id:           w.id,
        date:         w.date.toISOString(),
        startTime:    w.startTime,
        endTime:      w.endTime,
        numRooms:     w.numRooms,
        status:       w.status,
        tentative:    w.tentative,
        cancelled:    w.cancelled,
        directorRequested: w.directorRequested,
        groupName:    w.participantGroup.name,
        orgId:        w.participantGroup.organization.id,
        orgName:      w.participantGroup.organization.name,
        authorId:     w.author?.id   ?? null,
        authorName:   w.author?.name ?? null,
        roomFacilitators,
        slottingFilled, slottingTotal, slottingTentative,
        castingFilled,  castingTotal,
        casting,
        scenarioWritten,
        feedbackFormAdded: w.feedbackFormAdded,
        pptFilled, pptTotal,
        letterFilled, letterTotal,
        castingSentAt:        w.castingSentAt?.toISOString() ?? null,
        postponedWarning:     w.postponedWarning,
        roomCancelledWarning: w.roomCancelledWarning,
        feedbackMissing,
        feedbackExpected,
        readiness,
        topics: [...new Map(
          activeScenarios.filter((s) => s.topic).map((s) => [s.topic.id, s.topic.name])
        ).entries()].map(([id, name]) => ({ id, name })),
      }
    }),
    { headers: { "Cache-Control": "no-store" } }
  )
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!session.user.roles.includes("MANAGER")) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 })
  }

  const {
    organizationId, groupId, groupName,
    date, startTime, endTime, numRooms,
    locationType, locationName, authorId,
    directorRequested, tentative, notes,
  } = await req.json()

  if (!organizationId)                return NextResponse.json({ error: "יש לבחור ארגון" }, { status: 400 })
  if (!groupId && !groupName?.trim()) return NextResponse.json({ error: "יש להזין שם קבוצה" }, { status: 400 })
  if (!date)                          return NextResponse.json({ error: "יש לבחור תאריך" }, { status: 400 })
  if (!startTime)                     return NextResponse.json({ error: "יש להזין שעת התחלה" }, { status: 400 })
  if (!endTime)                       return NextResponse.json({ error: "יש להזין שעת סיום" }, { status: 400 })
  const n = Math.floor(Number(numRooms))
  if (!n || n < 1)                    return NextResponse.json({ error: "יש להזין מספר חדרים" }, { status: 400 })
  console.log(`[POST /api/sadnaot] numRooms received=${numRooms} parsed=${n}`)

  let participantGroupId: string
  if (groupId) {
    participantGroupId = groupId
  } else {
    const trimmed  = groupName.trim()
    const existing = await prisma.participantGroup.findMany({ where: { organizationId } })
    const match    = existing.find((g) => g.name.trim().toLowerCase() === trimmed.toLowerCase())
    if (match) {
      participantGroupId = match.id
    } else {
      const ng = await prisma.participantGroup.create({ data: { organizationId, name: trimmed } })
      participantGroupId = ng.id
    }
  }

  // Create workshop + rooms atomically so they can never be out of sync
  const workshop = await prisma.$transaction(async (tx) => {
    const w = await tx.workshop.create({
      data: {
        participantGroupId,
        date:              new Date(date),
        startTime, endTime,
        numRooms:          n,
        locationType:      locationType ?? "CENTER",
        locationName:      locationName?.trim() || null,
        authorId:          authorId || null,
        directorRequested: Boolean(directorRequested),
        tentative:         Boolean(tentative),
        notes:             notes?.trim() || null,
        createdById:       session.user.id,
      },
    })
    await tx.room.createMany({
      data: Array.from({ length: n }, (_, i) => ({
        workshopId: w.id,
        roomNumber: i + 1,
      })),
    })
    return w
  })

  return NextResponse.json({ id: workshop.id }, { status: 201 })
}