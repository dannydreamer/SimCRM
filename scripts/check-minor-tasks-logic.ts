// Logic checks for משימות נוספות and the READY gate they now share — spec §4.3.1.
//
//   npm run check:minor-tasks
//
// Pure functions only: no database, no session, nothing to set up. These exist
// because this feature quietly changed the meaning of מוכן. Six new booleans
// block it, and the two claims the whole design rests on are easy to break
// without noticing:
//
//   1. Historical workshops are untouched. The alert is silent for past dates
//      and for CLOSING/CLOSED, which is the entire reason the migration ships
//      with no backfill. If readinessAlert ever starts answering for those, a
//      year of closed workshops lights up red.
//   2. The banner order is the catalogue order, so "the first three outstanding"
//      and "the next three to do" are the same three. The alert shows a slice;
//      if the slice stops being ordered, it names arbitrary tasks.
//
// The repo has no test runner. This runs on `tsx`, the same way
// check-casting-logic.ts and check-roles-logic.ts do.

import {
  MINOR_TASKS, MINOR_TASKS_SHOWN_IN_ALERT,
  applicableMinorTasks, minorTaskProgress, minorTaskTone,
  splitAlertMinorTasks, unmetMinorTasks,
  type MinorTaskInput, type MinorTaskKey,
} from "../src/lib/workshop-minor-tasks"
import { readinessAlert, type ReadinessInput } from "../src/lib/workshop-readiness"

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a !== e) { failures++; console.log(`FAIL ${name}\n  expected ${e}\n  actual   ${a}`) }
  else console.log(`ok   ${name}`)
}

// ── Fixtures ────────────────────────────────────────────────────────────────

const ALL_KEYS = MINOR_TASKS.map((t) => t.key)

/** All six false unless overridden. */
function tasks(over: Partial<MinorTaskInput> = {}): MinorTaskInput {
  const base = Object.fromEntries(ALL_KEYS.map((k) => [k, false])) as Record<MinorTaskKey, boolean>
  return { locationType: "CENTER", ...base, ...over }
}

/** All six true unless overridden. */
function allTicked(over: Partial<MinorTaskInput> = {}): MinorTaskInput {
  const base = Object.fromEntries(ALL_KEYS.map((k) => [k, true])) as Record<MinorTaskKey, boolean>
  return { locationType: "CENTER", ...base, ...over }
}

console.log("\n── the catalogue ─────────────────────────────────────────────────")

check("six tasks", MINOR_TASKS.length, 6)
check("keys, in working order", ALL_KEYS, [
  "tiktakOrdered", "namesReceived", "scheduleSent",
  "scenariosPrinted", "summariesPrinted", "propsPrepared",
])
check("every task blocks READY today", MINOR_TASKS.every((t) => t.blocking), true)
check("exactly one task is EXTERNAL-only",
  MINOR_TASKS.filter((t) => t.scope === "EXTERNAL_ONLY").map((t) => t.key), ["propsPrepared"])

console.log("\n── applicability: the props folder is EXTERNAL-only ──────────────")

check("CENTER has five tasks",
  applicableMinorTasks({ locationType: "CENTER" }).map((t) => t.key), ALL_KEYS.slice(0, 5))
check("ZOOM has five tasks — zoom is not 'out'",
  applicableMinorTasks({ locationType: "ZOOM" }).map((t) => t.key), ALL_KEYS.slice(0, 5))
check("EXTERNAL has all six",
  applicableMinorTasks({ locationType: "EXTERNAL" }).map((t) => t.key), ALL_KEYS)

check("a CENTER workshop with props unticked is still complete",
  unmetMinorTasks(allTicked({ locationType: "CENTER", propsPrepared: false })), [])
check("the same workshop moved EXTERNAL is not",
  unmetMinorTasks(allTicked({ locationType: "EXTERNAL", propsPrepared: false })), ["propsPrepared"])
check("EXTERNAL → CENTER keeps the ticked value rather than losing it",
  minorTaskProgress(allTicked({ locationType: "CENTER" })), { done: 5, total: 5, unmet: [] })

console.log("\n── the x/y counter ──────────────────────────────────────────────")

check("nothing done, at the centre", minorTaskProgress(tasks()),
  { done: 0, total: 5, unmet: ALL_KEYS.slice(0, 5) })
check("nothing done, outside", minorTaskProgress(tasks({ locationType: "EXTERNAL" })),
  { done: 0, total: 6, unmet: ALL_KEYS })
check("two done", minorTaskProgress(tasks({ tiktakOrdered: true, namesReceived: true })),
  { done: 2, total: 5, unmet: ["scheduleSent", "scenariosPrinted", "summariesPrinted"] })
check("all done", minorTaskProgress(allTicked()), { done: 5, total: 5, unmet: [] })

console.log("\n── unmet order is catalogue order, not tick order ────────────────")

// The banner names a slice of this list, so the order has to be the order the
// Tech works in — otherwise "+2 נוספות" hides the wrong two.
check("ticking out of sequence does not reorder the remainder",
  unmetMinorTasks(tasks({ summariesPrinted: true, namesReceived: true })),
  ["tiktakOrdered", "scheduleSent", "scenariosPrinted"])

console.log("\n── the alert slice ──────────────────────────────────────────────")

check("cap is three", MINOR_TASKS_SHOWN_IN_ALERT, 3)
check("five outstanding → three named, two counted",
  splitAlertMinorTasks(ALL_KEYS.slice(0, 5)),
  { shown: ["tiktakOrdered", "namesReceived", "scheduleSent"], hidden: 2 })
