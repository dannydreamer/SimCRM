// Storage for the deck generator's files — spec §14 F-06, "Storage".
//
// A file is a DeckFile row plus its bytes in DeckFileChunk rows. Chunking is
// forced by Vercel: a function accepts and returns at most 4.5 MB, and a
// facilitator's template alone is about 4 MB. So the browser uploads and
// downloads in CHUNK_SIZE pieces, and the server reassembles only when it needs
// the whole file — to read a template, or generate a deck from one.

import { prisma } from "@/lib/prisma"
import { inspectTemplate } from "./pptx"

export const CHUNK_SIZE = 3 * 1024 * 1024
export const MAX_FILE_SIZE = 40 * 1024 * 1024

export type DeckKind = "TEMPLATE" | "DECK"

export type DeckFileMeta = {
  id: string
  kind: DeckKind
  facilitatorId: string
  fileName: string
  size: number
  chunkCount: number
  createdAt: string
  /** DECK only: who generated it. */
  generatedByName: string | null
}

const META_SELECT = {
  id: true, kind: true, facilitatorId: true, fileName: true, size: true, chunkCount: true, createdAt: true,
  tokens: true, generatedBy: { select: { name: true } },
} as const

type MetaRow = {
  id: string; kind: string; facilitatorId: string; fileName: string; size: number; chunkCount: number
  createdAt: Date; generatedBy?: { name: string } | null
}

export function toMeta(f: MetaRow): DeckFileMeta {
  return {
    id: f.id,
    kind: f.kind as DeckKind,
    facilitatorId: f.facilitatorId,
    fileName: f.fileName,
    size: f.size,
    chunkCount: f.chunkCount,
    createdAt: f.createdAt.toISOString(),
    generatedByName: f.generatedBy?.name ?? null,
  }
}

export function chunkCountFor(size: number): number {
  return Math.max(1, Math.ceil(size / CHUNK_SIZE))
}

/**
 * Each facilitator's current template — the newest complete one. A facilitator
 * may hold several in the database (§14 F-06, "later"); today one is used.
 */
export async function currentTemplates(facilitatorIds: string[]) {
  const rows = await prisma.deckFile.findMany({
    where: { facilitatorId: { in: facilitatorIds }, kind: "TEMPLATE", complete: true },
    orderBy: { createdAt: "desc" },
    select: META_SELECT,
  })
  const out = new Map<string, (typeof rows)[number]>()
  for (const r of rows) if (!out.has(r.facilitatorId)) out.set(r.facilitatorId, r)
  return out
}

/** Each facilitator's current deck for one workshop. */
export async function currentDecks(workshopId: string) {
  const rows = await prisma.deckFile.findMany({
    where: { workshopId, kind: "DECK", complete: true },
    orderBy: { createdAt: "desc" },
    select: META_SELECT,
  })
  const out = new Map<string, (typeof rows)[number]>()
  for (const r of rows) if (!out.has(r.facilitatorId)) out.set(r.facilitatorId, r)
  return out
}

export async function readWhole(fileId: string): Promise<Uint8Array> {
  const chunks = await prisma.deckFileChunk.findMany({ where: { fileId }, orderBy: { index: "asc" } })
  return Buffer.concat(chunks.map((c) => Buffer.from(c.data)))
}

/**
 * The tokens a template holds. Read on upload and stored; a template uploaded
 * before they were stored is read once, here, and stored then.
 */
export async function templateTokens(t: { id: string; tokens: string | null }): Promise<string[]> {
  if (t.tokens !== null) {
    try { return JSON.parse(t.tokens) as string[] } catch { /* read again below */ }
  }
  try {
    const report = await inspectTemplate(await readWhole(t.id))
    await prisma.deckFile.update({ where: { id: t.id }, data: { tokens: JSON.stringify(report.tokens) } })
    return report.tokens
  } catch (e) {
    // An unreadable template must not take the whole screen down with it;
    // generating from it fails on its own row instead.
    console.error("[matzgot] cannot read template", t.id, e)
    return []
  }
}

/**
 * Mark an upload complete once every chunk has arrived, then retire what it
 * replaces: a new template replaces the facilitator's previous ones; a new deck
 * replaces the facilitator's previous decks for that workshop.
 */
export async function completeFile(fileId: string, extra: { tokens?: string } = {}) {
  const file = await prisma.deckFile.findUniqueOrThrow({ where: { id: fileId } })
  const arrived = await prisma.deckFileChunk.count({ where: { fileId } })
  if (arrived !== file.chunkCount) throw new Error(`הקובץ לא הועלה במלואו (${arrived}/${file.chunkCount})`)

  const previous = await prisma.deckFile.findMany({
    where: {
      id: { not: fileId },
      facilitatorId: file.facilitatorId,
      kind: file.kind,
      ...(file.kind === "DECK" ? { workshopId: file.workshopId } : {}),
    },
    select: { id: true },
  })

  await prisma.$transaction([
    prisma.deckFile.update({ where: { id: fileId }, data: { complete: true, ...extra } }),
    prisma.deckFile.deleteMany({ where: { id: { in: previous.map((p) => p.id) } } }),
  ])
}

/** Store a deck the server generated, chunked, complete. */
export async function storeDeck(input: {
  facilitatorId: string; generatedById: string; templateId: string; workshopId: string; fileName: string; data: Uint8Array
}) {
  const chunkCount = chunkCountFor(input.data.length)
  const file = await prisma.deckFile.create({
    data: {
      kind: "DECK", facilitatorId: input.facilitatorId, generatedById: input.generatedById,
      templateId: input.templateId, workshopId: input.workshopId,
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
