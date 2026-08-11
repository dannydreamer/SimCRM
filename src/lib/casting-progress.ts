// Casting progress as everyone outside the Casting page needs to read it: how many
// of the people this workshop asked for are actually cast. See spec §7.7.
//
// The denominator is **people** — castingMaleNeeded + castingFemaleNeeded + director
// — not Step 2 slots. A workshop needing two actors across three rooms reads 0/2,
// not the 0/6 the slot formula produces, which is a number only the Caster can act
// on.
//
// The numerator is **Step 2 reality**. A person counts only once assigned
// everywhere they are needed. Step 1 confirmation alone never advances it: "we have
// the actors" and "casting is done" are different claims, and showing the first as
// if it were the second is what made a half-cast workshop look finished.
//
// `complete` is deliberately NOT derived from the fraction. It mirrors READY
// condition 2 (§4.3) exactly — every Step 2 slot filled — so this can never show a
// ✓ while the readiness checklist on the same page says otherwise. The two really
// can disagree: castingMaleNeeded/castingFemaleNeeded are typed by hand at
// send-to-casting and are never reconciled against the scenarios' per-scenario
// needs, so "people asked for" and "slots to fill" are independent numbers.

export interface CastingProgressInput {
  directorRequested: boolean
  castingMaleNeeded: number | null
  castingFemaleNeeded: number | null
  confirmedActorCount: number
  rooms:     { id: string; cancelled: boolean }[]
  scenarios: { cancelled: boolean; maleActorsNeeded: number; femaleActorsNeeded: number }[]
  castings:  { isDirector: boolean; roomId: string | null; slotGender: string | null; slotIndex: number }[]
}

export interface CastingProgress {
  filled: number
  total: number
  /** Every Step 2 slot filled — the only thing that earns a ✓. Mirrors §4.3 cond. 2. */
  complete: boolean
  /** Step 1 done: every requested actor confirmed. Drives the "אושרו, טרם לוהקו" state. */
  allConfirmed: boolean
  directorRequested: boolean
  directorCast: boolean
}

export function castingProgress(w: CastingProgressInput): CastingProgress {
  const activeRooms     = w.rooms.filter((r) => !r.cancelled)
  const activeScenarios = w.scenarios.filter((s) => !s.cancelled)
  const activeRoomIds   = new Set(activeRooms.map((r) => r.id))

  const nonDirector  = w.castings.filter((c) => !c.isDirector && c.roomId && activeRoomIds.has(c.roomId))
  const directorCast = w.castings.some((c) => c.isDirector)

  const maleNeeded   = w.castingMaleNeeded   ?? 0
  const femaleNeeded = w.castingFemaleNeeded ?? 0

  // One "line" per person asked for. A line is deployed when every slot it owns —
  // its index, in each scenario needing that many actors, in each active room — has
  // an assignment. A line no scenario needs is vacuously deployed: there is nothing
  // left to assign for it, so a Tech who over-counted must not freeze the fraction
  // one short forever.
  const lineDeployed = (gender: "MALE" | "FEMALE", index: number) => {
    // With every room cancelled there is nowhere to cast anyone, so nobody is
    // deployed — "vacuously deployed" must not turn an empty workshop into a full
    // fraction.
    if (activeRooms.length === 0) return false
    const scenariosNeeding = activeScenarios.filter(
      (s) => (gender === "MALE" ? s.maleActorsNeeded : s.femaleActorsNeeded) > index
    ).length
    const expected = scenariosNeeding * activeRooms.length
    if (expected === 0) return true
    const actual = nonDirector.filter((c) => c.slotGender === gender && c.slotIndex === index).length
    return actual >= expected
  }

  let filled = 0
  for (let i = 0; i < maleNeeded;   i++) if (lineDeployed("MALE", i))   filled++
  for (let i = 0; i < femaleNeeded; i++) if (lineDeployed("FEMALE", i)) filled++
  if (w.directorRequested && directorCast) filled++

  const total = maleNeeded + femaleNeeded + (w.directorRequested ? 1 : 0)

  // Step 2 slot truth, identical to condition 2 in checkAndAdvanceStatus().
  const slotsPerRoom = activeScenarios.reduce((n, s) => n + s.maleActorsNeeded + s.femaleActorsNeeded, 0)
  const slotTotal    = slotsPerRoom * activeRooms.length + (w.directorRequested ? 1 : 0)
  const slotFilled   = nonDirector.length + (w.directorRequested && directorCast ? 1 : 0)

  const peopleNeeded = maleNeeded + femaleNeeded

  return {
    filled,
    total,
    // The activeRooms guard mirrors READY condition 1, which already fails a
    // workshop with no active rooms — so this cannot claim complete where the
    // readiness checklist would disagree.
    complete: activeRooms.length > 0 && slotTotal > 0 && slotFilled === slotTotal,
    allConfirmed: peopleNeeded > 0 && w.confirmedActorCount >= peopleNeeded,
    directorRequested: w.directorRequested,
    directorCast,
  }
}
