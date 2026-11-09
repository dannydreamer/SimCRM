// When a room's מצגת box may be ticked — §8.4. Shared by the rooms card on
// Workshop Detail and the deck screen (§14 F-06), which tick the same box. The
// server enforces the same rules in PATCH /api/sadnaot/[id]/rooms/[rid].
//
// Generating a facilitator's deck is blocked by the very same rules (§14 F-06):
// there is no deck worth making before every scenario is written. One rule
// set, two wordings.

type PptInput = {
  facilitatorId: string | null
  /** ISO date of the workshop. */
  workshopDate: string
  allScenariosWritten: boolean
}

function block(input: PptInput, act: string): string | null {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const wDate = new Date(input.workshopDate); wDate.setHours(0, 0, 0, 0)
  if (!input.facilitatorId) return `יש לשבץ מתחקר/ת לפני ${act} מצגת`
  if (today > wDate) return `לא ניתן ${act === "סימון" ? "לסמן" : "ליצור"} מצגת לאחר תאריך הסדנה`
  if (!input.allScenariosWritten) return `יש לסמן את כל התרחישים כנכתב לפני ${act} מצגת`
  return null
}

/** Why the room's מצגת box cannot be ticked, or null. */
export const pptBlockReason = (input: PptInput) => block(input, "סימון")

/** Why a deck cannot be generated for the room's facilitator, or null — the same rules. */
export const generateBlockReason = (input: PptInput) => block(input, "יצירת")
