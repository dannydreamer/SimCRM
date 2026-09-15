// Folding one organization's participant groups into another's, when a deleted
// organization hands its history over to the one that survives.
//
// Pure functions, deliberately kept out of the route so they can be checked
// without a database: `npm run check:orgmerge`.

import { orgSearchKey } from "./org-search"

export interface MergeableGroup {
  id:            string
  name:          string
  workshopCount: number
}

export interface GroupFoldPlan {
  /** The source group's workshops move to `intoGroupId`, then it is deleted. */
  folds: { fromGroupId: string; intoGroupId: string }[]
  /** Source group ids that simply change organizationId — nothing to fold into. */
  moves: string[]
}

/**
 * Picks the group that receives everything else sharing its name.
 *
 * Two groups under one organization may legitimately share a name (spec §3.4),
 * so there can be more than one candidate. The busiest wins — it is the one
 * already carrying the history — and the lowest id breaks a tie, so the plan
 * never depends on the order Prisma happened to return the rows in.
 */
function pickReceiver(a: MergeableGroup, b: MergeableGroup): MergeableGroup {
  if (a.workshopCount !== b.workshopCount) return a.workshopCount > b.workshopCount ? a : b
  return a.id <= b.id ? a : b
}

/**
 * How the source organization's groups land on the target: which fold into an
 * existing group of the same name, and which move across untouched.
 *
 * Names are matched on `orgSearchKey`, the same folding the duplicate-name
 * warning uses, so `מורים` and `מורים.` are one group rather than two. A group
 * whose name is empty or punctuation-only has no key to match on and always
 * moves — guessing there would silently merge unrelated history.
 *
 * Source groups that share a key with *each other* but with nothing on the
 * target still end up as one group: the first moves across, the rest fold into
 * it. Otherwise deleting an organization would hand the survivor the very
 * duplication this is meant to clear up.
 */
export function planGroupFold(
  sourceGroups: MergeableGroup[],
  targetGroups: MergeableGroup[]
): GroupFoldPlan {
  const receivers = new Map<string, MergeableGroup>()
  for (const g of targetGroups) {
    const key = orgSearchKey(g.name)
    if (!key) continue
    const held = receivers.get(key)
    receivers.set(key, held ? pickReceiver(held, g) : g)
  }

  const folds: GroupFoldPlan["folds"] = []
  const moves: string[] = []

  // Sorted by id so the plan is a function of the data alone, not of query order.
  for (const g of [...sourceGroups].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const key = orgSearchKey(g.name)
    if (!key) { moves.push(g.id); continue }

    const receiver = receivers.get(key)
    if (receiver) {
      folds.push({ fromGroupId: g.id, intoGroupId: receiver.id })
    } else {
      moves.push(g.id)
      receivers.set(key, g)
    }
  }

  return { folds, moves }
}

export interface MergeNoteOrg {
  name:     string
  city:     string
  pocName:  string | null
  pocPhone: string | null
  pocEmail: string | null
  notes:    string | null
}

/** DD.MM.YY, the date format used everywhere in the UI (CLAUDE.md). */
function shortDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(-2)}`
}

/**
 * The surviving organization's notes, with a line recording the merge appended.
 *
 * There is no audit log in this system, so this line is the only trace that the
 * deleted organization ever existed. It also carries over a point of contact the
 * survivor does not already have, which would otherwise be the one piece of data
 * a merge destroys outright — everything else moves with the groups.
 */
export function buildMergeNote(
  target: MergeNoteOrg,
  source: MergeNoteOrg,
  actorName: string,
  existingNotes: string | null,
  now = new Date()
): string {
  const lines = [
    `[מיזוג ${shortDate(now)}] הארגון «${source.name}» (${source.city}) נמחק וההיסטוריה שלו הועברה לכאן. ביצע/ה: ${actorName}.`,
  ]

  const carried = [
    !target.pocName  && source.pocName  ? `שם: ${source.pocName}`   : null,
    !target.pocPhone && source.pocPhone ? `טלפון: ${source.pocPhone}` : null,
    !target.pocEmail && source.pocEmail ? `דוא"ל: ${source.pocEmail}` : null,
  ].filter(Boolean)

  if (carried.length > 0) {
    lines.push(`איש קשר מהארגון שנמחק — ${carried.join(" · ")}`)
  }
  const sourceNotes = source.notes?.trim()
  if (sourceNotes) {
    lines.push(`הערות הארגון שנמחק: ${sourceNotes}`)
  }

  const trace = lines.join("\n")
  const before = existingNotes?.trim()
  return before ? `${before}\n\n${trace}` : trace
}
