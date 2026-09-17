// Logic checks for the casting pool test and casting state — spec §7.2.1, §7.7.
//
//   npm run check:casting
//
// Pure functions only: no database, no network, nothing to set up. These cover the
// decisions that are expensive to get wrong and awkward to exercise by hand — above
// all which changes block the Caster and which she can simply absorb, since getting
// that line wrong turns the re-send prompt into a nag people learn to dismiss.
//
// The repo has no test runner. Adding one for three pure functions would be a bigger
// change than the feature; this runs on `tsx`, already a dependency for the seed.

import { castingPool } from "../src/lib/casting-pool"
import { castingProgress, castingRequired, castingState } from "../src/lib/casting-progress"
import { unmetReadyConditions } from "../src/lib/workshop-readiness"

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a !== e) { failures++; console.log(`FAIL ${name}\n  expected ${e}\n  actual   ${a}`) }
  else console.log(`ok   ${name}`)
}

const sc = (maleActorsNeeded: number, femaleActorsNeeded: number, cancelled = false) =>
  ({ maleActorsNeeded, femaleActorsNeeded, cancelled })

console.log("\n── castingPool: can the confirmed pool cover the scenarios? ───────")

check("pool exactly covers the deepest scenario → not blocked",
  castingPool({ castingMaleNeeded: 2, castingFemaleNeeded: 1, scenarios: [sc(2, 1), sc(1, 1)] }).blocked, false)

check("pool larger than needed → not blocked",
  castingPool({ castingMaleNeeded: 4, castingFemaleNeeded: 3, scenarios: [sc(2, 1)] }).blocked, false)

// The case that started all of this: a scenario flipped to need a שחקנית on a
// workshop where no שחקניות were confirmed. Her Step 2 picker is empty and only
// the Tech can raise the number.
check("the gender flip that started this → blocked",
  castingPool({ castingMaleNeeded: 2, castingFemaleNeeded: 0, scenarios: [sc(0, 1)] }).blocked, true)

check("blocked reports which gender and by how much",
  castingPool({ castingMaleNeeded: 2, castingFemaleNeeded: 0, scenarios: [sc(0, 1)] }).female,
  { needed: 1, confirmed: 0, short: true })

check("the gender that is fine is not reported short",
  castingPool({ castingMaleNeeded: 2, castingFemaleNeeded: 0, scenarios: [sc(0, 1)] }).male.short, false)

// The denominator is the deepest single scenario, not the sum: an actor may be cast
// in several scenarios and rooms, just never twice in the same scenario+room (§7.4).
check("needs are the deepest scenario, not the sum",
  castingPool({ castingMaleNeeded: 2, castingFemaleNeeded: 0, scenarios: [sc(2, 0), sc(2, 0), sc(1, 0)] }).blocked,
  false)

check("a scenario deeper than the pool blocks even when others are shallow",
  castingPool({ castingMaleNeeded: 2, castingFemaleNeeded: 0, scenarios: [sc(1, 0), sc(3, 0)] }).blocked, true)

check("cancelled scenarios ask for nobody",
  castingPool({ castingMaleNeeded: 1, castingFemaleNeeded: 0, scenarios: [sc(1, 0), sc(5, 5, true)] }).blocked,
  false)

check("no scenarios at all → nothing to be short of",
  castingPool({ castingMaleNeeded: 0, castingFemaleNeeded: 0, scenarios: [] }).blocked, false)

check("null pool counts read as zero",
  castingPool({ castingMaleNeeded: null, castingFemaleNeeded: null, scenarios: [sc(1, 0)] }).blocked, true)

// Adding a room multiplies the cells but not the depth of any one of them, so the
// same confirmed people still cover it — she just re-casts. This is the whole
// reason the prompt does not fire on a room change.
check("adding rooms never blocks — depth is unchanged",
  castingPool({ castingMaleNeeded: 2, castingFemaleNeeded: 2, scenarios: [sc(2, 2), sc(2, 2)] }).blocked, false)

console.log("\n── castingState ──────────────────────────────────────────────────")

check("not sent → NOT_SENT",
  castingState({ started: false, complete: false, blocked: false, required: true }), "NOT_SENT")

check("not sent outranks a blocked pool",
  castingState({ started: false, complete: true, blocked: true, required: true }), "NOT_SENT")

