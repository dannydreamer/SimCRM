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

  if (!session.user.roles.includes("CASTER"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id: workshopId } = await params
  const { scenarioId, roomId, actorId, isDirector } = await req.json()

  if (!actorId) return NextResponse.json({ error: "actorId required" }, { status: 400 })

  // Verify actor is available for this workshop
  const avail = await prisma.actorWorkshopAvailability.findUnique({
    where: { actorId_workshopId: { actorId, workshopId } },
  })
  if (!avail?.available)
    return NextResponse.json({ error: "שחקן/ית זה/זו אינו/ה מסומן/ת כמעוניין/ת בסדנה זו" }, { status: 400 })

  if (isDirector) {
    // One director slot per workshop — replace if exists
    const existing = await prisma.casting.findFirst({ where: { workshopId, isDirector: true } })
    if (existing) {
      await prisma.casting.update({ where: { id: existing.id }, data: { actorId } })
      const actor = await prisma.actor.findUnique({ where: { id: actorId }, select: { name: true } })
      return NextResponse.json({ id: existing.id, scenarioId: null, roomId: null, actorId, actorName: actor?.name, isDirector: true })
    } else {
      const created = await prisma.casting.create({ data: { workshopId, actorId, isDirector: true } })
      const actor = await prisma.actor.findUnique({ where: { id: actorId }, select: { name: true } })
      return NextResponse.json({ id: created.id, scenarioId: null, roomId: null, actorId, actorName: actor?.name, isDirector: true })
    }
  } else {
    if (!scenarioId || !roomId)
      return NextResponse.json({ error: "scenarioId and roomId required" }, { status: 400 })

    // One actor per scenario+room — replace if exists
    const existing = await prisma.casting.findFirst({
      where: { workshopId, scenarioId, roomId, isDirector: false },
    })
    const actor = await prisma.actor.findUnique({ where: { id: actorId }, select: { name: true } })

    if (existing) {
      await prisma.casting.update({ where: { id: existing.id }, data: { actorId } })
      return NextResponse.json({ id: existing.id, scenarioId, roomId, actorId, actorName: actor?.name, isDirector: false })
    } else {
      const created = await prisma.casting.create({ data: { workshopId, scenarioId, roomId, actorId, isDirector: false } })
      return NextResponse.json({ id: created.id, scenarioId, roomId, actorId, actorName: actor?.name, isDirector: false })
    }
  }
}
