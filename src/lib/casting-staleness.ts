// Whether a workshop's casting has been invalidated by changes made since it was
// last sent to the Caster — and therefore whether the Tech needs to send again.
// See spec §7.2.1.
//
// Deliberately derived, not stored. There is no `castingStale` column and no flag
// to clear: the question is answered by comparing timestamps. A change that
// invalidates casting already writes a CastingChangeLog row, so "are there
// invalidating rows newer than castingSentAt?" is the whole test. Re-sending moves
// castingSentAt to now, which makes every one of those rows older than the send —
// the bar clears itself, with no cleanup code that can be forgotten.
//
// The alternative — a boolean column per change type — was rejected: it needs a
// migration, it needs clearing in send-to-casting, and it needs a new column every
// time another change joins the list. `roomAddedWarning` was that design, and it
// was never cleared by the re-send it asked for.

import { CASTING_INVALIDATING_TYPES } from "./casting-change-log"

/**
 * Change logs older than this are ignored.
 *
 * Production carries years of ROOM_ADDED / ROOM_CANCELLED / SCENARIO_CANCELLED
 * rows written after their workshop's castingSentAt. Without a cutoff, every one
 * of those workshops — including workshops sitting quietly at מוכן — would raise
 * a "casting is stale" bar the moment this shipped, for a change dealt with weeks
 * ago. The epoch limits the feature to changes made from its release onwards.
 *
 * Set this to the date the feature reaches production. It can be deleted once
 * every workshop predating it is closed.
 */
export const CASTING_STALENESS_EPOCH = new Date("2026-09-06T00:00:00Z")

/** Statuses in which the workshop is past editing and nothing can be re-sent. */
const FROZEN_STATUSES = ["CLOSING", "CLOSED", "CANCELLED"]

export interface StalenessInput {
  castingSentAt: Date | string | null
  status: string
  cancelled: boolean
  /** Active scenarios only — the send-to-casting preconditions are judged on these. */
  scenarios: { cancelled?: boolean; modelId: string | null; actorRequirements: string | null }[]
  changeLogs: { changeType: string; detail: string; createdAt: Date | string }[]
}

export interface CastingStaleness {
  /** Changes have invalidated the casting and it has not been re-sent. */
  stale: boolean
  /** Hebrew details of the invalidating changes, oldest first, for the bar. */
  reasons: string[]
  /**
   * Whether שלח לליהוק would currently be accepted. False when a scenario still
   * lacks its model or no scenario carries requirements — the same preconditions
   * the send route enforces. The bar still shows; the prompt does not, because it
   * would open a form that refuses to submit.
   */
  canSend: boolean
}

export function castingStaleness(w: StalenessInput): CastingStaleness {
  const none: CastingStaleness = { stale: false, reasons: [], canSend: false }

  // Never sent, cancelled, or past the point of editing: nothing to re-send.
  if (!w.castingSentAt || w.cancelled || FROZEN_STATUSES.includes(w.status)) return none

  const sentAt = new Date(w.castingSentAt).getTime()
  const epoch  = CASTING_STALENESS_EPOCH.getTime()

  const invalidating = new Set<string>(CASTING_INVALIDATING_TYPES)

  // `dismissed` is deliberately not consulted. That flag belongs to the Caster's
  // own banner on /lihukim; letting it clear the Tech's bar would mean one user
  // silencing another user's outstanding task.
  const relevant = w.changeLogs
    .filter((l) => invalidating.has(l.changeType))
    .map((l) => ({ ...l, at: new Date(l.createdAt).getTime() }))
    .filter((l) => l.at > sentAt && l.at >= epoch)
    .sort((a, b) => a.at - b.at)

  if (relevant.length === 0) return none

  const active = w.scenarios.filter((s) => !s.cancelled)
  const canSend =
    active.length > 0 &&
    active.some((s) => s.actorRequirements?.trim()) &&
    active.every((s) => !!s.modelId)

  return { stale: true, reasons: relevant.map((l) => l.detail), canSend }
}
