// Shared guards for the /api/matzgot routes — spec §14 F-06, "Access".

import { NextResponse } from "next/server"
import { getServerSession, type Session } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canDownloadSharedDeck, isDeckPilot } from "./access"

type Guard = { session: Session; error: null } | { session: null; error: NextResponse }

/** The pilot user, or a 404 — to anyone else the feature does not exist. */
export async function requirePilot(): Promise<Guard> {
  const session = await getServerSession(authOptions)
  if (!session) return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  if (!isDeckPilot(session.user)) return { session: null, error: NextResponse.json({ error: "Not found" }, { status: 404 }) }
  return { session, error: null }
}

/**
 * A complete file the caller may download: their own file if they are the
 * pilot, or a deck shared with the Techs if they are a Tech. Anything else is
 * a 404, so a file id reveals nothing.
 */
export async function readableFile(fileId: string) {
  const session = await getServerSession(authOptions)
  if (!session) return { file: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  const file = await prisma.deckFile.findUnique({ where: { id: fileId } })
  const ok =
    file?.complete &&
    ((isDeckPilot(session.user) && file.ownerId === session.user.id) ||
      (file.kind === "DECK" && file.sharedAt !== null && canDownloadSharedDeck(session.user.roles)))
  if (!file || !ok) return { file: null, error: NextResponse.json({ error: "Not found" }, { status: 404 }) }
  return { file, error: null }
}
