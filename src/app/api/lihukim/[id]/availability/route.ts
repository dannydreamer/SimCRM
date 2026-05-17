import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Only Caster can toggle availability (Manager is read-only)
  if (!session.user.roles.includes("CASTER"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id: workshopId } = await params
  const { actorId, available } = await req.json()

  if (!actorId) return NextResponse.json({ error: "actorId required" }, { status: 400 })

  await prisma.actorWorkshopAvailability.upsert({
    where:  { actorId_workshopId: { actorId, workshopId } },
    create: { actorId, workshopId, available: Boolean(available) },
    update: { available: Boolean(available) },
  })

  // If marking unavailable, remove assignments and confirmed slot for this actor
  if (!available) {
    await prisma.casting.deleteMany({ where: { workshopId, actorId } })
    await prisma.workshopConfirmedActor.deleteMany({ where: { workshopId, actorId } })
  }

  return NextResponse.json({ ok: true })
}
