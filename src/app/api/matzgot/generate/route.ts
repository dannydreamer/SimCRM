import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePilot } from "@/lib/deck/route-helpers"
import { currentTemplate, readWhole, storeWhole, toMeta } from "@/lib/deck/files"
import { generateDeck } from "@/lib/deck/pptx"
import { shortDate } from "@/lib/actor-training"

export const maxDuration = 60

const str = (v: unknown, max = 5000) => (typeof v === "string" ? v.slice(0, max) : "")

// Generate the pilot's deck for one workshop from their template and the text
// approved in the preview. The cover's organization and group are prefilled
// from the CRM and may be corrected in the preview — names there are not always
// written as they should appear; empty falls back to the CRM's. The date and the
// topics always come from the CRM. The deck replaces the previous one for this workshop. §14 F-06.
export async function POST(req: NextRequest) {
  const { session, error } = await requirePilot()
  if (error) return error

  const body = await req.json().catch(() => null)
  const workshopId = str(body?.workshopId, 100)
  const schedule = Array.isArray(body?.schedule) ? body.schedule.slice(0, 40) : []
  const scenarios = Array.isArray(body?.scenarios) ? body.scenarios.slice(0, 20) : []

  const w = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: {
      id: true, date: true,
      participantGroup: { select: { name: true, organization: { select: { name: true } } } },
      scenarios: { where: { cancelled: false }, orderBy: { orderIndex: "asc" }, select: { topic: { select: { name: true } } } },
    },
  })
  if (!w) return NextResponse.json({ error: "הסדנה לא נמצאה" }, { status: 404 })

  const template = await currentTemplate(session.user.id)
  if (!template) return NextResponse.json({ error: "יש להעלות תבנית לפני יצירת מצגת" }, { status: 400 })

  const date = shortDate(w.date.toISOString().slice(0, 10))
  const organization = str(body?.organization, 200).trim() || w.participantGroup.organization.name
  const group = str(body?.group, 200).trim() || w.participantGroup.name

  let result
  try {
    result = await generateDeck(await readWhole(template.id), {
      organization, group, date,
      icebreakerQuestion: str(body?.icebreakerQuestion, 500).trim(),
      topics: [...new Set(w.scenarios.map((s) => s.topic.name))],
      schedule: schedule.map((r: unknown) => ({
        activity: str((r as { activity?: unknown })?.activity, 300).trim(),
        time: str((r as { time?: unknown })?.time, 50).trim(),
      })).filter((r: { activity: string; time: string }) => r.activity || r.time),
      scenarios: scenarios.map((s: unknown) => ({
        title: str((s as { title?: unknown })?.title, 300).trim(),
        body: (Array.isArray((s as { body?: unknown })?.body) ? (s as { body: unknown[] }).body : [])
          .slice(0, 60).map((p) => str(p, 3000)).filter((p: string) => p.trim() !== ""),
      })),
    })
  } catch (e) {
    console.error("[matzgot] generate failed", e)
    return NextResponse.json({ error: "יצירת המצגת נכשלה — ייתכן שהתבנית פגומה" }, { status: 500 })
  }

  const fileName = `מצגת סימולציה - ${organization} - ${group} - ${date}.pptx`.replace(/[\\/:*?"<>|]+/g, " ")
  const deck = await storeWhole({ kind: "DECK", ownerId: session.user.id, workshopId: w.id, fileName, data: result.file })
  return NextResponse.json({ deck: toMeta(deck), unresolved: result.unresolved })
}
