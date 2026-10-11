// Logic checks for אימון שחקנים — spec §3.5.1.
//
//   npm run check:training
//
// Pure functions only: no database, no session. The design rests on two claims
// that are easy to break without noticing:
//
//   1. The training moves with the workshop. It is stored as an offset, so a
//      postponement must carry it — including across midnight and month ends.
//   2. null means "never set", not "the default". Legacy workshops already sent
//      to casting stay empty; reading null as an hour-before would print a time
//      nobody told the actors.

import {
  actorTraining, formatTraining, trainingOffsetFor, trainingPlace,
  validTrainingOffset, DEFAULT_TRAINING_OFFSET, type TrainingInput,
} from "../src/lib/actor-training"

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a !== e) { failures++; console.log(`FAIL ${name}\n  expected ${e}\n  actual   ${a}`) }
  else console.log(`ok   ${name}`)
}

function ws(over: Partial<TrainingInput> = {}): TrainingInput {
  return {
    date: "2026-05-07T00:00:00.000Z", startTime: "09:00",
    locationType: "CENTER", locationName: null,
    trainingOffsetMinutes: DEFAULT_TRAINING_OFFSET, trainingOnZoom: false,
    ...over,
  }
}

// ── Default ─────────────────────────────────────────────────────────────────
check("default: an hour before, at the centre",
  actorTraining(ws()), { date: "2026-05-07", time: "08:00", place: "במרכז", isDefault: true })
check("formatted in the house date format",
  formatTraining(actorTraining(ws())), "7.5.26 · 08:00 · במרכז")

// ── null is not the default ─────────────────────────────────────────────────
check("null offset is not set — not an hour before",
  actorTraining(ws({ trainingOffsetMinutes: null })), null)
check("and reads טרם הוזן", formatTraining(null), "טרם הוזן")

// ── Place ───────────────────────────────────────────────────────────────────
check("external follows the workshop address",
  actorTraining(ws({ locationType: "EXTERNAL", locationName: "תיכון אורט, חולון" }))?.place, "תיכון אורט, חולון")
check("external with no address still says where", trainingPlace("EXTERNAL", "  ", false), "מחוץ למרכז")
check("zoom workshop trains on zoom", trainingPlace("ZOOM", "https://zoom.us/x", false), "בזום")
check("external moved to zoom",
  actorTraining(ws({ locationType: "EXTERNAL", locationName: "חולון", trainingOnZoom: true })),
  { date: "2026-05-07", time: "08:00", place: "בזום", isDefault: false })
check("a zoom workshop at the default offset is still the default",
  actorTraining(ws({ locationType: "ZOOM" }))?.isDefault, true)

// ── Offset arithmetic ───────────────────────────────────────────────────────
check("crosses midnight backwards",
  actorTraining(ws({ startTime: "00:30" })), { date: "2026-05-06", time: "23:30", place: "במרכז", isDefault: true })
check("crosses a month end",
  actorTraining(ws({ date: "2026-03-01T00:00:00.000Z", startTime: "00:15" }))?.date, "2026-02-28")
check("a Date as well as a string", actorTraining(ws({ date: new Date("2026-05-07T00:00:00.000Z") }))?.time, "08:00")

const eveBefore = trainingOffsetFor("2026-05-07", "09:00", "2026-05-06", "18:00")
check("the evening before is an offset of -15h", eveBefore, -900)
check("and round-trips",
  actorTraining(ws({ trainingOffsetMinutes: eveBefore })), { date: "2026-05-06", time: "18:00", place: "במרכז", isDefault: false })

// ── It moves with the workshop ──────────────────────────────────────────────
check("postponing a week moves the training a week",
  actorTraining(ws({ date: "2026-05-14T00:00:00.000Z", trainingOffsetMinutes: eveBefore }))?.date, "2026-05-13")
check("moving the start time moves the default training",
  actorTraining(ws({ startTime: "13:00" }))?.time, "12:00")

// ── Validation ──────────────────────────────────────────────────────────────
check("default offset is valid", validTrainingOffset(-60), true)
check("after the start is allowed", validTrainingOffset(30), true)
check("more than a week away is not", validTrainingOffset(-8 * 24 * 60), false)
check("fractions are not", validTrainingOffset(-60.5), false)
check("strings are not", validTrainingOffset("-60"), false)

console.log(
  failures === 0
    ? "\n✓ all checks passed\n"
    : `\n✗ ${failures} check(s) failed\n`
)
process.exit(failures === 0 ? 0 : 1)
