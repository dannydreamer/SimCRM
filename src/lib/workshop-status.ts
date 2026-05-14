import { prisma } from "./prisma"
import { WorkshopStatus } from "@prisma/client"

/**
 * Checks whether the workshop should auto-advance to the next status
 * and performs the update if so. Statuses READY, CLOSING, and CLOSED
 * are system-triggered only — no user action can set them directly.
 *
 * Transitions:
 *  SPECIFIED → READY    : castingSentAt set + all rooms slotted + all scenarios written
 *  READY     → CLOSING  : workshop date has passed
 *  CLOSING   → CLOSED   : all rooms have pptReceived + letterReceived
 *
 * Returns the new status string if an advance occurred, otherwise null.
 */
export async function checkAndAdvanceStatus(workshopId: string): Promise<string | null> {
  const w = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: {
      status: true,
      cancelled: true,
      date: true,
      castingSentAt: true,
      rooms: {
        where: { cancelled: false },
        select: { facilitatorId: true, pptReceived: true, letterReceived: true },
      },
      scenarios: {
        where: { cancelled: false },
        select: { written: true },
      },
    },
  })

  if (!w || w.cancelled) return null

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const wDate = new Date(w.date); wDate.setHours(0, 0, 0, 0)

  let newStatus: string | null = null

  if (w.status === "SPECIFIED") {
    const castingSent       = !!w.castingSentAt
    const hasScenarios      = w.scenarios.length > 0
    const allWritten        = hasScenarios && w.scenarios.every((s) => s.written)
    const hasRooms          = w.rooms.length > 0
    const allSlotted        = hasRooms && w.rooms.every((r) => r.facilitatorId)
    if (castingSent && allWritten && allSlotted) newStatus = "READY"

  } else if (w.status === "READY") {
    if (today > wDate) newStatus = "CLOSING"

  } else if (w.status === "CLOSING") {
    const hasRooms    = w.rooms.length > 0
    const allLetters  = hasRooms && w.rooms.every((r) => r.letterReceived)
    if (allLetters) newStatus = "CLOSED"
  }

  if (newStatus) {
    await prisma.workshop.update({ where: { id: workshopId }, data: { status: newStatus as WorkshopStatus } })
    return newStatus
  }

  return null
}
