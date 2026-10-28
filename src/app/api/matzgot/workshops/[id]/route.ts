import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePilot } from "@/lib/deck/route-helpers"
import { currentDeck, toMeta } from "@/lib/deck/files"
import { shortDate } from "@/lib/actor-training"

// What the CRM already knows about one workshop's deck: cover details, topics,
// and the scenarios in order — each needs its file or text. §14 F-06.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requirePilot()
  if (error) return error
  const { id } = await params

  const w = await prisma.workshop.findUnique({
    where: { id },
    select: {
      id: true, date: true, startTime: true,
      participantGroup: { select: { name: true, organization: { select: { name: true } } } },
      scenarios: {
        where: { cancelled: false },
        orderBy: { orderIndex: "asc" },
        select: { id: true, name: true, topic: { select: { name: true } } },
      },
    },
  })
  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const deck = await currentDeck(session.user.id, id)
  return NextResponse.json({
    id: w.id,
    date: shortDate(w.date.toISOString().slice(0, 10)),
    startTime: w.startTime,
    organization: w.participantGroup.organization.name,
    group: w.participantGroup.name,
    topics: [...new Set(w.scenarios.map((s) => s.topic.name))],
    scenarios: w.scenarios.map((s) => ({ id: s.id, name: s.name, topic: s.topic.name })),
    deck: deck ? toMeta(deck) : null,
  })
}
