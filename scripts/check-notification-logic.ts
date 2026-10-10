// Logic checks for the notification window — spec §4.7.1.
//
//   npm run check:notifications
//
// Pure functions only: no database, no network, nothing to set up. These cover the
// two floors that decide whether a banner appears at all, and the dismissal keying
// that decides whether a *second* event on the same workshop can still be heard.
// All three were wrong before this feature, and the way they were wrong was
// invisible — a banner that never ends looks the same as a banner working
// correctly until someone counts how far back it goes.

import {
  NOTIFICATION_WINDOW_DAYS,
  notificationVisible,
  visibleEventAt,
  dismissalKey,
  pruneDismissals,
} from "../src/lib/notification-window"

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a !== e) { failures++; console.log(`FAIL ${name}\n  expected ${e}\n  actual   ${a}`) }
  else console.log(`ok   ${name}`)
}

// A fixed clock, so "13 days ago" means the same thing on every run.
const NOW = new Date("2026-09-30T12:00:00.000Z")
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000)

/** An account old enough that the account floor never interferes. */
const veteran = { createdAt: new Date("2026-01-01T00:00:00.000Z") }

console.log("\n── the 14-day window ──────────────────────────────────────────────")

check("window is 14 days", NOTIFICATION_WINDOW_DAYS, 14)

check("cancelled today → visible",
  notificationVisible(daysAgo(0), veteran, NOW), true)

check("cancelled 13 days ago → still visible",
  notificationVisible(daysAgo(13), veteran, NOW), true)

check("cancelled 15 days ago → gone",
  notificationVisible(daysAgo(15), veteran, NOW), false)

// The bug this feature exists to fix: Daniel's day-one test workshop, cancelled
// in early August and still raising a red banner at the end of September.
check("the day-one test workshop → gone",
  notificationVisible(new Date("2026-08-01T09:00:00.000Z"), veteran, NOW), false)

console.log("\n── null means no event, which means nothing to show ────────────────")

// Every row that predates the migration is null. That is how the whole
// historical backlog clears on deploy without touching the booleans.
check("null timestamp → nothing",       notificationVisible(null, veteran, NOW), false)
check("undefined timestamp → nothing",  notificationVisible(undefined, veteran, NOW), false)
check("unparseable timestamp → nothing", notificationVisible("not a date", veteran, NOW), false)

console.log("\n── the new-account floor ──────────────────────────────────────────")

// The case that prompted all of this: a new manager logs in and is shown every
// cancellation the centre has ever recorded.
const newManager = { createdAt: daysAgo(2) }

check("event 5 days ago, account 2 days old → not their news",
  notificationVisible(daysAgo(5), newManager, NOW), false)

check("event 1 day ago, account 2 days old → theirs",
  notificationVisible(daysAgo(1), newManager, NOW), true)

check("a brand-new account sees nothing at all",
  [10, 5, 3, 1].map((d) => notificationVisible(daysAgo(d), { createdAt: NOW }, NOW)),
  [false, false, false, false])

// The deliberate silence, asserted so nobody "fixes" it later: an event three
// days before the handover is never shown to the incoming manager.
check("cancellation 3 days before the account existed → silent, by design",
  notificationVisible(daysAgo(6), { createdAt: daysAgo(3) }, NOW), false)

check("a veteran still sees the same event",
  notificationVisible(daysAgo(6), veteran, NOW), true)

console.log("\n── visibleEventAt: what the API hands the client ───────────────────")

check("inside the window → the ISO timestamp",
  visibleEventAt(daysAgo(3), veteran, NOW), daysAgo(3).toISOString())

check("outside the window → null, so the client renders nothing",
  visibleEventAt(daysAgo(30), veteran, NOW), null)

check("accepts an ISO string as readily as a Date",
  visibleEventAt(daysAgo(3).toISOString(), veteran, NOW), daysAgo(3).toISOString())

console.log("\n── dismissal keyed by event, not by workshop ───────────────────────")

const W = "11111111-2222-3333-4444-555555555555"
const firstCancellation  = daysAgo(9).toISOString()
const secondCancellation = daysAgo(1).toISOString()

check("two events on one workshop get two keys",
  dismissalKey(W, firstCancellation) === dismissalKey(W, secondCancellation), false)

// The under-notification bug: dismissing the first room cancellation used to
// silence every later one on that workshop, because the key was the workshop id.
const afterFirstDismissed = new Set([dismissalKey(W, firstCancellation)])
check("dismissing the first room cancellation silences it",
  afterFirstDismissed.has(dismissalKey(W, firstCancellation)), true)
check("...but the second one is still heard",
  afterFirstDismissed.has(dismissalKey(W, secondCancellation)), false)

console.log("\n── pruning keeps the stored arrays from growing forever ────────────")

check("keeps what is inside the window, drops what is not",
  pruneDismissals([
    dismissalKey(W, daysAgo(1).toISOString()),
    dismissalKey(W, daysAgo(20).toISOString()),
    dismissalKey(W, daysAgo(13).toISOString()),
  ], NOW),
  [dismissalKey(W, daysAgo(1).toISOString()), dismissalKey(W, daysAgo(13).toISOString())])

// Entries written before this change were bare workshop ids. With the window in
// force they can no longer suppress anything, so they are dropped rather than
// carried forever.
check("legacy bare-workshop-id entries are dropped",
  pruneDismissals([W, `${W}:${daysAgo(1).toISOString()}`], NOW),
  [`${W}:${daysAgo(1).toISOString()}`])

check("an empty store stays empty", pruneDismissals([], NOW), [])

console.log(
  failures === 0
    ? "\nAll notification-window checks passed.\n"
    : `\n${failures} check(s) FAILED.\n`
)
process.exit(failures === 0 ? 0 : 1)
