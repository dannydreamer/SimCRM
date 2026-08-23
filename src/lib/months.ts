// Client-safe month constants. Kept out of `pivot-data.ts` so the pivot page can
// import them without pulling the Prisma client into the browser bundle.

export const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

export const MONTH_NAMES_HE = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
]

export function monthName(month: number): string {
  return MONTH_NAMES_HE[month - 1] ?? String(month)
}
