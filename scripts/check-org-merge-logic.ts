// Logic checks for what happens to participant groups when one organization is
// deleted into another.
//
//   npm run check:orgmerge
//
// Pure functions only: no database. Deleting an organization moves history that
// cannot be re-derived if the plan is wrong, and the two failure modes are
// opposites — folding groups that are not the same one silently welds unrelated
// workshops together, while folding nothing hands the survivor the very
// duplication the merge was meant to clear up. Neither is visible afterwards.

import {
  planGroupFold, buildMergeNote, type MergeableGroup, type MergeNoteOrg,
} from "../src/lib/org-merge"

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a !== e) { failures++; console.log(`FAIL ${name}\n  expected ${e}\n  actual   ${a}`) }
  else console.log(`ok   ${name}`)
}

const g = (id: string, name: string, workshopCount = 0): MergeableGroup =>
  ({ id, name, workshopCount })

const plan = (source: MergeableGroup[], target: MergeableGroup[]) => {
  const p = planGroupFold(source, target)
  return {
    folds: p.folds.map((f) => `${f.fromGroupId}→${f.intoGroupId}`),
    moves: p.moves,
  }
}

console.log("\n── nothing in common ─────────────────────────────────────────────")

check("every group moves when no name matches",
  plan([g("s1", "מורים"), g("s2", "יועצות")], [g("t1", "מנהלים")]),
  { folds: [], moves: ["s1", "s2"] })

check("an empty source organization is a no-op",
  plan([], [g("t1", "מורים")]), { folds: [], moves: [] })

check("an empty target takes everything as a move",
  plan([g("s1", "מורים")], []), { folds: [], moves: ["s1"] })

console.log("\n── the ordinary clash ────────────────────────────────────────────")

check("a matching name folds, the rest move",
  plan([g("s1", "מורים"), g("s2", "יועצות")], [g("t1", "מורים")]),
  { folds: ["s1→t1"], moves: ["s2"] })

check("punctuation is not a different group — מורים. folds into מורים",
  plan([g("s1", "מורים.")], [g("t1", "מורים")]), { folds: ["s1→t1"], moves: [] })

check("gershayim are forgiven, matching the duplicate warning",
  plan([g("s1", "כיתות י\"א")], [g("t1", "כיתות יא")]), { folds: ["s1→t1"], moves: [] })

check("spacing and case do not split a group",
  plan([g("s1", "  Staff   Room ")], [g("t1", "staff room")]),
  { folds: ["s1→t1"], moves: [] })

console.log("\n── several groups sharing one name ───────────────────────────────")

// Same-named groups under one organization are legal (spec §3.4), so both sides
// can hold more than one candidate.
check("two source groups of one name both fold into the single target",
  plan([g("s1", "מורים"), g("s2", "מורים")], [g("t1", "מורים")]),
  { folds: ["s1→t1", "s2→t1"], moves: [] })

check("the busiest target group receives",
  plan([g("s1", "מורים", 1)], [g("t1", "מורים", 2), g("t2", "מורים", 9)]),
  { folds: ["s1→t2"], moves: [] })

check("a tie on workshop count is broken by the lowest id, not by input order",
  plan([g("s1", "מורים", 1)], [g("t9", "מורים", 4), g("t2", "מורים", 4)]),
  { folds: ["s1→t2"], moves: [] })

// The completion of the rule: without this the survivor inherits two groups of
// one name, which is exactly the mess the delete was supposed to resolve.
check("source groups sharing a name with each other collapse to one on arrival",
  plan([g("s1", "מורים"), g("s2", "מורים"), g("s3", "מורים")], []),
  { folds: ["s2→s1", "s3→s1"], moves: ["s1"] })

check("that collapse is per name, not across all of them",
  plan([g("s1", "מורים"), g("s2", "מורים"), g("s3", "יועצות")], []),
  { folds: ["s2→s1"], moves: ["s1", "s3"] })

console.log("\n── determinism and degenerate names ──────────────────────────────")

check("the plan does not depend on the order Prisma returned the rows in",
  plan([g("s2", "יועצות"), g("s1", "מורים")], [g("t1", "מורים")]),
  plan([g("s1", "מורים"), g("s2", "יועצות")], [g("t1", "מורים")]))

check("planGroupFold does not mutate its input", (() => {
  const source = [g("s2", "ב"), g("s1", "א")]
  planGroupFold(source, [])
  return source.map((x) => x.id)
})(), ["s2", "s1"])

// Nothing to match on, so guessing would weld unrelated history together.
check("a nameless group always moves, never folds",
  plan([g("s1", "   "), g("s2", "\"\"")], [g("t1", "  ")]),
  { folds: [], moves: ["s1", "s2"] })

console.log("\n── the merge trace ───────────────────────────────────────────────")

const org = (over: Partial<MergeNoteOrg> = {}): MergeNoteOrg => ({
  name: "אורט", city: "חולון",
  pocName: null, pocPhone: null, pocEmail: null, notes: null,
  ...over,
})
const AT = new Date("2026-09-15T09:00:00.000Z")
const note = (t: MergeNoteOrg, s: MergeNoteOrg, existing: string | null = null) =>
  buildMergeNote(t, s, "דניאל", existing, AT)

check("the trace names the deleted organization, its city, the date and the actor",
  note(org(), org({ name: "בי\"ס אורט", city: "באר שבע" })),
  "[מיזוג 15.09.26] הארגון «בי\"ס אורט» (באר שבע) נמחק וההיסטוריה שלו הועברה לכאן. ביצע/ה: דניאל.")

check("existing notes are kept, with the trace appended below them",
  note(org(), org({ name: "כפיל" }), "הערה קיימת").startsWith("הערה קיימת\n\n[מיזוג "), true)

check("a point of contact only the deleted organization had is carried over",
  note(org(), org({ pocName: "רונית", pocPhone: "050-1234567" })).split("\n")[1],
  "איש קשר מהארגון שנמחק — שם: רונית · טלפון: 050-1234567")

// The survivor is the record staff chose to keep, so its own details win.
check("a point of contact the survivor already has is not overwritten or repeated",
  note(org({ pocName: "קיים" }), org({ pocName: "רונית" })).includes("רונית"), false)

check("the deleted organization's notes are carried over rather than dropped",
  note(org(), org({ notes: "לא עובדים איתם יותר" })).endsWith(
    "הערות הארגון שנמחק: לא עובדים איתם יותר"), true)

check("nothing to carry means a single trace line",
  note(org({ pocName: "קיים" }), org()).split("\n").length, 1)

check("whitespace-only notes on either side are treated as absent",
  note(org(), org({ notes: "   " }), "   "),
  note(org(), org({ notes: null }), null))

console.log(
  failures === 0
    ? "\nAll organization-merge checks passed.\n"
    : `\n${failures} check(s) FAILED.\n`
)
process.exit(failures === 0 ? 0 : 1)
