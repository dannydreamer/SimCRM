import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const roles   = session.user.roles
  const userId  = session.user.id
  const isFacilitator = roles.includes("FACILITATOR") &&
    !roles.includes("MANAGER") && !roles.includes("TECH") &&
    !roles.includes("CASTER") && !roles.includes("FEEDBACK_DOCUMENTER")

  const workshops = await prisma.workshop.findMany({
    where: isFacilitator
      ? { rooms: { some: { facilitatorId: userId, cancelled: false } } }
      : undefined,
    orderBy: { date: "asc" },
    include: {
      participantGroup: {
        include: { organization: { select: { name: true } } },
      },
      rooms: {
        where: { cancelled: false },
        include: { facilitator: { select: { name: true } } },
      },
    },
  })

  return NextResponse.json(
    workshops.map((w) => ({
      id:         w.id,
      date:       w.date.toISOString(),
      startTime:  w.startTime,
      endTime:    w.endTime,
      numRooms:   w.numRooms,
      status:     w.status,
      tentative:  w.tentative,
      cancelled:  w.cancelled,
      groupName:  w.participantGroup.name,
      orgName:    w.participantGroup.organization.name,
      facilitators: w.rooms
        .filter((r) => r.facilitator)
        .map((r) => r.facilitator!.name),
    })),
    { headers: { "Cache-Control": "no-store" } }
  )
}
