import { prisma } from "./prisma"
import { WorkshopStatus } from "@prisma/client"

/**
 * Checks whether the workshop should auto-advance or regress in status
 * and performs the update if so. READY, CLOSING, and CLOSED are
 * system-triggered only — no user action can set them directly.
 *
 * Transitions / regressions:
 *  SPECIFIED → READY    : all PPT received + casting fully complete + feedback form added
 *  READY     → SPECIFIED: any of the three READY conditions becomes unmet (before date)
 *  READY     → CLOSING  : workshop date has passed
 *  CLOSING   → CLOSED   : all rooms have letterReceived AND feedback complete
 *  CLOSED    → CLOSING  : any room loses letterReceived OR feedback becomes incomplete
 *
 * Returns the new status string if a change occurred, otherwise null.
 */
export async function checkAndAdvanceStatus(workshopId: string): Promise<string | null> {
  const w = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: {
      status: true,
      cancelled: true,
      date: true,
      endTime: true,
      castingSentAt: true,
      directorRequested: true,
      feedbackFormAdded: true,
      rooms: {
        where: { cancelled: false },
        select: { id: true, pptReceived: true, letterReceived: true },
      },
      scenarios: {
        where: { cancelled: false },
        select: { maleActorsNeeded: true, femaleActorsNeeded: true },
      },
      castings: {
        where: {
          OR: [
            { roomId: null },
            { room: { cancelled: false } },
          ],
        },
        select: { isDirector: true, roomId: true, actorId: true },
      },
      feedbacks: {
        select: {
          actorId: true, roomId: true,
          aspect1PrepText: true, aspect2SimText: true,
          aspect3ReflectionText: true, aspect4ProfessionalText: true,
        },
      },
    },
  })

  if (!w || w.cancelled) return null

  // Build the precise end-of-workshop datetime from date + endTime ("HH:MM")
  const now = new Date()
  const wEndDateTime = new Date(w.date)
  const [endHour, endMin] = (w.endTime ?? "23:59").split(":").map(Number)
  wEndDateTime.setHours(endHour, endMin, 0, 0)

  // ── Helper: evaluate all three READY conditions ──────────────────────────
  function readyConditionsMet(): boolean {
    // 1. All active rooms have pptReceived
    if (w!.rooms.length === 0) return false
    const allPpt = w!.rooms.every((r) => r.pptReceived)

    // 2. Casting fully complete (sent + all Step 2 slots filled)
    if (!w!.castingSentAt) return false
    const slotsPerRoom  = w!.scenarios.reduce((s, sc) => s + sc.maleActorsNeeded + sc.femaleActorsNeeded, 0)
    const castingTotal  = slotsPerRoom * w!.rooms.length + (w!.directorRequested ? 1 : 0)
    const nonDirFilled  = w!.castings.filter((c) => !c.isDirector).length
    const hasDir        = w!.castings.some((c) => c.isDirector)
    const castingFilled = nonDirFilled + (w!.directorRequested && hasDir ? 1 : 0)
    const castingComplete = castingTotal > 0 && castingFilled === castingTotal

    // 3. Feedback form added
    const feedbackDone = w!.feedbackFormAdded

    return allPpt && castingComplete && feedbackDone
  }

  // ── Helper: all expected feedback records have been entered with text ────
  // A feedback record only counts as complete when at least one aspect has
  // free text written — default green with no text is considered incomplete.
  function feedbackComplete(): boolean {
    const activeRoomIds = new Set(w!.rooms.map((r) => r.id))
    const expected = new Set(
      w!.castings
        .filter((c) => c.isDirector || (c.roomId && activeRoomIds.has(c.roomId!)))
        .map((c) => `${c.roomId}:${c.actorId}`)
    )
    if (expected.size === 0) return true // no actors cast → nothing required
    const entered = new Set(
      w!.feedbacks
        .filter((f) =>
          (f.roomId === null || activeRoomIds.has(f.roomId)) &&
          (f.aspect1PrepText?.trim() || f.aspect2SimText?.trim() ||
           f.aspect3ReflectionText?.trim() || f.aspect4ProfessionalText?.trim())
        )
        .map((f) => `${f.roomId}:${f.actorId}`)
    )
    return [...expected].every((k) => entered.has(k))
  }

  let newStatus: string | null = null

  if (w.status === "SPECIFIED") {
    if (readyConditionsMet()) newStatus = "READY"

  } else if (w.status === "READY") {
    if (now >= wEndDateTime) {
      newStatus = "CLOSING"
    } else if (!readyConditionsMet()) {
      // Regression: a condition was unmet before the end time passed
      newStatus = "SPECIFIED"
    }

  } else if (w.status === "CLOSING") {
    const hasRooms   = w.rooms.length > 0
    const allLetters = hasRooms && w.rooms.every((r) => r.letterReceived)
    if (allLetters && feedbackComplete()) newStatus = "CLOSED"

  } else if (w.status === "CLOSED") {
    // Regression: a letter was unchecked or feedback became incomplete
    const hasRooms   = w.rooms.length > 0
    const allLetters = hasRooms && w.rooms.every((r) => r.letterReceived)
    if (!allLetters || !feedbackComplete()) newStatus = "CLOSING"
  }

  if (newStatus) {
    await prisma.workshop.update({ where: { id: workshopId }, data: { status: newStatus as WorkshopStatus } })
    return newStatus
  }

  return null
}
