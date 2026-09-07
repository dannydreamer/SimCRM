// Logic checks for casting staleness and casting state — spec §7.2.1, §7.7.
//
//   npm run check:casting
//
// Pure functions only: no database, no network, nothing to set up. These cover
// the decisions that are expensive to get wrong and awkward to exercise by hand —
// above all the epoch cutoff, which is the only thing standing between this
// feature and a "casting is stale" bar on every live workshop the day it ships.
//
// The repo has no test runner. Adding one for three pure functions would be a
// bigger change than the feature; this runs on `tsx`, which is already a
// dependency for the Prisma seed.

import { castingStaleness, CASTING_STALENESS_EPOCH } from "../src/lib/casting-staleness"
import { castingState } from "../src/lib/casting-progress"

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a !== e) { failures++; console.log(`FAIL ${name}\n  expected ${e}\n  actual   ${a}`) }
  else console.log(`ok   ${name}`)
}

const EPOCH = CASTING_STALENESS_EPOCH.getTime()
const afterEpoch  = (ms: number) => new Date(EPOCH + ms)
const beforeEpoch = (ms: number) => new Date(EPOCH - ms)

const goodScenarios = [{ cancelled: false, modelId: "m1", actorRequirements: "מטופל כועס" }]
const base = { status: "SPECIFIED", cancelled: false, scenarios: goodScenarios }

console.log("\n── castingStaleness ──────────────────────────────────────────────")

check("never sent → not stale",
  castingStaleness({ ...base, castingSentAt: null, changeLogs: [
    { changeType: "ROOM_ADDED", detail: "חדר נוסף לסדנה", createdAt: afterEpoch(2000) },
  ] }).stale, false)

check("invalidating log after send → stale",
  castingStaleness({ ...base, castingSentAt: afterEpoch(1000), changeLogs: [
    { changeType: "SCENARIO_ACTORS_CHANGED", detail: "שונה", createdAt: afterEpoch(2000) },
  ] }).stale, true)

check("log before send → not stale",
  castingStaleness({ ...base, castingSentAt: afterEpoch(3000), changeLogs: [
    { changeType: "SCENARIO_ACTORS_CHANGED", detail: "שונה", createdAt: afterEpoch(2000) },
  ] }).stale, false)

// The production-safety case. Every live workshop carrying a historical room or
// scenario change would raise a bar on day one without the epoch.
check("pre-epoch log on a live workshop → not stale",
  castingStaleness({ ...base, castingSentAt: beforeEpoch(90_000), changeLogs: [
    { changeType: "ROOM_ADDED",         detail: "יש לעדכן ליהוק", createdAt: beforeEpoch(50_000) },
    { changeType: "SCENARIO_CANCELLED", detail: "תרחיש 2 בוטל",  createdAt: beforeEpoch(10_000) },
  ] }).stale, false)

check("informational logs → not stale",
  castingStaleness({ ...base, castingSentAt: afterEpoch(1000), changeLogs: [
    { changeType: "SCENARIO_REQ",   detail: "דרישות עודכנו", createdAt: afterEpoch(2000) },
    { changeType: "MODEL_CHANGED",  detail: "מודל עודכן",    createdAt: afterEpoch(3000) },
    { changeType: "DATE_CHANGED",   detail: "נדחתה",         createdAt: afterEpoch(4000) },
    { changeType: "COUNTS_CHANGED", detail: "מספרים",        createdAt: afterEpoch(5000) },
    { changeType: "RESENT",         detail: "נשלח שוב",      createdAt: afterEpoch(6000) },
  ] }).stale, false)

for (const [name, patch] of [
  ["cancelled workshop", { cancelled: true }],
  ["CLOSING workshop",   { status: "CLOSING" }],
  ["CLOSED workshop",    { status: "CLOSED" }],
] as const) {
  check(`${name} → not stale`,
    castingStaleness({ ...base, ...patch, castingSentAt: afterEpoch(1000), changeLogs: [
      { changeType: "ROOM_ADDED", detail: "חדר נוסף לסדנה", createdAt: afterEpoch(2000) },
    ] }).stale, false)
}