check("three outstanding → all named, none hidden",
  splitAlertMinorTasks(ALL_KEYS.slice(0, 3)),
  { shown: ALL_KEYS.slice(0, 3), hidden: 0 })
check("one outstanding", splitAlertMinorTasks(["summariesPrinted"]),
  { shown: ["summariesPrinted"], hidden: 0 })
check("none outstanding", splitAlertMinorTasks([]), { shown: [], hidden: 0 })
check("the named three are the first three unticked",
  splitAlertMinorTasks(unmetMinorTasks(tasks({ tiktakOrdered: true, scheduleSent: true, locationType: "EXTERNAL" }))).shown,
  ["namesReceived", "scenariosPrinted", "summariesPrinted"])

console.log("\n── chip tone: graduated, and quiet for the past ──────────────────")

check("complete is green whatever the date", minorTaskTone(0, 1), "done")
check("complete is green even in the past", minorTaskTone(0, -30), "done")
check("inside a week is urgent", minorTaskTone(3, 7), "urgent")
check("today is urgent", minorTaskTone(1, 0), "urgent")
check("eight days out is a warning", minorTaskTone(3, 8), "warn")
check("two weeks out is a warning", minorTaskTone(3, 14), "warn")
check("beyond two weeks is quiet", minorTaskTone(5, 15), "neutral")
check("three months out is quiet — red there trains people to ignore red",
  minorTaskTone(5, 90), "neutral")
check("a past workshop is quiet, not an eternal 0/5", minorTaskTone(5, -1), "neutral")

console.log("\n── readinessAlert: the migration needs no backfill ───────────────")

// The claim: applying six false columns cannot light up historical workshops.
// Everything below is a workshop with NOTHING ticked — the state every existing
// row lands in — and only the future, still-open ones may raise anything.
const NOW = new Date("2026-09-15T09:00:00Z")

/** A workshop whose five big §4.3 conditions all pass, so only minor tasks can fail. */
function bigConditionsMet(): ReadinessInput {
  return {
    castingSentAt:         new Date("2026-09-01T00:00:00Z"),
    directorRequested:     false,
    feedbackFormAdded:     true,
    estimatedParticipants: 20,
    locationType:          "CENTER",
    otherRoomApproved:     false,
    roomLocations:         ["ROOM_1"],
    rooms:     [{ id: "r1", cancelled: false, pptReceived: true }],
    scenarios: [{ cancelled: false, maleActorsNeeded: 1, femaleActorsNeeded: 0 }],
    castings:  [{ isDirector: false, roomId: "r1" }],
  }
}

function alertFor(status: string, dateISO: string, over: Partial<MinorTaskInput> = {}) {
  return readinessAlert(
    { ...bigConditionsMet(), ...tasks(over), status, cancelled: false, date: dateISO },
    NOW
  )
}

check("CLOSED, nothing ticked → silent", alertFor("CLOSED", "2026-03-01"), null)
check("CLOSING, nothing ticked → silent", alertFor("CLOSING", "2026-09-10"), null)
check("READY, nothing ticked → silent (it is not NEW/SPECIFIED)",
  alertFor("READY", "2026-09-18"), null)
check("SPECIFIED but past → silent", alertFor("SPECIFIED", "2026-09-10"), null)
check("SPECIFIED and a month out → silent, outside the 7-day window",
  alertFor("SPECIFIED", "2026-10-20"), null)
check("cancelled → silent",
  readinessAlert({ ...bigConditionsMet(), ...tasks(), status: "SPECIFIED", cancelled: true, date: "2026-09-18" }, NOW),
  null)

console.log("\n── readinessAlert: what it does raise ────────────────────────────")

check("SPECIFIED, three days out, big conditions met, no minor tasks done",
  alertFor("SPECIFIED", "2026-09-18"),
  { daysUntil: 3, unmet: [], minorUnmet: ALL_KEYS.slice(0, 5) })
check("minor tasks alone are enough to raise it — this is the new behaviour",
  alertFor("SPECIFIED", "2026-09-18")!.unmet.length, 0)
check("everything ticked → silent, nothing left to shout about",
  readinessAlert({ ...bigConditionsMet(), ...allTicked(), status: "SPECIFIED", cancelled: false, date: "2026-09-18" }, NOW),
  null)
check("סדנה חדשה reports only איתור צרכים, never minor tasks",
  alertFor("NEW", "2026-09-18"),
  { daysUntil: 3, unmet: ["needsAssessment"], minorUnmet: [] })

// A big blocker and minor tasks together — the shape the Detail banner renders
// in two rows, and the one the table renders as chips plus a count.
const both = readinessAlert(
  { ...bigConditionsMet(), feedbackFormAdded: false, ...tasks({ tiktakOrdered: true }),
    status: "SPECIFIED", cancelled: false, date: "2026-09-16" },
  NOW
)
check("both halves reported separately", both,
  { daysUntil: 1, unmet: ["feedbackForm"],
    minorUnmet: ["namesReceived", "scheduleSent", "scenariosPrinted", "summariesPrinted"] })
check("and the banner names three of the four",
  splitAlertMinorTasks(both!.minorUnmet),
  { shown: ["namesReceived", "scheduleSent", "scenariosPrinted"], hidden: 1 })

console.log(
  failures === 0
    ? "\n✓ all checks passed\n"
    : `\n✗ ${failures} check(s) failed\n`
)
process.exit(failures === 0 ? 0 : 1)
