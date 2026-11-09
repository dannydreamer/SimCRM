// When a room's מצגת box may be ticked — §8.4. Shared by the rooms card on
// Workshop Detail and the deck screen (§14 F-06), which tick the same box. The
// server enforces the same rules in PATCH /api/sadnaot/[id]/rooms/[rid].

export function pptBlockReason(input: {
  facilitatorId: string | null
  /** ISO date of the workshop. */
  workshopDate: string
  allScenariosWritten: boolean
}): string | null {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const wDate = new Date(input.workshopDate); wDate.setHours(0, 0, 0, 0)
  if (!input.facilitatorId) return "יש לשבץ מתחקר/ת לפני סימון מצגת"
  if (today > wDate) return "לא ניתן לסמן מצגת לאחר תאריך הסדנה"
  if (!input.allScenariosWritten) return "יש לסמן את כל התרחישים כנכתב לפני סימון מצגת"
  return null
}
