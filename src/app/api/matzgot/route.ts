import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireDeckUser } from "@/lib/deck/route-helpers"

// The deck screen's workshop picker, for when it is opened without one: live
// workshops from a month back onwards, with how many facilitator decks each
// already has. Usually the screen is reached from Workshop Detail instead. §14 F-06.
export async function GET() {
  const { error } = await requireDeckUser()
  if (error) return error

  const since = new Date()
  since.setUTCDate(since.getUTCDate() - 30)
  since.setUTCHours(0, 0, 0, 0)

  const workshops = await prisma.workshop.findMany({
    where: { date: { gte: since }, cancelled: false, status: { not: "CANCELLED" } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    select: {
      id: true, date: true, startTime: true,
      participantGroup: { select: { name: true, organization: { select: { name: true } } } },
      rooms: { where: { cancelled: false, facilitatorId: { not: null } }, select: { facilitatorId: true } },
      deckFiles: { where: { kind: "DECK", complete: true }, select: { facilitatorId: true } },
    },
  })

  return NextResponse.json({
    workshops: workshops.map((w) => {
      const facilitators = new Set(w.rooms.map((r) => r.facilitatorId!))
      return {
        id: w.id,
        date: w.date.toISOString().slice(0, 10),
        startTime: w.startTime,
        organization: w.participantGroup.organization.name,
        group: w.participantGroup.name,
        facilitators: facilitators.size,
        decks: new Set(w.deckFiles.map((d) => d.facilitatorId).filter((f) => facilitators.has(f))).size,
      }
    }),
  })
}
