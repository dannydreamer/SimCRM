// Storage for the deck generator's files — spec §14 F-06, "Storage".
//
// A file is a DeckFile row plus its bytes in DeckFileChunk rows. Chunking is
// forced by Vercel: a function accepts and returns at most 4.5 MB, and a
// facilitator's template alone is about 4 MB. So the browser uploads and
// downloads in CHUNK_SIZE pieces, and the server reassembles only when it needs
// the whole file — to generate a deck from a template.

import { prisma } from "@/lib/prisma"

export const CHUNK_SIZE = 3 * 1024 * 1024
export const MAX_FILE_SIZE = 40 * 1024 * 1024

export type DeckKind = "TEMPLATE" | "DECK"

export type DeckFileMeta = {
  id: string
  kind: DeckKind
  fileName: string
  size: number
  chunkCount: number
  createdAt: string
  sharedAt: string | null
}

const META_SELECT = {
  id: true, kind: true, fileName: true, size: true, chunkCount: true, createdAt: true, sharedAt: true,
} as const

export function toMeta(f: {
  id: string; kind: string; fileName: string; size: number; chunkCount: number; createdAt: Date; sharedAt: Date | null
}): DeckFileMeta {
  return {
    id: f.id,
    kind: f.kind as DeckKind,
    fileName: f.fileName,
    size: f.size,
    chunkCount: f.chunkCount,
    createdAt: f.createdAt.toISOString(),
    sharedAt: f.sharedAt?.toISOString() ?? null,
  }
}

export function chunkCountFor(size: number): number {
  return Math.max(1, Math.ceil(size / CHUNK_SIZE))
}

/** The owner's current template — the newest complete one. */
export async function currentTemplate(ownerId: string) {
  return prisma.deckFile.findFirst({
    where: { ownerId, kind: "TEMPLATE", complete: true },
    orderBy: { createdAt: "desc" },
    select: META_SELECT,
  })
}

/** The owner's current deck for one workshop. */
export async function currentDeck(ownerId: string, workshopId: string) {
  return prisma.deckFile.findFirst({
    where: { ownerId, workshopId, kind: "DECK", complete: true },
    orderBy: { createdAt: "desc" },
    select: META_SELECT,
  })
}

/** The newest deck shared with the Techs for one workshop, whoever made it. */
export async function sharedDeck(workshopId: string) {
  return prisma.deckFile.findFirst({
    where: { workshopId, kind: "DECK", complete: true, sharedAt: { not: null } },
    orderBy: { createdAt: "desc" },
    select: META_SELECT,
  })
}

export async function readWhole(fileId: string): Promise<Uint8Array> {
  const chunks = await prisma.deckFileChunk.findMany({ where: { fileId }, orderBy: { index: "asc" } })
  return Buffer.concat(chunks.map((c) => Buffer.from(c.data)))
}

/**
 * Mark an upload complete once every chunk has arrived, then retire what it
 * replaces: a new template replaces the owner's previous ones; a new deck
 * replaces the owner's previous decks for that workshop, inheriting whether it
 * was shared, so a corrected deck does not silently vanish from the Techs.
 */
export async function completeFile(fileId: string) {
  const file = await prisma.deckFile.findUniqueOrThrow({ where: { id: fileId } })
  const arrived = await prisma.deckFileChunk.count({ where: { fileId } })
  if (arrived !== file.chunkCount) throw new Error(`הקובץ לא הועלה במלואו (${arrived}/${file.chunkCount})`)

  const previous = await prisma.deckFile.findMany({
    where: {
      id: { not: fileId },
      ownerId: file.ownerId,
      kind: file.kind,
      ...(file.kind === "DECK" ? { workshopId: file.workshopId } : {}),
    },
    select: { id: true, sharedAt: true, complete: true },
  })
  const wasShared = previous.some((p) => p.complete && p.sharedAt)

  await prisma.$transaction([
    prisma.deckFile.update({
      where: { id: fileId },
      data: { complete: true, ...(file.kind === "DECK" && wasShared ? { sharedAt: new Date() } : {}) },
    }),
    prisma.deckFile.deleteMany({ where: { id: { in: previous.map((p) => p.id) } } }),
  ])
}

/** Store a whole file the server produced (a generated deck), chunked, complete. */
export async function storeWhole(input: {
  kind: DeckKind; ownerId: string; workshopId: string | null; fileName: string; data: Uint8Array
}) {
  const chunkCount = chunkCountFor(input.data.length)
  const file = await prisma.deckFile.create({
    data: {
      kind: input.kind, ownerId: input.ownerId, workshopId: input.workshopId,
      fileName: input.fileName, size: input.data.length, chunkCount,
    },
  })
  for (let i = 0; i < chunkCount; i++) {
    await prisma.deckFileChunk.create({
      data: { fileId: file.id, index: i, data: Buffer.from(input.data.subarray(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)) },
    })
  }
  await completeFile(file.id)
  return prisma.deckFile.findUniqueOrThrow({ where: { id: file.id }, select: META_SELECT })
}
