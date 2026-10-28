import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePilot } from "@/lib/deck/route-helpers"
import { currentTemplate, toMeta } from "@/lib/deck/files"

// The generator's start screen: the pilot's template and the workshops to pick
// from — live ones from a month back onwards. §14 F-06.
export async function GET() {
  const { session, error } = await requirePilot()
  if (error) return error

  const since = new Date()
  since.setUTCDate(since.getUTCDate() - 30)
  since.setUTCHours(0, 0, 0, 0)

  const [template, workshops] = await Promise.all([
    currentTemplate(session.user.id),
    prisma.workshop.findMany({
      where: { date: { gte: since }, status: { not: "CANCELLED" } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      select: {
        id: true, date: true, startTime: true,
        participantGroup: { select: { name: true, organization: { select: { name: true } } } },
        deckFiles: {
          where: { ownerId: session.user.id, kind: "DECK", complete: true },
          orderBy: { createdAt: "desc" }, take: 1, select: { id: true, sharedAt: true },
        },
      },
    }),
  ])

  return NextResponse.json({
    template: template ? toMeta(template) : null,
    workshops: workshops.map((w) => ({
      id: w.id,
      date: w.date.toISOString().slice(0, 10),
      startTime: w.startTime,
      organization: w.participantGroup.organization.name,
      group: w.participantGroup.name,
      hasDeck: w.deckFiles.length > 0,
      shared: !!w.deckFiles[0]?.sharedAt,
    })),
  })
}
