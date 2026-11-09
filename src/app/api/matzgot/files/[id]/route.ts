import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { readableFile, requireTemplateManager } from "@/lib/deck/route-helpers"
import { toMeta } from "@/lib/deck/files"

// A file's details, for whoever may download it: a deck for anyone who
// generates decks, a template for the Manager. §14 F-06.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { file, error } = await readableFile(id)
  if (error) return error
  return NextResponse.json(toMeta(file))
}

// Remove a facilitator's template. Manager only. Decks made from it stay. §14 F-06.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireTemplateManager()
  if (error) return error
  const { id } = await params
  const file = await prisma.deckFile.findUnique({ where: { id }, select: { kind: true } })
  if (!file || file.kind !== "TEMPLATE") return NextResponse.json({ error: "Not found" }, { status: 404 })
  await prisma.deckFile.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
