import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; cid: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!session.user.roles.includes("CASTER"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id: workshopId, cid } = await params

  const casting = await prisma.casting.findUnique({ where: { id: cid } })
  if (!casting || casting.workshopId !== workshopId)
    return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.casting.delete({ where: { id: cid } })
  return NextResponse.json({ ok: true })
}
