// Personal appearance — a colour theme and a header background per user. Purely cosmetic: nothing here
// touches the database, and status / RAG colours never change with it. §6.9
//
// The choice lives in localStorage, keyed per user so two people sharing a
// browser keep their own. `…:last` mirrors whoever chose most recently, so the
// login page (no user yet) and the first paint after it look the same.

export const THEMES = [
  { id: "kitaktika", label: "כיתקטיקה", swatch: ["#2C4B9A", "#EEF2FF"] },
  { id: "sea",       label: "ים",        swatch: ["#0E7C86", "#E3F2F1"] },
  { id: "sunset",    label: "שקיעה",     swatch: ["#B5533C", "#FBEDE7"] },
  { id: "forest",    label: "יער",       swatch: ["#2F6B3F", "#EAF3EC"] },
  { id: "lavender",  label: "לבנדר",     swatch: ["#6B5B9A", "#F1EEF8"] },
] as const

export type ThemeId = (typeof THEMES)[number]["id"]

// Patterns are drawn in globals.css; "seasonal" resolves to one of them by the
// Hebrew month, so it changes on its own through the year.
export const BACKGROUNDS = [
  { id: "none",        label: "ללא" },
  { id: "seasonal",    label: "לפי העונה" },
  { id: "stone",       label: "אבן ירושלמית" },
  { id: "olive",       label: "ענפי זית" },
  { id: "waves",       label: "גלים" },
  { id: "pomegranate", label: "רימונים" },
  { id: "blossom",     label: "פריחה" },
  { id: "geometric",   label: "גיאומטרי" },
] as const

export type BackgroundId = (typeof BACKGROUNDS)[number]["id"]

export interface Appearance {
  theme: ThemeId
  bg: BackgroundId
}

export const DEFAULT_APPEARANCE: Appearance = { theme: "kitaktika", bg: "none" }

/**
 * Elul–Tishri pomegranates (the holidays), Heshvan–Tevet waves (the rains),
 * Shevat–Nisan blossom (the almond trees), Iyar–Av olive branches.
 * Self-contained on purpose: its source is inlined into the init script.
 */
export function seasonalPattern(date: Date): string {
  const m = new Intl.DateTimeFormat("en-u-ca-hebrew", { month: "long", timeZone: "Asia/Jerusalem" }).format(date)
  if (/^(Elul|Tishri)/.test(m)) return "pomegranate"
  if (/^(Heshvan|Kislev|Tevet)/.test(m)) return "waves"
  if (/^(Shevat|Adar|Nisan)/.test(m)) return "blossom"
  return "olive"
}

const LAST_KEY = "simcrm:appearance:last"
const userKey = (uid: string) => `simcrm:appearance:${uid}`

function sanitize(raw: unknown): Appearance {
  const v = (raw ?? {}) as Partial<Appearance>
  return {
    theme: THEMES.some((t) => t.id === v.theme) ? (v.theme as ThemeId) : DEFAULT_APPEARANCE.theme,
    bg: BACKGROUNDS.some((b) => b.id === v.bg) ? (v.bg as BackgroundId) : DEFAULT_APPEARANCE.bg,
  }
}

export function loadAppearance(uid: string): Appearance {
  try {
    return sanitize(JSON.parse(localStorage.getItem(userKey(uid)) ?? "null"))
  } catch {
    return DEFAULT_APPEARANCE
  }
}

export function saveAppearance(uid: string, a: Appearance) {
  try {
    const json = JSON.stringify(a)
    localStorage.setItem(userKey(uid), json)
    localStorage.setItem(LAST_KEY, json)
  } catch {
    // Private window or blocked storage — the choice just won't stick.
  }
}

export function applyAppearance(a: Appearance) {
  const el = document.documentElement
  if (a.theme === "kitaktika") delete el.dataset.theme
  else el.dataset.theme = a.theme
  if (a.bg === "none") delete el.dataset.bg
  else el.dataset.bg = a.bg === "seasonal" ? seasonalPattern(new Date()) : a.bg
}

/**
 * Inline script that applies the stored appearance before first paint, so a
 * themed page never flashes navy. With a uid it reads that user's choice,
 * otherwise the last one chosen in this browser. Ids are checked against the
 * known list, so a tampered value can't inject anything.
 */
export function appearanceInitScript(uid?: string): string {
  const key = uid ? userKey(uid) : LAST_KEY
  const themes = THEMES.map((t) => t.id).filter((id) => id !== "kitaktika")
  const bgs = BACKGROUNDS.map((b) => b.id).filter((id) => id !== "none" && id !== "seasonal")
  return `(function(){try{var a=JSON.parse(localStorage.getItem(${JSON.stringify(key)})||"null");if(!a)return;var d=document.documentElement;`
    + `if(${JSON.stringify(themes)}.indexOf(a.theme)>=0)d.dataset.theme=a.theme;else delete d.dataset.theme;`
    + `var b=a.bg==="seasonal"?(${seasonalPattern.toString()})(new Date()):a.bg;`
    + `if(${JSON.stringify(bgs)}.indexOf(b)>=0)d.dataset.bg=b;else delete d.dataset.bg;`
    + `}catch(e){}})()`
}
