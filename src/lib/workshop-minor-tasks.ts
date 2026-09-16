// משימות נוספות — the Tech's pre-workshop checklist. See spec §4.3.1.
//
// These are READY conditions exactly like the five in §4.3, but they are small,
// numerous, and mostly logistical, so they are kept off the workshop page and
// live behind their own overlay. Two things follow from that and both matter:
//
//  1. The catalogue below is the single place that decides which tasks exist,
//     what order they are in, which ones gate READY, and which apply to a given
//     workshop. `checkAndAdvanceStatus`, the readiness alert and the overlay all
//     read it, so none of them can name a different list.
//  2. `blocking` is a per-task flag rather than a property of the whole list.
//     Today every task blocks; demoting one to advisory is flipping that flag,
//     which keeps it visible in the overlay and drops it from the gate.

import type { ReadyConditionKey } from "./workshop-readiness"

export type MinorTaskKey =
  | "tiktakOrdered"
  | "namesReceived"
  | "scheduleSent"
  | "scenariosPrinted"
  | "summariesPrinted"
  | "propsPrepared"

/** Which workshops a task applies to. */
export type MinorTaskScope =
  /** Every workshop. */
  | "ALL"
  /** Only workshops held away from the centre — not CENTER, not ZOOM. */
  | "EXTERNAL_ONLY"

export interface MinorTaskDef {
  key: MinorTaskKey
  label: string
  /** Whether failing this task holds READY back. All true today — see §4.3.1. */
  blocking: boolean
  scope: MinorTaskScope
}

/**
 * The tasks, in the order the Tech works through them. This order is load-bearing:
 * the readiness alert shows the *first few* outstanding tasks, so "the next thing
 * to do" and "the first unticked box" have to be the same thing.
 */
export const MINOR_TASKS: readonly MinorTaskDef[] = [
  { key: "tiktakOrdered",    label: "הוזמן בתיקתק",                    blocking: true, scope: "ALL" },
  { key: "namesReceived",    label: "שמות התקבלו",                     blocking: true, scope: "ALL" },
  { key: "scheduleSent",     label: "לוח זמנים + נשלח בקבוצה",          blocking: true, scope: "ALL" },
  { key: "scenariosPrinted", label: "תרחישים הודפסו + נשלחו בקבוצה",    blocking: true, scope: "ALL" },
  { key: "summariesPrinted", label: "תקצירים הודפסו",                   blocking: true, scope: "ALL" },
  { key: "propsPrepared",    label: "הוכנו תיקיות ואביזרי תפאורה",      blocking: true, scope: "EXTERNAL_ONLY" },
] as const

export const MINOR_TASK_LABEL: Record<MinorTaskKey, string> =
  Object.fromEntries(MINOR_TASKS.map((t) => [t.key, t.label])) as Record<MinorTaskKey, string>

/** Every flag the catalogue can read, plus the location that decides applicability. */
export type MinorTaskInput = { locationType: string } & Record<MinorTaskKey, boolean>

/**
 * Whether a task applies to this workshop at all. A non-applicable task is not
 * merely satisfied — it is hidden, and excluded from the x/y count, the same way
 * §4.3's room approval simply does not exist for a זום workshop.
 *
 * Its stored boolean is left alone: a workshop that moves EXTERNAL → CENTER keeps
 * whatever was ticked, so moving back does not silently lose the work.
 */
export function minorTaskApplies(t: MinorTaskDef, locationType: string): boolean {
  return t.scope === "ALL" || locationType === "EXTERNAL"
}

/** The tasks this workshop actually has, in catalogue order. */
export function applicableMinorTasks(w: { locationType: string }): MinorTaskDef[] {
  return MINOR_TASKS.filter((t) => minorTaskApplies(t, w.locationType))
}

/**
 * The blocking tasks this workshop has not done, in catalogue order — so the
 * first entry is the next thing the Tech should do. Empty means the משימות
 * נוספות half of the READY gate is satisfied.
 */
export function unmetMinorTasks(w: MinorTaskInput): MinorTaskKey[] {
  return applicableMinorTasks(w)
    .filter((t) => t.blocking && !w[t.key])
    .map((t) => t.key)
}

export interface MinorTaskProgress {
  /** Applicable tasks ticked, blocking or not. */
  done: number
  /** Applicable tasks, blocking or not — the denominator of the x/y chip. */
  total: number
  /** Blocking tasks still outstanding, in catalogue order. */
  unmet: MinorTaskKey[]
}

/** The x/y for the chip, and the outstanding list behind it, in one pass. */
export function minorTaskProgress(w: MinorTaskInput): MinorTaskProgress {
  const applicable = applicableMinorTasks(w)
  return {
    done:  applicable.filter((t) => w[t.key]).length,
    total: applicable.length,
    unmet: applicable.filter((t) => t.blocking && !w[t.key]).map((t) => t.key),
  }
}

/**
 * How loudly the משימות נוספות chip should shout. Graduated by date rather than
 * flat red, because every task here blocks READY and a workshop three months out
 * with nothing ticked is normal — colouring that red trains the Tech to ignore
 * red. `urgent` deliberately shares §4.8's seven-day boundary so the chip turns
 * red exactly when the readiness alert appears, rather than on a second schedule.
 */
export const MINOR_TASK_WARN_DAYS = 14

export type MinorTaskTone = "done" | "urgent" | "warn" | "neutral"

export function minorTaskTone(unmetCount: number, daysUntil: number): MinorTaskTone {
  if (unmetCount === 0) return "done"
  // Past its date the workshop is heading for CLOSING and these no longer gate
  // anything, so historical rows stay quiet instead of showing an eternal 0/5.
  if (daysUntil < 0) return "neutral"
  if (daysUntil <= 7) return "urgent"
  if (daysUntil <= MINOR_TASK_WARN_DAYS) return "warn"
  return "neutral"
}

/**
 * How many outstanding minor tasks the readiness alert names individually before
 * falling back to "+N נוספות". The big §4.3 blockers are always listed in full;
 * these are capped so a banner cannot turn into the whole checklist. §4.8.
 */
export const MINOR_TASKS_SHOWN_IN_ALERT = 3

/** Convenience for the banners: the named few, and how many are left over. */
export function splitAlertMinorTasks(unmet: MinorTaskKey[]): {
  shown: MinorTaskKey[]
  hidden: number
} {
  return {
    shown:  unmet.slice(0, MINOR_TASKS_SHOWN_IN_ALERT),
    hidden: Math.max(0, unmet.length - MINOR_TASKS_SHOWN_IN_ALERT),
  }
}

/** Re-exported so callers can hold both halves of the gate without two imports. */
export type { ReadyConditionKey }
