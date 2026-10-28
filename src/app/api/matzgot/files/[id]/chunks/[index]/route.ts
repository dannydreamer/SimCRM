import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { readableFile, requirePilot } from "@/lib/deck/route-helpers"
import { CHUNK_SIZE } from "@/lib/deck/files"

type Params = { params: Promise<{ id: string; index: string }> }

// One piece of a file. Files travel in pieces because a Vercel function
// accepts and returns at most 4.5 MB. §14 F-06, "Storage".
export async function GET(_req: NextRequest, { params }: Params) {
  const { id, index } = await params
  const { error } = await readableFile(id)
  if (error) return error
  const chunk = await prisma.deckFileChunk.findUnique({ where: { fileId_index: { fileId: id, index: Number(index) } } })
  if (!chunk) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return new NextResponse(Buffer.from(chunk.data), {
    headers: { "Content-Type": "application/octet-stream", "Cache-Control": "private, no-store" },
  })
}

// Upload one piece of the pilot's own template, while the upload is open.
export async function PUT(req: NextRequest, { params }: Params) {
  const { session, error } = await requirePilot()
  if (error) return error
  const { id, index: raw } = await params
  const index = Number(raw)

  const file = await prisma.deckFile.findUnique({ where: { id } })
  if (!file || file.ownerId !== session.user.id || file.complete)
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!Number.isInteger(index) || index < 0 || index >= file.chunkCount)
    return NextResponse.json({ error: "Bad chunk" }, { status: 400 })

  const data = Buffer.from(await req.arrayBuffer())
  if (data.length === 0 || data.length > CHUNK_SIZE) return NextResponse.json({ error: "Bad chunk" }, { status: 400 })

  await prisma.deckFileChunk.upsert({
    where: { fileId_index: { fileId: id, index } },
    create: { fileId: id, index, data },
    update: { data },
  })
  return NextResponse.json({ ok: true })
}
