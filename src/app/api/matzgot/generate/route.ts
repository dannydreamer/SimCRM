import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireDeckUser } from "@/lib/deck/route-helpers"
import { currentTemplates, readWhole, storeDeck, toMeta } from "@/lib/deck/files"
import { EMPTY_CONTENT, fromRow, scenarioTexts, scheduleRows } from "@/lib/deck/content"
import { generateDeck } from "@/lib/deck/pptx"
import { shortDate } from "@/lib/actor-training"

export const maxDuration = 60

// Generate one facilitator's deck for a workshop, from their template and the
// text saved for the workshop — the screen saves before it asks. The date and
// the topics always come from the CRM; the cover's names fall back to the
// CRM's when empty. Empty fields come out empty: the screen warns, the server
// does not refuse. The deck replaces that facilitator's previous one. §14 F-06.
export async function POST(req: NextRequest) {
  const { session, error } = await requireDeckUser()
  if (error) return error

  const body = await req.json().catch(() => null)
  const workshopId = typeof body?.workshopId === "string" ? body.workshopId : ""
  const facilitatorId = typeof body?.facilitatorId === "string" ? body.facilitatorId : ""

  const w = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: {
      id: true, date: true, status: true, cancelled: true,
      participantGroup: { select: { name: true, organization: { select: { name: true } } } },
      scenarios: {
        where: { cancelled: false }, orderBy: { orderIndex: "asc" },
        select: { id: true, topic: { select: { name: true } } },
      },
      rooms: {
        where: { cancelled: false, facilitatorId },
        select: { facilitator: { select: { id: true, name: true } } },
      },
      deckContent: true,
    },
  })
  if (!w) return NextResponse.json({ error: "הסדנה לא נמצאה" }, { status: 404 })
  if (w.cancelled || w.status === "CANCELLED") return NextResponse.json({ error: "הסדנה בוטלה" }, { status: 400 })
  if (w.scenarios.length === 0) return NextResponse.json({ error: "אין לסדנה תרחישים פעילים" }, { status: 400 })
  const facilitator = w.rooms[0]?.facilitator
  if (!facilitator) return NextResponse.json({ error: "המתחקר/ת אינו/ה משובץ/ת בסדנה זו" }, { status: 400 })

  const template = (await currentTemplates([facilitator.id])).get(facilitator.id)
  if (!template) return NextResponse.json({ error: `ל${facilitator.name} אין תבנית מצגת` }, { status: 400 })

  const content = w.deckContent ? fromRow(w.deckContent) : EMPTY_CONTENT
  const date = shortDate(w.date.toISOString().slice(0, 10))
  const organization = content.organization.trim() || w.participantGroup.organization.name
  const group = content.group.trim() || w.participantGroup.name

  let result
  try {
    result = await generateDeck(await readWhole(template.id), {
      organization, group, date,
      topics: [...new Set(w.scenarios.map((s) => s.topic.name))],
      schedule: scheduleRows(content),
      scenarios: scenarioTexts(content, w.scenarios.map((s) => s.id)).map((s) => ({
        title: s.title.trim(),
        body: s.body.split("\n").filter((p) => p.trim() !== ""),
      })),
    })
  } catch (e) {
    console.error("[matzgot] generate failed", e)
    return NextResponse.json({ error: "יצירת המצגת נכשלה — ייתכן שהתבנית פגומה" }, { status: 500 })
  }

  const fileName = `מצגת ${facilitator.name} - ${organization} - ${group} - ${date}.pptx`.replace(/[\\/:*?"<>|]+/g, " ")
  const deck = await storeDeck({
    facilitatorId: facilitator.id, generatedById: session.user.id, templateId: template.id,
    workshopId: w.id, fileName, data: result.file,
  })
  return NextResponse.json({ deck: toMeta(deck) })
}
