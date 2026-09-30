// How long an event-driven banner stays on screen, and who is old enough to see
// it. See spec §4.7.1.
//
// The three warnings on the workshop table — סדנה בוטלה, הסדנה נדחתה, חדר בוטל —
// are *events*: something happened once, somebody needs to hear about it, and
// then it is over. They used to have no end. The banner showed for every
// cancelled workshop the system had ever held, forever, until each user
// personally X'd it away in their own browser; so a fresh account opened on its
// first morning to the entire history of the centre. That is what this module
// ends.
//
// Contrast the readiness alert (§4.8), which is a *condition*, not an event: it
// has no timestamp, no dismissal and no window, because it clears itself the
// moment the workshop is ready or the date passes.

/** An event-driven banner stops showing once it is this many days old. */
export const NOTIFICATION_WINDOW_DAYS = 14

const DAY_MS = 24 * 60 * 60 * 1000

export interface NotificationViewer {
  /** When this person's account was created — their personal floor. */
  createdAt: Date | string
}

/**
 * Whether an event raised at `eventAt` should still raise a banner for `viewer`.
 *
 * Three ways to answer no:
 *
 * 1. **No timestamp.** Null means no event was ever recorded. Every row that
 *    predates the migration is null, which is exactly how the historical
 *    backlog is cleared — without touching the booleans that everything else
 *    reads, and without having to guess when any of it happened.
 * 2. **Too old.** Older than NOTIFICATION_WINDOW_DAYS. A rolling wall-clock
 *    window, not a calendar-day count: there is no midnight boundary to get
 *    wrong, so unlike `daysUntilWorkshop` this needs no Asia/Jerusalem handling.
 * 3. **Older than the viewer.** An event that happened before the account
 *    existed is not that person's news. A new manager starts clean.
 *
 * Deliberate consequence of (3): a manager who joins three days after a
 * workshop was cancelled is never told by the system. For a handover that is
 * the intent — the outgoing manager owned that conversation — but it is a
 * silence, not an oversight. Confirmed by Daniel, 30 Sep 2026.
 */
export function notificationVisible(
  eventAt: Date | string | null | undefined,
  viewer: NotificationViewer,
  now: Date = new Date()
): boolean {
  if (!eventAt) return false

  const at = eventAt instanceof Date ? eventAt : new Date(eventAt)
  if (Number.isNaN(at.getTime())) return false

  if (now.getTime() - at.getTime() > NOTIFICATION_WINDOW_DAYS * DAY_MS) return false

  const floor = viewer.createdAt instanceof Date ? viewer.createdAt : new Date(viewer.createdAt)
  if (!Number.isNaN(floor.getTime()) && at.getTime() < floor.getTime()) return false

  return true
}

/**
 * The timestamp to send to the client: the event's own, or null once it is out
 * of the window. The client never does this arithmetic — the API hands it a
 * value that is already a yes or a no, the same division of labour the
 * readiness alert uses (§4.8).
 *
 * The value matters beyond the yes/no: it is what the dismissal key is built
 * from, so a *second* room cancellation in the same workshop carries a new
 * timestamp and raises a new banner instead of being swallowed by the first
 * one's dismissal.
 */
export function visibleEventAt(
  eventAt: Date | string | null | undefined,
  viewer: NotificationViewer,
  now: Date = new Date()
): string | null {
  if (!notificationVisible(eventAt, viewer, now)) return null
  const at = eventAt instanceof Date ? eventAt : new Date(eventAt!)
  return at.toISOString()
}

/**
 * The localStorage dismissal key for one event. Keyed by the event, not by the
 * workshop: dismissing today's room cancellation must not silence next week's.
 *
 * The workshop-detail page has done this since it started storing the workshop
 * date alongside its postponement dismissal; this generalises that to every
 * event-driven banner.
 */
export function dismissalKey(workshopId: string, eventAt: string): string {
  return `${workshopId}:${eventAt}`
}

/**
 * Drop stored dismissals whose event has aged out of the window. Called on
 * every write, so the arrays stay small for the life of the account instead of
 * growing without limit — the old ones were keyed by workshop id and never
 * pruned at all.
 *
 * Unparseable and legacy bare-workshop-id entries are dropped too: with the
 * window in force they can no longer suppress anything, since every visible
 * banner now carries a timestamped key.
 */
export function pruneDismissals(keys: Iterable<string>, now: Date = new Date()): string[] {
  const cutoff = now.getTime() - NOTIFICATION_WINDOW_DAYS * DAY_MS
  const kept: string[] = []
  for (const key of keys) {
    const at = key.slice(key.indexOf(":") + 1)
    const t = new Date(at).getTime()
    if (!Number.isNaN(t) && t >= cutoff) kept.push(key)
  }
  return kept
}
