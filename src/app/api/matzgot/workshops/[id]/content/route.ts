import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireDeckUser } from "@/lib/deck/route-helpers"
import { cleanContent, toRow } from "@/lib/deck/content"

// Save the text approved for a workshop's decks — schedule, scenario texts and
// the cover's names. It fills every facilitator's deck, and is there on the
// next visit. Scenario text is kept only for the workshop's own scenarios. §14 F-06.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireDeckUser()
  if (error) return error
  const { id } = await params

  const w = await prisma.workshop.findUnique({
    where: { id },
    select: { id: true, scenarios: { select: { id: true } } },
  })
  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Bad request" }, { status: 400 })
  const content = cleanContent(body)
  const own = new Set(w.scenarios.map((s) => s.id))
  content.scenarios = content.scenarios.filter((s) => own.has(s.scenarioId))

  const row = toRow(content)
  const saved = await prisma.workshopDeckContent.upsert({
    where: { workshopId: id },
    create: { workshopId: id, ...row, updatedById: session.user.id },
    update: { ...row, updatedById: session.user.id },
  })
  return NextResponse.json({ ok: true, updatedAt: saved.updatedAt.toISOString() })
}