// The workshop nobody has to cast — run by its מתחקרים, no actors, no director.
// It reads as a dash like NOT_SENT, but it is not waiting to be sent, and it must
// not be: condition 2 is unmeetable there (nothing to fill), so it is skipped.
check("nobody to cast → NOT_NEEDED",
  castingState({ started: false, complete: false, blocked: false, required: false }), "NOT_NEEDED")

check("NOT_NEEDED outranks a stale send",
  castingState({ started: true, complete: false, blocked: false, required: false }), "NOT_NEEDED")

// The old casting still fills the old slots, so a blocked workshop can read as
// complete. A green ✓ would tell the only person who can fix it there is nothing
// to do.
check("blocked outranks complete",
  castingState({ started: true, complete: true, blocked: true, required: true }), "BLOCKED")

check("blocked and incomplete → BLOCKED",
  castingState({ started: true, complete: false, blocked: true, required: true }), "BLOCKED")

check("complete and not blocked → COMPLETE",
  castingState({ started: true, complete: true, blocked: false, required: true }), "COMPLETE")

check("sent, incomplete, not blocked → IN_PROGRESS",
  castingState({ started: true, complete: false, blocked: false, required: true }), "IN_PROGRESS")

console.log("\n── the workshop nobody has to cast ───────────────────────────────")

// A workshop whose scenarios ask for no actors and wants no director used to be
// unable to reach מוכן by any action available to the Tech: condition 2 wanted a
// hand-over that send-to-casting refuses for want of דרישות שחקנים, and a filled
// slot count that can never be reached because the total is zero. Casting is now
// simply not a condition there — and comes straight back when anyone is needed.

const progress = (scenarios: ReturnType<typeof sc>[], directorRequested = false) =>
  castingProgress({
    directorRequested,
    castingSentAt: null,
    rooms:     [{ id: "r1", cancelled: false }],
    scenarios,
    castings:  [],
  })

// The button and the send route ask castingRequired() directly — the button
// having previously decided for itself, on דרישות שחקנים text, and got it wrong.
check("castingRequired agrees with castingProgress",
  castingRequired({ directorRequested: false, scenarios: [sc(0, 0)] }), progress([sc(0, 0)]).required)

check("a scenario asking for an actor needs casting", progress([sc(1, 0)]).required, true)
check("every active scenario at 0/0 needs nobody",    progress([sc(0, 0), sc(0, 0)]).required, false)
check("a cancelled scenario's actors ask for nobody", progress([sc(0, 0), sc(2, 2, true)]).required, false)
check("no scenarios at all needs nobody",             progress([]).required, false)
check("a director alone needs casting",               progress([sc(0, 0)], true).required, true)

// Unlike `complete`, `required` is not gated on rooms: a workshop that declares
// actors before any room exists still needs casting. Ticking condition 2 on the
// strength of a missing room would hide it behind condition 1.
check("actors declared before any room still need casting",
  castingProgress({
    directorRequested: false, castingSentAt: null,
    rooms: [], scenarios: [sc(1, 0)], castings: [],
  }).required, true)

// Everything except casting held, so the list is empty exactly when condition 2
// is skipped. Nothing has been sent to casting in any of these.
const ready = (scenarios: ReturnType<typeof sc>[], directorRequested = false) =>
  unmetReadyConditions({
    castingSentAt:         null,
    directorRequested,
    feedbackFormAdded:     true,
    estimatedParticipants: 20,
    locationType:          "CENTER",
    otherRoomApproved:     false,
    roomLocations:         ["ROOM_1"],
    rooms:     [{ id: "r1", cancelled: false, pptReceived: true }],
    scenarios,
    castings:  [],
  })

check("an actor-less workshop has nothing outstanding", ready([sc(0, 0)]), [])
check("the first actor-requiring scenario turns ליהוק back on", ready([sc(0, 0), sc(1, 0)]), ["casting"])
check("requesting a director turns ליהוק back on", ready([sc(0, 0)], true), ["casting"])

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

check("the gender flip drops every male slot",
  grid.filter((s) => survives(s, 0, 3)), [{ slotGender: "FEMALE", slotIndex: 0 }])

check("growing counts delete nothing", grid.filter((s) => survives(s, 5, 5)), grid)
check("unchanged counts delete nothing", grid.filter((s) => survives(s, 2, 1)), grid)

console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} FAILED\n`)
process.exit(failures === 0 ? 0 : 1)
