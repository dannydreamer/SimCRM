// אימון שחקנים — the actors' pre-workshop training. Spec §3.5.1.
//
// Stored as an offset from the workshop's start, never as a time, so a
// postponement carries the training with it and nothing has to be rewritten.
// Every screen that shows the training — Workshop Detail, the send-to-casting
// form, the Caster's page and table, the change-log text — goes through
// actorTraining(), so none of them can work it out differently.
//
// Dates here are calendar dates ("YYYY-MM-DD") and times are wall-clock "HH:MM".
// The arithmetic runs in UTC purely as a calendar: no time zone is involved, so
// an offset crossing midnight lands on the right day whatever the server's TZ.

export const DEFAULT_TRAINING_OFFSET = -60

/** How far from the workshop a training may sit — a week either way. */
export const MAX_TRAINING_OFFSET = 7 * 24 * 60

export type TrainingLocationType = "CENTER" | "EXTERNAL" | "ZOOM"

export interface TrainingInput {
  /** The workshop's date — ISO string or Date. Only the calendar date is read. */
  date: string | Date
  startTime: string
  locationType: TrainingLocationType | string
  locationName: string | null
  trainingOffsetMinutes: number | null
  trainingOnZoom: boolean
}

export interface ActorTraining {
  date: string
  time: string
  place: string
  /** An hour before, at the workshop's own place — nothing overridden. */
  isDefault: boolean
}

function calendarDate(d: string | Date): string {
  return (typeof d === "string" ? d : d.toISOString()).slice(0, 10)
}

function toMinutes(date: string, time: string): number {
  const [y, m, d] = date.split("-").map(Number)
  const [h, mi]   = time.split(":").map(Number)
  return Date.UTC(y, m - 1, d, h, mi) / 60000
}

function fromMinutes(total: number): { date: string; time: string } {
  const iso = new Date(total * 60000).toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) }
}

/** Where the training happens. Follows the workshop unless moved to Zoom. */
export function trainingPlace(
  locationType: string, locationName: string | null, onZoom: boolean
): string {
  if (onZoom || locationType === "ZOOM") return "בזום"
  if (locationType === "EXTERNAL") return locationName?.trim() || "מחוץ למרכז"
  return "במרכז"
}

/** The training, or null when it was never set (§3.5.1 — legacy workshops only). */
export function actorTraining(w: TrainingInput): ActorTraining | null {
  if (w.trainingOffsetMinutes === null || w.trainingOffsetMinutes === undefined) return null
  const at = fromMinutes(toMinutes(calendarDate(w.date), w.startTime) + w.trainingOffsetMinutes)
  return {
    ...at,
    place: trainingPlace(w.locationType, w.locationName, w.trainingOnZoom),
    isDefault: w.trainingOffsetMinutes === DEFAULT_TRAINING_OFFSET && !w.trainingOnZoom,
  }
}

/** The offset that puts the training at this date and time, for a workshop at that one. */
export function trainingOffsetFor(
  workshopDate: string | Date, startTime: string, trainingDate: string, trainingTime: string
): number {
  return toMinutes(trainingDate, trainingTime) - toMinutes(calendarDate(workshopDate), startTime)
}

/** Whether a client-sent offset is one we will store. */
export function validTrainingOffset(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && Math.abs(n) <= MAX_TRAINING_OFFSET
}

/** DD.MM.YY without padding — "7.5.26", the house date format. */
export function shortDate(date: string): string {
  const [y, m, d] = date.split("-")
  return `${Number(d)}.${Number(m)}.${y.slice(2)}`
}

/** "7.5.26 · 08:00 · במרכז", or "טרם הוזן" when there is none. */
export function formatTraining(t: ActorTraining | null): string {
  if (!t) return "טרם הוזן"
  return `${shortDate(t.date)} · ${t.time} · ${t.place}`
}
