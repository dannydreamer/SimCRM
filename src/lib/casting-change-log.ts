// The CastingChangeLog vocabulary — one definition, read by every screen that
// shows a change. Spec §3.12.
//
// These lists were previously inline literals repeated in the two /api/lihukim
// routes and again in the Caster's page component, so adding a type meant editing
// three places and silently dropping the new alert if you missed one (both filters
// are allowlists, so a missing entry fails quietly rather than loudly).

/** Every type surfaced to the Caster as a change-alert banner. SENT is excluded — it opens the work, it is not a change to it. */
export const CASTER_ALERT_TYPES = [
  "SCENARIO_REQ",
  "SCENARIO_ACTORS_CHANGED",
  "SCENARIO_ADDED",
  "SCENARIO_CANCELLED",
  "ROOM_CANCELLED",
  "ROOM_ADDED",
  "COUNTS_CHANGED",
  "MODEL_CHANGED",
  "RESENT",
  "DATE_CHANGED",
] as const

/**
 * The subset that makes the Caster's slot grid structurally wrong, so the Tech
 * has to send to casting again (§7.2.1).
 *
 * The rest are informational: the Caster needs to know, but nothing about the
 * shape of her work changed, so there is nothing for the Tech to re-send. Keeping
 * that line sharp is what stops the re-send prompt becoming background noise.
 */
export const CASTING_INVALIDATING_TYPES = [
  "SCENARIO_ACTORS_CHANGED",
  "SCENARIO_ADDED",
  "SCENARIO_CANCELLED",
  "ROOM_ADDED",
  "ROOM_CANCELLED",
] as const

export const CHANGE_TYPE_LABELS: Record<string, string> = {
  SENT:                    "נשלח לליהוק",
  RESENT:                  "עדכון ושליחה חוזרת לליהוק",
  SCENARIO_REQ:            "דרישות שחקנים עודכנו",
  SCENARIO_ACTORS_CHANGED: "מספר השחקנים בתרחיש שונה",
  SCENARIO_ADDED:          "תרחיש נוסף לסדנה",
  SCENARIO_CANCELLED:      "תרחיש בוטל",
  ROOM_CANCELLED:          "חדר בוטל",
  ROOM_ADDED:              "חדר נוסף לסדנה",
  COUNTS_CHANGED:          "מספרים כמותיים עודכנו",
  MODEL_CHANGED:           "מודל סימולציה עודכן",
  DATE_CHANGED:            "הסדנה נדחתה",
}
