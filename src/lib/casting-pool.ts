// Whether the confirmed actor pool can still cover what the scenarios ask for —
// the one casting problem only the Tech can fix. Spec §7.2.1.
//
// The distinction that matters, and the one this whole file exists to draw:
//
//   A **Step 2** change — a room added, a scenario added or cancelled, actor
//   counts moved within what the pool can cover — costs the Caster nothing but
//   re-casting. She already sees the new requirements live and gets a change
//   banner, so she needs no action from the Tech at all.
//
//   A **Step 1** shortfall stops her dead. Step 2's pickers draw only from the
//   actors confirmed in Step 1, and Step 1 has exactly `castingMaleNeeded` /
//   `castingFemaleNeeded` slots. Flip a scenario to need a שחקנית on a workshop
//   where no שחקניות were confirmed and her dropdown is simply empty, with
//   nothing on screen to say why. Only the Tech can raise the numbers.
//
// So this is a **current-state** test, not a what-changed test. It asks "does the
// pool cover the scenarios right now", which needs no change log, no timestamp
// comparison against castingSentAt, and no epoch to keep history from raising
// false alarms on live workshops. An earlier draft derived this from the change
// log and needed all three.
//
// The denominator is the deepest single scenario, not the sum: an actor may be
// cast in several rooms and several scenarios, but never twice in the same
// scenario + room (§7.4). So the pool has to cover the largest single cell.

export interface CastingPoolInput {
  castingMaleNeeded: number | null
  castingFemaleNeeded: number | null
  /** Cancelled scenarios ask for nobody. */
  scenarios: { cancelled?: boolean; maleActorsNeeded: number; femaleActorsNeeded: number }[]
}

export interface GenderShortfall {
  /** Largest number this gender is needed for in one scenario+room cell. */
  needed: number
  /** Slots the Tech opened in Step 1. */
  confirmed: number
  short: boolean
}

export interface CastingPool {
  /** Either gender is short — the Caster cannot finish, whatever she does. */
  blocked: boolean
  male: GenderShortfall
  female: GenderShortfall
}

export function castingPool(w: CastingPoolInput): CastingPool {
  const active = w.scenarios.filter((s) => !s.cancelled)

  const maxNeeded = (pick: (s: { maleActorsNeeded: number; femaleActorsNeeded: number }) => number) =>
    active.reduce((n, s) => Math.max(n, pick(s)), 0)

  const male: GenderShortfall = {
    needed:    maxNeeded((s) => s.maleActorsNeeded),
    confirmed: w.castingMaleNeeded ?? 0,
    short:     false,
  }
  const female: GenderShortfall = {
    needed:    maxNeeded((s) => s.femaleActorsNeeded),
    confirmed: w.castingFemaleNeeded ?? 0,
    short:     false,
  }
  male.short   = male.needed   > male.confirmed
  female.short = female.needed > female.confirmed

  return { blocked: male.short || female.short, male, female }
}
