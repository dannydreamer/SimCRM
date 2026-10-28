import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { readableFile, requirePilot } from "@/lib/deck/route-helpers"
import { toMeta } from "@/lib/deck/files"

// A file's details, for whoever may download it (the pilot, or a Tech for a shared deck).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { file, error } = await readableFile(id)
  if (error) return error
  return NextResponse.json(toMeta(file))
}

// Share a deck with the Techs, or take it back. Pilot only, own decks only.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requirePilot()
  if (error) return error
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (typeof body?.shared !== "boolean") return NextResponse.json({ error: "Bad request" }, { status: 400 })

  const file = await prisma.deckFile.findUnique({ where: { id } })
  if (!file || file.ownerId !== session.user.id || file.kind !== "DECK" || !file.complete)
    return NextResponse.json({ error: "Not found" }, { status: 404 })

  const updated = await prisma.deckFile.update({
    where: { id },
    data: { sharedAt: body.shared ? (file.sharedAt ?? new Date()) : null },
  })
  return NextResponse.json(toMeta(updated))
}
