// Physical rooms a workshop is held in. Distinct from the Room model, which is
// a simulation track / facilitator slot — both are labelled "חדר" to the user.

export const ROOM_LOCATION_LABELS: Record<string, string> = {
  ROOM_1: "חדר 1",
  ROOM_2: "חדר 2",
  ROOM_3: "חדר 3",
  OTHER:  "חדר אחר",
}

/** Canonical display order — never rely on row insertion order. */
export const ROOM_LOCATION_VALUES = Object.keys(ROOM_LOCATION_LABELS)

/** Normalises a set of stored rows to the canonical order, dropping unknowns. */
export function sortRoomLocations(locations: string[]): string[] {
  return ROOM_LOCATION_VALUES.filter((v) => locations.includes(v))
}
