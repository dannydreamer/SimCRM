import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePilot } from "@/lib/deck/route-helpers"
import { completeFile, readWhole, toMeta } from "@/lib/deck/files"
import JSZip from "jszip"

// Close a template upload: every chunk present, and the result really is a
// PowerPoint file. It then replaces the pilot's previous template.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requirePilot()
  if (error) return error
  const { id } = await params

  const file = await prisma.deckFile.findUnique({ where: { id } })
  if (!file || file.ownerId !== session.user.id || file.complete)
    return NextResponse.json({ error: "Not found" }, { status: 404 })

  try {
    const zip = await JSZip.loadAsync(await readWhole(id))
    if (!zip.file("ppt/presentation.xml")) throw new Error()
  } catch {
    await prisma.deckFile.delete({ where: { id } })
    return NextResponse.json({ error: "הקובץ אינו מצגת PowerPoint תקינה" }, { status: 400 })
  }

  try {
    await completeFile(id)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
  return NextResponse.json(toMeta(await prisma.deckFile.findUniqueOrThrow({ where: { id } })))
}
