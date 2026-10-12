// The header greeting — by Israel time, with Shabbat and a few holidays. §6.9

export interface Greeting {
  text: string
  emoji: string
}

function israelParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem", weekday: "short", hour: "numeric", hourCycle: "h23",
  }).formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
  return { weekday: get("weekday"), hour: Number(get("hour")) }
}

function hebrewParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-u-ca-hebrew", {
    timeZone: "Asia/Jerusalem", day: "numeric", month: "long",
  }).formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
  return { day: Number(get("day")), month: get("month") }
}

function holiday(date: Date): Greeting | null {
  const { day, month } = hebrewParts(date)
  if (month === "Tishri" && day <= 10) return { text: "שנה טובה", emoji: "🍎" }
  if (month === "Tishri" && day >= 15 && day <= 22) return { text: "חג שמח", emoji: "🌿" }
  // Kislev has 29 or 30 days, so Tevet 2 is the eighth candle in a long year
  // and the seventh in a short one — near enough for a greeting.
  if ((month === "Kislev" && day >= 25) || (month === "Tevet" && day <= 2)) return { text: "חנוכה שמח", emoji: "🕎" }
  if ((month === "Adar" || month === "Adar II") && day === 14) return { text: "פורים שמח", emoji: "🎭" }
  if (month === "Nisan" && day >= 15 && day <= 21) return { text: "חג שמח", emoji: "🌸" }
  return null
}

export function greetingFor(date: Date): Greeting {
  const h = holiday(date)
  if (h) return h
  const { weekday, hour } = israelParts(date)
  if ((weekday === "Fri" && hour >= 12) || (weekday === "Sat" && hour < 18)) return { text: "שבת שלום", emoji: "🕯️" }
  if (weekday === "Sat") return { text: "שבוע טוב", emoji: "✨" }
  if (hour >= 5 && hour < 12) return { text: "בוקר טוב", emoji: "☀️" }
  if (hour >= 12 && hour < 17) return { text: "צהריים טובים", emoji: "🌤️" }
  if (hour >= 17 && hour < 21) return { text: "ערב טוב", emoji: "🌆" }
  return { text: "לילה טוב", emoji: "🌙" }
}
