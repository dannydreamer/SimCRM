import type { WorkshopStatus } from "@prisma/client"

/**
 * חדרים לספירה — the figure that answers "how much capacity did this workshop
 * use". Spec §8.12.
 *
 * Every measurement of room usage against the annual allocation goes through
 * `countedRooms()`, never through a raw room count. The rule lives here once so
 * the pivot grid, the monthly table and the xlsx export cannot drift apart.
 *
 * Cancellation is read off `status` rather than a stored snapshot. That is
 * sound, not a shortcut: cancelling writes `cancelled = true` and never touches
 * `status`, `checkAndAdvanceStatus()` returns early for a cancelled workshop,
 * and there is no un-cancel path in the UI. `status` is therefore frozen at the
 * instant of cancellation, permanently — including on rows that predate this
 * feature, which is why no backfill was needed.
 */

export const CANCEL_LABEL_AFTER_SPECIFIED = "בוטל לאחר איתור צרכים"
export const CANCEL_LABEL_PLAIN           = "מבוטל"

export type WorkshopForCount = {
  cancelled: boolean
  status: WorkshopStatus
  countedRoomsOverride: number | null
  rooms: { cancelled: boolean }[]
}

/** חדרים בפועל — active (non-soft-cancelled) rooms. Informational only. */
export function actualRooms(w: Pick<WorkshopForCount, "rooms">): number {
  return w.rooms.filter((r) => !r.cancelled).length
}

/**
 * The computed default, before any override.
 *
 *  - live workshop            → its active room count
 *  - cancelled at NEW         → 0, no work had been done yet
 *  - cancelled at any later   → 1, scenarios were written and casting had begun,
 *    status                     so the slot was consumed regardless of how many
 *                               rooms were booked
 */
export function defaultCountedRooms(w: Omit<WorkshopForCount, "countedRoomsOverride">): number {
  if (!w.cancelled) return actualRooms(w)
  return w.status === "NEW" ? 0 : 1
}

/** חדרים לספירה — the override when set, otherwise the computed default. */
export function countedRooms(w: WorkshopForCount): number {
  return w.countedRoomsOverride ?? defaultCountedRooms(w)
}

/**
 * The ביטול column. Computed live, never stored as text, never editable — a
 * Tech cannot blur the distinction by rewriting it, which is the whole point of
 * the column existing separately from `pivotNotes`.
 */
export function cancellationLabel(
  w: Pick<WorkshopForCount, "cancelled" | "status">
): string | null {
  if (!w.cancelled) return null
  return w.status === "NEW" ? CANCEL_LABEL_PLAIN : CANCEL_LABEL_AFTER_SPECIFIED
}
