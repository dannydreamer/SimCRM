import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; clid: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Only Caster can dismiss (Manager is read-only)
  if (!session.user.roles.includes("CASTER"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id: workshopId, clid } = await params

  const log = await prisma.castingChangeLog.findUnique({ where: { id: clid } })
  if (!log || log.workshopId !== workshopId)
    return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.castingChangeLog.update({ where: { id: clid }, data: { dismissed: true } })
  return NextResponse.json({ ok: true })
}
