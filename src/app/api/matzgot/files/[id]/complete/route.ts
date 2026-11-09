import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireTemplateManager } from "@/lib/deck/route-helpers"
import { completeFile, readWhole, toMeta } from "@/lib/deck/files"
import { inspectTemplate, type TemplateReport } from "@/lib/deck/pptx"

// Close a template upload: every chunk present, and the result really is a
// PowerPoint file. Its tokens are read and stored, and reported back — found,
// expected but missing, unknown. It then replaces the facilitator's previous
// template. Manager only. §14 F-06.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireTemplateManager()
  if (error) return error
  const { id } = await params

  const file = await prisma.deckFile.findUnique({ where: { id } })
  if (!file || file.kind !== "TEMPLATE" || file.complete)
    return NextResponse.json({ error: "Not found" }, { status: 404 })

  let report: TemplateReport
  try {
    const bytes = await readWhole(id)
    report = await inspectTemplate(bytes)
  } catch {
    await prisma.deckFile.delete({ where: { id } })
    return NextResponse.json({ error: "הקובץ אינו מצגת PowerPoint תקינה" }, { status: 400 })
  }

  try {
    await completeFile(id, { tokens: JSON.stringify(report.tokens) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
  const meta = toMeta(await prisma.deckFile.findUniqueOrThrow({ where: { id } }))
  return NextResponse.json({ ...meta, ...report })
}
