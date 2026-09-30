import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { CASTER_ALERT_TYPES } from "@/lib/casting-change-log"
import { NOTIFICATION_WINDOW_DAYS, visibleEventAt } from "@/lib/notification-window"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const roles = session.user.roles
  const isCaster  = roles.includes("CASTER")
  const isManager = roles.includes("MANAGER")
  if (!isCaster && !isManager)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const viewer = await prisma.person.findUnique({
    where:  { id: session.user.id },
    select: { createdAt: true },
  })
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const now = new Date()
  // The same two floors the workshop table applies (§4.7.1), pushed into the
  // query rather than filtered afterwards: a change log older than the window,
  // or older than this person's account, is not their news. `CastingChangeLog`
  // already carries `createdAt` and a per-row id, so unlike the workshop
  // warnings it needed no new column and no change to how dismissals are keyed.
  const eventFloor = new Date(Math.max(
    now.getTime() - NOTIFICATION_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    viewer.createdAt.getTime()
  ))

  // Include cancelled workshops so casters see the בוטל indicator
  // Exclude only fully closed/cancelled-status workshops
  const workshops = await prisma.workshop.findMany({
    where: {
      castingSentAt: { not: null },
      status:        { notIn: ["CLOSED", "CANCELLED"] },
    },
    orderBy: { date: "asc" },
    include: {
      participantGroup: {
        include: { organization: { select: { name: true } } },
      },
      scenarios: { where: { cancelled: false }, select: { id: true, maleActorsNeeded: true, femaleActorsNeeded: true } },
      rooms:     { where: { cancelled: false }, select: { id: true } },
      // Only count castings tied to active rooms AND active scenarios
      castings:  {
        where: {
          AND: [
            {
              OR: [
                { roomId: null },                              // director has no roomId
                { room: { cancelled: false } },
              ],
            },
            {
              OR: [
                { scenarioId: null },                         // director has no scenarioId
                { scenario: { cancelled: false } },
              ],
            },
          ],
        },
        select: { id: true, isDirector: true },
      },
      // Step 1 confirmed actors — used to determine if casting has started
      confirmedActors: { select: { id: true } },
      // All undismissed change logs — landing page shows banners for all types
      castingChangeLogs: {
        where: {
          dismissed: false,
          changeType: { in: [...CASTER_ALERT_TYPES] },
          createdAt:  { gte: eventFloor },
        },
        select: { id: true, changeType: true, detail: true },
      },
    },
  })

  return NextResponse.json(
    workshops.map((w) => {
      const activeRooms   = w.rooms.length
      const slotsPerRoom  = w.scenarios.reduce((sum, s) => sum + s.maleActorsNeeded + s.femaleActorsNeeded, 0)
      const castingTotal  = slotsPerRoom * activeRooms + (w.directorRequested ? 1 : 0)
      const nonDir        = w.castings.filter((c) => !c.isDirector).length
      const hasDir        = w.castings.some((c) => c.isDirector)
      const castingFilled = nonDir + (w.directorRequested && hasDir ? 1 : 0)

      return {
        id:           w.id,
        date:         w.date.toISOString(),
        startTime:    w.startTime,
        groupName:    w.participantGroup.name,
        orgName:      w.participantGroup.organization.name,
        cancelled:      w.cancelled,
        // Drives the dismissible cancellation banner; `cancelled` above still
        // drives the permanent בוטל indicator in the row. §4.7.1
        cancelledAt:    w.cancelled ? visibleEventAt(w.cancelledAt, viewer, now) : null,
        castingTotal,
        castingFilled,
        castingStarted: w.confirmedActors.length > 0 || w.castings.length > 0,
        changeLogs: w.castingChangeLogs.map((l) => ({ id: l.id, changeType: l.changeType, detail: l.detail })),
      }
    }),
    { headers: { "Cache-Control": "no-store" } }
  )
}
