// Shared guards for the /api/matzgot routes — spec §14 F-06, "Access".

import { NextResponse } from "next/server"
import { getServerSession, type Session } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CAN_GENERATE_DECKS, CAN_MANAGE_DECK_TEMPLATES, hasAny } from "@/lib/roles"

type Guard = { session: Session; error: null } | { session: null; error: NextResponse }

/** The signed-in user if they hold one of `allowed`; else 401 or 403. */
export async function requireRoles(allowed: readonly string[]): Promise<Guard> {
  const session = await getServerSession(authOptions)
  if (!session) return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  if (!hasAny(session.user.roles, allowed))
    return { session: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  return { session, error: null }
}

export const requireDeckUser = () => requireRoles(CAN_GENERATE_DECKS)
export const requireTemplateManager = () => requireRoles(CAN_MANAGE_DECK_TEMPLATES)

/**
 * A complete file the caller may download: any deck for whoever generates
 * decks; a template for whoever manages templates. Anything else is a 404, so
 * a file id reveals nothing.
 */
export async function readableFile(fileId: string) {
  const session = await getServerSession(authOptions)
  if (!session) return { file: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  const file = await prisma.deckFile.findUnique({
    where: { id: fileId },
    include: { generatedBy: { select: { name: true } } },
  })
  const roles = session.user.roles
  const ok =
    file?.complete &&
    ((file.kind === "DECK" && hasAny(roles, CAN_GENERATE_DECKS)) ||
      (file.kind === "TEMPLATE" && hasAny(roles, CAN_MANAGE_DECK_TEMPLATES)))
  if (!file || !ok) return { file: null, error: NextResponse.json({ error: "Not found" }, { status: 404 }) }
  return { file, error: null }
}
