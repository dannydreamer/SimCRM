import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { checkAndAdvanceStatus } from "@/lib/workshop-status"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!session.user.roles.includes("CASTER"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id: workshopId } = await params
  const { gender, slotIndex, actorId } = await req.json()

  if (!gender || slotIndex === undefined)
    return NextResponse.json({ error: "gender and slotIndex required" }, { status: 400 })

  if (!actorId) {
    // Clear this slot — also delete that actor's Step 2 non-director assignments
    const existing = await prisma.workshopConfirmedActor.findUnique({
      where: { workshopId_gender_slotIndex: { workshopId, gender, slotIndex } },
    })
    if (existing) {
      await prisma.casting.deleteMany({
        where: { workshopId, actorId: existing.actorId, isDirector: false },
      })
      await prisma.workshopConfirmedActor.delete({
        where: { workshopId_gender_slotIndex: { workshopId, gender, slotIndex } },
      })
    }
    return NextResponse.json({ ok: true })
  }

  // If replacing an actor, clear their old Step 2 assignments first
  const prev = await prisma.workshopConfirmedActor.findUnique({
    where: { workshopId_gender_slotIndex: { workshopId, gender, slotIndex } },
  })
  if (prev && prev.actorId !== actorId) {
    await prisma.casting.deleteMany({
      where: { workshopId, actorId: prev.actorId, isDirector: false },
    })
  }

  const result = await prisma.workshopConfirmedActor.upsert({
    where: { workshopId_gender_slotIndex: { workshopId, gender, slotIndex } },
    create: { workshopId, actorId, gender, slotIndex },
    update: { actorId },
    include: { actor: { select: { name: true } } },
  })

  // Sync workshop status — may advance to or revert from READY
  await checkAndAdvanceStatus(workshopId)

  return NextResponse.json({
    id:        result.id,
    actorId:   result.actorId,
    actorName: result.actor.name,
    gender:    result.gender,
    slotIndex: result.slotIndex,
  })
}
