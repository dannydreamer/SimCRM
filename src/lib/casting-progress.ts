// Casting state as the Tech's screens report it: not started, in progress, done.
// See spec §7.7.
//
// Deliberately not a number. The Tech has no part in casting beyond handing it
// over and knowing whether it is finished — the counting belongs to the Caster,
// on /lihukim, where slots are the unit of work. Attempts to give the Tech a
// fraction all failed the same way: any denominator is either the Caster's slot
// count (a workshop needing 2 actors across 3 rooms reads 0/6, meaningless here)
// or the actor count typed at send-to-casting, which is never reconciled against
// what the scenarios need and so produces people who cannot be cast. When she
// does want detail, the ליהוק section expands to the real thing — room by room,
// names present and חסר where they are not.
//
// `complete` mirrors READY condition 2 (§4.3) exactly: every Step 2 slot filled.
// It is the same test the readiness checklist uses, so the two halves of the
// Workshop Detail page cannot disagree.

export interface CastingProgressInput {
  directorRequested: boolean
  castingSentAt: Date | null
  rooms:     { id: string; cancelled: boolean }[]
  scenarios: { cancelled: boolean; maleActorsNeeded: number; femaleActorsNeeded: number }[]
  castings:  { isDirector: boolean; roomId: string | null }[]
}

export interface CastingProgress {
  /** Handed over to the Caster. Before this the Tech's screens show nothing to track. */
  started: boolean
  /** Every Step 2 slot filled — the only thing that earns a ✓. Mirrors §4.3 cond. 2. */
  complete: boolean
}

export function castingProgress(w: CastingProgressInput): CastingProgress {
  const activeRooms     = w.rooms.filter((r) => !r.cancelled)
  const activeScenarios = w.scenarios.filter((s) => !s.cancelled)
  const activeRoomIds   = new Set(activeRooms.map((r) => r.id))

  const nonDirector  = w.castings.filter((c) => !c.isDirector && c.roomId && activeRoomIds.has(c.roomId))
  const directorCast = w.castings.some((c) => c.isDirector)

  const slotsPerRoom = activeScenarios.reduce((n, s) => n + s.maleActorsNeeded + s.femaleActorsNeeded, 0)
  const slotTotal    = slotsPerRoom * activeRooms.length + (w.directorRequested ? 1 : 0)
  const slotFilled   = nonDirector.length + (w.directorRequested && directorCast ? 1 : 0)

  return {
    started: !!w.castingSentAt,
    // The activeRooms guard mirrors READY condition 1, which already fails a
    // workshop with no active rooms — so this cannot claim complete where the
    // readiness checklist would disagree.
    complete: activeRooms.length > 0 && slotTotal > 0 && slotFilled === slotTotal,
  }
}
