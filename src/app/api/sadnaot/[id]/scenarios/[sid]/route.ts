import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { checkAndAdvanceStatus } from "@/lib/workshop-status"

const FROZEN_STATUSES = ["CLOSING", "CLOSED", "CANCELLED"]

async function logIfCastingSent(workshopId: string, changeType: string, detail: string) {
  const w = await prisma.workshop.findUnique({ where: { id: workshopId }, select: { castingSentAt: true } })
  if (w?.castingSentAt) {
    await prisma.castingChangeLog.create({ data: { workshopId, changeType, detail } })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sid: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const roles = session.user.roles
  const isManager = roles.includes("MANAGER")
  const isTech = roles.includes("TECH")
  if (!isManager && !isTech)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id, sid } = await params
  const w = await prisma.workshop.findUnique({ where: { id }, select: { status: true, castingSentAt: true } })
  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (FROZEN_STATUSES.includes(w.status))
    return NextResponse.json({ error: "הסדנה נעולה לעריכה" }, { status: 403 })

  const sc = await prisma.scenario.findUnique({ where: { id: sid } })
  if (!sc || sc.workshopId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { topicId, modelId, name, actorRequirements, maleActorsNeeded, femaleActorsNeeded, written } = await req.json()
  const data: Record<string, unknown> = {}
  if (topicId !== undefined) data.topicId = topicId
  if (modelId !== undefined) data.modelId = modelId || null
  if (name !== undefined) data.name = name?.trim() || null
  if (actorRequirements !== undefined) data.actorRequirements = actorRequirements?.trim() || null
  if (maleActorsNeeded !== undefined)   data.maleActorsNeeded   = Math.max(0, Number(maleActorsNeeded)   || 0)
  if (femaleActorsNeeded !== undefined) data.femaleActorsNeeded = Math.max(0, Number(femaleActorsNeeded) || 0)
  if (written !== undefined) data.written = written

  const updated = await prisma.scenario.update({
    where: { id: sid },
    data,
    include: {
      topic: { select: { id: true, name: true } },
      model: { select: { id: true, name: true } },
    },
  })

  const scenarioLabel = sc.name ? `תרחיש "${sc.name}"` : `תרחיש ${sc.orderIndex + 1}`

  // ── Actor counts ────────────────────────────────────────────────────────────
  // A gender or count change invalidates the Caster's slot grid, unlike the free
  // text below it. Two things follow: the change is logged so the Tech's "send
  // again" bar can see it (§7.2.1), and the castings whose slot no longer exists
  // are deleted. Leaving them was the bug this fixes — a slot is identified by
  // (scenario, room, slotGender, slotIndex), so flipping 1 שחקן to 1 שחקנית left
  // the MALE row in place, unreachable from the grid, which renders slots from the
  // current counts only. It still counted toward castingProgress, so the workshop
  // read ליהוק הושלם and stayed מוכן while the Caster saw an empty slot.
  const newMale   = maleActorsNeeded   !== undefined ? (data.maleActorsNeeded   as number) : sc.maleActorsNeeded
  const newFemale = femaleActorsNeeded !== undefined ? (data.femaleActorsNeeded as number) : sc.femaleActorsNeeded
  const countsChanged = newMale !== sc.maleActorsNeeded || newFemale !== sc.femaleActorsNeeded

  if (countsChanged) {
    // gte is right for both directions: when a count grows, no index is out of
    // range and nothing is deleted.
    await prisma.casting.deleteMany({
      where: {
        workshopId: id,
        scenarioId: sid,
        isDirector: false,
        OR: [
          { slotGender: "MALE",   slotIndex: { gte: newMale } },
          { slotGender: "FEMALE", slotIndex: { gte: newFemale } },
        ],
      },
    })

    if (w.castingSentAt) {
      await prisma.castingChangeLog.create({
        data: {
          workshopId: id,
          changeType: "SCENARIO_ACTORS_CHANGED",
          detail: `דרישות השחקנים של ${scenarioLabel} שונו — שחקנים: ${newMale}, שחקניות: ${newFemale}`,
        },
      })
    }
  }

  // Log if requirements changed after casting was sent
  if (
    w.castingSentAt &&
    actorRequirements !== undefined &&
    (actorRequirements?.trim() || null) !== sc.actorRequirements
  ) {
    await prisma.castingChangeLog.create({
      data: {
        workshopId: id,
        changeType: "SCENARIO_REQ",
        detail: `דרישות ${scenarioLabel} עודכנו`,
      },
    })
  }

  // Log if the simulation model changed after casting was sent — before that it is
  // ordinary Tech workflow and must stay silent
  if (
    w.castingSentAt &&
    modelId !== undefined &&
    (modelId || null) !== sc.modelId
  ) {
    await prisma.castingChangeLog.create({
      data: {
        workshopId: id,
        changeType: "MODEL_CHANGED",
        detail: updated.model
          ? `מודל הסימולציה של ${scenarioLabel} עודכן ל"${updated.model.name}"`
          : `מודל הסימולציה של ${scenarioLabel} הוסר`,
      },
    })
  }

  // Bug 1: if a scenario is un-written, auto-uncheck PPT on all active rooms
  if (written === false) {
    await prisma.room.updateMany({
      where: { workshopId: id, cancelled: false, pptReceived: true },
      data: { pptReceived: false },
    })
  }

  // Auto-advance workshop status (all written → READY).
  // MUST run after the PPT reset above: it evaluates READY condition 1 against
  // pptReceived, so running it first judged the regression on stale values and
  // left the workshop READY with every מצגת unchecked.
  //
  // Counts changing must re-evaluate too: the deletion above can empty a slot, and
  // adding a slot leaves one unfilled — either way ליהוק stops being complete and
  // a מוכן workshop has to regress. Before this, a counts-only edit never called
  // it at all and the workshop stayed מוכן on invalid casting.
  const workshopStatus =
    written !== undefined || countsChanged ? await checkAndAdvanceStatus(id) : null

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    topicId: updated.topicId,
    topicName: updated.topic.name,
    modelId: updated.modelId,
    modelName: updated.model?.name ?? null,
    actorRequirements: updated.actorRequirements,
    maleActorsNeeded: updated.maleActorsNeeded,
    femaleActorsNeeded: updated.femaleActorsNeeded,
    written: updated.written,
    cancelled: updated.cancelled,
    orderIndex: updated.orderIndex,
    ...(workshopStatus !== null && { workshopStatus }),
  })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sid: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const roles = session.user.roles
  if (!roles.includes("MANAGER") && !roles.includes("TECH"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id, sid } = await params
  const w = await prisma.workshop.findUnique({ where: { id }, select: { status: true } })
  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (FROZEN_STATUSES.includes(w.status))
    return NextResponse.json({ error: "הסדנה נעולה לעריכה" }, { status: 403 })

  const sc = await prisma.scenario.findUnique({ where: { id: sid } })
  if (!sc || sc.workshopId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.scenario.update({ where: { id: sid }, data: { cancelled: true } })

  // Log if casting was already sent
  const label = sc.name ? `תרחיש "${sc.name}"` : `תרחיש ${sc.orderIndex + 1}`
  await logIfCastingSent(id, "SCENARIO_CANCELLED", `${label} בוטל`)

  return NextResponse.json({ ok: true })
}
