// Which of the five READY conditions a workshop still fails, and whether that
// failure is now urgent because the date is nearly here. See spec §4.3 and §11.
//
// This is the single source of truth for "is it ready". `checkAndAdvanceStatus`
// gates SPECIFIED → READY on it, the workshop table raises its alert from it, and
// the Workshop Detail checklist names the same conditions — so no two screens can
// disagree about what is missing.

import { castingProgress } from "./casting-progress"

/** A workshop this many days out or fewer, and not yet מוכן, raises the alert. */
export const READINESS_ALERT_DAYS = 7

export type ReadyConditionKey =
  | "needsAssessment"
  | "ppt"
  | "casting"
  | "feedbackForm"
  | "participants"
  | "roomApproval"

/** Short labels, for chips in a banner or a table row. */
export const READY_CONDITION_LABEL: Record<ReadyConditionKey, string> = {
  needsAssessment: "איתור צרכים",
  ppt:             "מצגות",
  casting:         "ליהוק",
  feedbackForm:    "טופס משוב",
  participants:    "מספר משתתפים",
  roomApproval:    "אישור חדר חיצוני",
}

export interface ReadinessInput {
  castingSentAt: Date | string | null
  directorRequested: boolean
  feedbackFormAdded: boolean
  estimatedParticipants: number | null
  locationType: string
  otherRoomApproved: boolean
  /** Location codes only — callers holding `{ location }[]` rows map them first. */
  roomLocations: string[]
  /** Rooms may arrive pre-filtered; a missing `cancelled` counts as active. */
  rooms:     { id: string; cancelled?: boolean; pptReceived: boolean }[]
  scenarios: { cancelled?: boolean; maleActorsNeeded: number; femaleActorsNeeded: number }[]
  castings:  { isDirector: boolean; roomId: string | null }[]
}

/**
 * The READY conditions (§4.3) this workshop does **not** meet, in checklist order.
 * Empty means every condition holds and the workshop qualifies for מוכן.
 */
export function unmetReadyConditions(w: ReadinessInput): ReadyConditionKey[] {
  const activeRooms = w.rooms.filter((r) => !r.cancelled)
  const unmet: ReadyConditionKey[] = []

  // 1. Every active room has its PPT. A workshop with no active rooms at all is
  //    not ready either — there is nothing to have received a presentation for.
  if (activeRooms.length === 0 || !activeRooms.every((r) => r.pptReceived)) unmet.push("ppt")

  // 2. Handed to the Caster and every Step 2 slot filled. Delegated to
  //    castingProgress so this and the ליהוק section report the same thing.
  const casting = castingProgress({
    directorRequested: w.directorRequested,
    castingSentAt:     w.castingSentAt ? new Date(w.castingSentAt) : null,
    rooms:     w.rooms.map((r)     => ({ ...r, cancelled: !!r.cancelled })),
    scenarios: w.scenarios.map((s) => ({ ...s, cancelled: !!s.cancelled })),
    castings:  w.castings,
  })
  if (!casting.started || !casting.complete) unmet.push("casting")

  // 3. Feedback form copied into the participants' Google Form.
  if (!w.feedbackFormAdded) unmet.push("feedbackForm")

  // 4. Estimated participants set. Nullable in the DB for existing rows, but
  //    required by the business rules before a workshop can be READY.
  if (w.estimatedParticipants == null) unmet.push("participants")

  // 5. A non-standard physical room, if used at the centre, must be approved.
  //    Rooms 1–3, חיצוני and זום workshops have nothing to approve.
  const usesOtherRoom = w.locationType === "CENTER" && w.roomLocations.includes("OTHER")
  if (usesOtherRoom && !w.otherRoomApproved) unmet.push("roomApproval")

  return unmet
}

/**
 * Whole days from today (Israel time) to the workshop date. 0 = today,
 * negative = past. Workshop dates are stored as UTC midnight of the intended
 * calendar day, so the comparison is made on calendar dates rather than
 * instants — otherwise Vercel's UTC clock reads a day early every Israeli
 * evening, and DST would shift the boundary twice a year.
 */
export function daysUntilWorkshop(date: Date | string, now: Date = new Date()): number {
  const workshopDay = new Date(date).toISOString().slice(0, 10)
  const todayInIsrael = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(now)
  return Math.round(
    (Date.parse(`${workshopDay}T00:00:00Z`) - Date.parse(`${todayInIsrael}T00:00:00Z`)) / 86_400_000
  )
}

export interface ReadinessAlert {
  /** 0 = today. Never negative — a past workshop raises no readiness alert. */
  daysUntil: number
  unmet: ReadyConditionKey[]
}

/**
 * The alert for a workshop that is nearly here and still not מוכן, or null when
 * there is nothing to shout about.
 *
 * Silent for: cancelled workshops, anything already READY or past its date
 * (CLOSING/CLOSED have their own flags, §11), and anything more than a week out.
 *
 * A סדנה חדשה reports only איתור צרכים. Everything downstream is genuinely
 * unmet as well, but nothing downstream can be done until the needs assessment
 * is, so listing the rest is noise.
 */
export function readinessAlert(
  w: ReadinessInput & { status: string; cancelled: boolean; date: Date | string },
  now: Date = new Date()
): ReadinessAlert | null {
  if (w.cancelled) return null
  if (w.status !== "NEW" && w.status !== "SPECIFIED") return null

  const daysUntil = daysUntilWorkshop(w.date, now)
  if (daysUntil < 0 || daysUntil > READINESS_ALERT_DAYS) return null

  const unmet: ReadyConditionKey[] =
    w.status === "NEW" ? ["needsAssessment"] : unmetReadyConditions(w)

  // Still SPECIFIED with nothing outstanding: the conditions are met and the
  // status simply has not been re-checked yet (checkAndAdvanceStatus runs after
  // mutations, not on a clock). It will flip to READY on the next one — so there
  // is nothing to raise, and certainly no empty חסר list to show.
  if (unmet.length === 0) return null

  return { daysUntil, unmet }
}

/** "היום" / "מחר" / "בעוד יומיים" / "בעוד 5 ימים" */
export function daysUntilPhrase(daysUntil: number): string {
  if (daysUntil === 0) return "היום"
  if (daysUntil === 1) return "מחר"
  if (daysUntil === 2) return "בעוד יומיים"
  return `בעוד ${daysUntil} ימים`
}
