import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// Takes the full list of model ids in their new display order and rewrites
// orderIndex to match. Whole-list rather than per-row so a stale client can
// never leave two models sharing a position.
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!session.user.roles.includes("MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { ids } = await req.json()
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
    return NextResponse.json({ error: "רשימת מזהים לא תקינה" }, { status: 400 })
  }

  const existing = await prisma.simulationModel.findMany({ select: { id: true } })
  const known    = new Set(existing.map((m) => m.id))
  if (ids.length !== known.size || ids.some((id: string) => !known.has(id))) {
    // The list changed under the user — refuse rather than write a partial order
    return NextResponse.json({ error: "הרשימה השתנתה — רענן את הדף ונסה שוב" }, { status: 409 })
  }

  await prisma.$transaction(
    ids.map((id: string, i: number) =>
      prisma.simulationModel.update({ where: { id }, data: { orderIndex: i + 1 } })
    )
  )

  return NextResponse.json({ ok: true })
}
