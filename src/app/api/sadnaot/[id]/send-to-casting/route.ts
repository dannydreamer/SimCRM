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

  const roles = session.user.roles
  if (!roles.includes("MANAGER") && !roles.includes("TECH"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  const workshop = await prisma.workshop.findUnique({
    where: { id },
    include: {
      scenarios: { where: { cancelled: false }, select: { id: true, actorRequirements: true } },
    },
  })
  if (!workshop) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Must be at least SPECIFIED
  if (workshop.status === "NEW" || workshop.status === "CANCELLED")
    return NextResponse.json({ error: "יש לבצע איתור צרכים לפני שליחה לליהוק" }, { status: 400 })

  // Must have at least one scenario with requirements
  const hasRequirements = workshop.scenarios.some((s) => s.actorRequirements?.trim())
  if (!hasRequirements)
    return NextResponse.json({ error: "יש להזין דרישות שחקנים לפחות לתרחיש אחד" }, { status: 400 })

  const { castingMaleNeeded, castingFemaleNeeded, castingNotes } = await req.json()

  if (castingMaleNeeded === undefined || castingMaleNeeded === null || castingMaleNeeded === "")
    return NextResponse.json({ error: "יש להזין מספר שחקנים נדרשים" }, { status: 400 })
  if (castingFemaleNeeded === undefined || castingFemaleNeeded === null || castingFemaleNeeded === "")
    return NextResponse.json({ error: "יש להזין מספר שחקניות נדרשות" }, { status: 400 })

  const isResend = !!workshop.castingSentAt
  const newMale   = Number(castingMaleNeeded)
  const newFemale = Number(castingFemaleNeeded)
  const now = new Date()

  await prisma.workshop.update({
    where: { id },
    data: {
      castingMaleNeeded:   newMale,
      castingFemaleNeeded: newFemale,
      castingNotes: castingNotes?.trim() || null,
      castingSentAt: now,
    },
  })

  // Log the send event
  await prisma.castingChangeLog.create({
    data: {
      workshopId: id,
      changeType: isResend ? "RESENT" : "SENT",
      detail: isResend ? "עדכון ושליחה חוזרת לליהוק" : "נשלח לליהוק",
    },
  })

  // If counts were reduced, trim excess confirmed actors so Step 1 stays consistent
  if (isResend) {
    const gendersToCheck: Array<{ gender: string; newCount: number; oldCount: number }> = [
      { gender: "MALE",   newCount: newMale,   oldCount: workshop.castingMaleNeeded },
      { gender: "FEMALE", newCount: newFemale, oldCount: workshop.castingFemaleNeeded },
    ]
    for (const { gender, newCount, oldCount } of gendersToCheck) {
      if (newCount >= oldCount) continue
      // Delete confirmed actors whose slotIndex is now out of range (>= newCount)
      const excess = await prisma.workshopConfirmedActor.findMany({
        where: { workshopId: id, gender, slotIndex: { gte: newCount } },
      })
      for (const c of excess) {
        // Also clear their Step 2 assignments
        await prisma.casting.deleteMany({
          where: { workshopId: id, actorId: c.actorId, isDirector: false },
        })
        await prisma.workshopConfirmedActor.delete({ where: { id: c.id } })
      }
    }
  }

  // Auto-advance: sending casting may complete the READY conditions
  await checkAndAdvanceStatus(id)

  return NextResponse.json({
    castingSentAt: now.toISOString(),
    castingMaleNeeded: Number(castingMaleNeeded),
    castingFemaleNeeded: Number(castingFemaleNeeded),
    castingNotes: castingNotes?.trim() || null,
  })
}
