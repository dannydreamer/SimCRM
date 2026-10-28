import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePilot } from "@/lib/deck/route-helpers"
import { CHUNK_SIZE, MAX_FILE_SIZE, chunkCountFor } from "@/lib/deck/files"

// Start a template upload. The browser then PUTs each chunk and POSTs
// /complete. Only templates arrive this way; decks are made on the server.
export async function POST(req: NextRequest) {
  const { session, error } = await requirePilot()
  if (error) return error

  const body = await req.json().catch(() => null)
  const fileName = typeof body?.fileName === "string" ? body.fileName.trim() : ""
  const size = Number(body?.size)
  if (!/\.pptx$/i.test(fileName)) return NextResponse.json({ error: "התבנית צריכה להיות קובץ PowerPoint ‏(‎.pptx‎)" }, { status: 400 })
  if (!Number.isInteger(size) || size <= 0 || size > MAX_FILE_SIZE)
    return NextResponse.json({ error: "הקובץ גדול מדי (עד 40MB)" }, { status: 400 })

  const file = await prisma.deckFile.create({
    data: { kind: "TEMPLATE", ownerId: session.user.id, fileName, size, chunkCount: chunkCountFor(size) },
  })
  return NextResponse.json({ id: file.id, chunkCount: file.chunkCount, chunkSize: CHUNK_SIZE })
}
