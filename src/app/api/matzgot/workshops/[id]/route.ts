import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireDeckUser } from "@/lib/deck/route-helpers"
import { currentDecks, currentTemplates, templateTokens, toMeta } from "@/lib/deck/files"
import { EMPTY_CONTENT, fromRow } from "@/lib/deck/content"
import { shortDate } from "@/lib/actor-training"

// Everything the deck screen needs for one workshop: what the CRM knows (cover
// names, date, topics, scenarios in order), the text saved for it, and one row
// per active room with a facilitator — their template and their deck. §14 F-06.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireDeckUser()
  if (error) return error
  const { id } = await params

  const w = await prisma.workshop.findUnique({
    where: { id },
    select: {
      id: true, date: true, startTime: true, status: true, cancelled: true,
      participantGroup: { select: { name: true, organization: { select: { name: true } } } },
      scenarios: {
        where: { cancelled: false },
        orderBy: { orderIndex: "asc" },
        select: { id: true, name: true, written: true, topic: { select: { name: true } } },
      },
      rooms: {
        where: { cancelled: false, facilitatorId: { not: null } },
        orderBy: { roomNumber: "asc" },
        select: {
          id: true, roomNumber: true, pptReceived: true, facilitatorTentative: true,
          facilitator: { select: { id: true, name: true } },
        },
      },
      deckContent: true,
    },
  })
  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const facilitatorIds = w.rooms.map((r) => r.facilitator!.id)
  const [templates, decks] = await Promise.all([currentTemplates(facilitatorIds), currentDecks(id)])
  const tokens = new Map<string, string[]>()
  for (const [fid, t] of templates) tokens.set(fid, await templateTokens(t))

  const cancelled = w.cancelled || w.status === "CANCELLED"
  return NextResponse.json({
    id: w.id,
    date: shortDate(w.date.toISOString().slice(0, 10)),
    dateIso: w.date.toISOString(),
    startTime: w.startTime,
    organization: w.participantGroup.organization.name,
    group: w.participantGroup.name,
    topics: [...new Set(w.scenarios.map((s) => s.topic.name))],
    scenarios: w.scenarios.map((s) => ({ id: s.id, name: s.name, topic: s.topic.name })),
    allScenariosWritten: w.scenarios.length > 0 && w.scenarios.every((s) => s.written),
    blockReason: cancelled
      ? "הסדנה בוטלה"
      : w.scenarios.length === 0
      ? "אין לסדנה תרחישים פעילים"
      : w.rooms.length === 0
      ? "לא שובצו מתחקרים"
      : null,
    content: w.deckContent ? fromRow(w.deckContent) : EMPTY_CONTENT,
    contentUpdatedAt: w.deckContent?.updatedAt.toISOString() ?? null,
    facilitators: w.rooms.map((r) => {
      const fid = r.facilitator!.id
      const t = templates.get(fid)
      const d = decks.get(fid)
      return {
        roomId: r.id,
        roomNumber: r.roomNumber,
        facilitatorId: fid,
        name: r.facilitator!.name,
        tentative: r.facilitatorTentative,
        pptReceived: r.pptReceived,
        template: t ? { id: t.id, fileName: t.fileName, tokens: tokens.get(fid)! } : null,
        deck: d ? toMeta(d) : null,
      }
    }),
  })
}