check("reasons are the details, oldest first",
  castingStaleness({ ...base, castingSentAt: afterEpoch(1000), changeLogs: [
    { changeType: "SCENARIO_ADDED", detail: "תרחיש 3 נוסף לסדנה", createdAt: afterEpoch(5000) },
    { changeType: "ROOM_ADDED",     detail: "חדר נוסף לסדנה",     createdAt: afterEpoch(2000) },
  ] }).reasons, ["חדר נוסף לסדנה", "תרחיש 3 נוסף לסדנה"])

// canSend mirrors the send-to-casting preconditions (§7.2). When it is false the
// re-send prompt is suppressed, because the form it opens would refuse.
const staleLog = [{ changeType: "ROOM_ADDED", detail: "חדר נוסף לסדנה", createdAt: afterEpoch(2000) }]

check("canSend true with a model on every scenario and some requirements",
  castingStaleness({ ...base, castingSentAt: afterEpoch(1000), changeLogs: staleLog }).canSend, true)

check("canSend false when a scenario lacks its model",
  castingStaleness({ ...base, castingSentAt: afterEpoch(1000), changeLogs: staleLog,
    scenarios: [...goodScenarios, { cancelled: false, modelId: null, actorRequirements: "x" }],
  }).canSend, false)

check("canSend false when no scenario carries requirements",
  castingStaleness({ ...base, castingSentAt: afterEpoch(1000), changeLogs: staleLog,
    scenarios: [{ cancelled: false, modelId: "m1", actorRequirements: "   " }],
  }).canSend, false)

check("cancelled scenarios are ignored by canSend",
  castingStaleness({ ...base, castingSentAt: afterEpoch(1000), changeLogs: staleLog,
    scenarios: [...goodScenarios, { cancelled: true, modelId: null, actorRequirements: null }],
  }).canSend, true)

console.log("\n── castingState ──────────────────────────────────────────────────")

check("not sent → NOT_SENT",
  castingState({ started: false, complete: false, stale: false }), "NOT_SENT")

check("not sent outranks a stale flag",
  castingState({ started: false, complete: true, stale: true }), "NOT_SENT")

// The reason STALE exists. Cancelling a scenario shrinks the slot count, and the
// Caster can fill new slots off her own banner — so a stale workshop can read as
// full. A green ✓ there tells the Tech there is nothing left to do.
check("stale outranks complete",
  castingState({ started: true, complete: true, stale: true }), "STALE")

check("stale and incomplete → STALE",
  castingState({ started: true, complete: false, stale: true }), "STALE")

check("complete and not stale → COMPLETE",
  castingState({ started: true, complete: true, stale: false }), "COMPLETE")

check("sent, incomplete, not stale → IN_PROGRESS",
  castingState({ started: true, complete: false, stale: false }), "IN_PROGRESS")

console.log("\n── invalidated-slot deletion ─────────────────────────────────────")

// Mirrors the deleteMany in PATCH /api/sadnaot/[id]/scenarios/[sid]: a casting
// survives unless its slotIndex has fallen outside its gender's new count.
type Slot = { slotGender: "MALE" | "FEMALE"; slotIndex: number }
const survives = (s: Slot, newMale: number, newFemale: number) =>
  !((s.slotGender === "MALE"   && s.slotIndex >= newMale) ||
    (s.slotGender === "FEMALE" && s.slotIndex >= newFemale))

const grid: Slot[] = [
  { slotGender: "MALE",   slotIndex: 0 },
  { slotGender: "MALE",   slotIndex: 1 },
  { slotGender: "FEMALE", slotIndex: 0 },
]

check("shrinking שחקנים 2→1 drops only the out-of-range slot",
  grid.filter((s) => survives(s, 1, 1)),
  [{ slotGender: "MALE", slotIndex: 0 }, { slotGender: "FEMALE", slotIndex: 0 }])

check("the gender flip that started this drops every male slot",
  grid.filter((s) => survives(s, 0, 3)), [{ slotGender: "FEMALE", slotIndex: 0 }])

check("growing counts delete nothing", grid.filter((s) => survives(s, 5, 5)), grid)
check("unchanged counts delete nothing", grid.filter((s) => survives(s, 2, 1)), grid)

console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} FAILED\n`)
process.exit(failures === 0 ? 0 : 1)
