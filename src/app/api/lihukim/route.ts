import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const roles = session.user.roles
  const isCaster  = roles.includes("CASTER")
  const isManager = roles.includes("MANAGER")
  if (!isCaster && !isManager)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // Pending = castingSentAt set, not cancelled, not closed
  const workshops = await prisma.workshop.findMany({
    where: {
      castingSentAt: { not: null },
      cancelled:     false,
      status:        { notIn: ["CLOSED", "CANCELLED"] },
    },
    orderBy: { date: "asc" },
    include: {
      participantGroup: {
        include: { organization: { select: { name: true } } },
      },
      scenarios: { where: { cancelled: false }, select: { id: true } },
      rooms:     { where: { cancelled: false }, select: { id: true } },
      castings:  { select: { id: true, isDirector: true } },
    },
  })

  return NextResponse.json(
    workshops.map((w) => {
      const activeScenarios = w.scenarios.length
      const activeRooms     = w.rooms.length
      const castingTotal    = activeScenarios * activeRooms + (w.directorRequested ? 1 : 0)
      const nonDir          = w.castings.filter((c) => !c.isDirector).length
      const hasDir          = w.castings.some((c) => c.isDirector)
      const castingFilled   = nonDir + (w.directorRequested && hasDir ? 1 : 0)

      return {
        id:           w.id,
        date:         w.date.toISOString(),
        startTime:    w.startTime,
        groupName:    w.participantGroup.name,
        orgName:      w.participantGroup.organization.name,
        castingTotal,
        castingFilled,
      }
    }),
    { headers: { "Cache-Control": "no-store" } }
  )
}
