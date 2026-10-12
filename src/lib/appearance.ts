// Personal appearance — a colour theme per user. Purely cosmetic: nothing here
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

export interface Appearance {
  theme: ThemeId
}

export const DEFAULT_APPEARANCE: Appearance = { theme: "kitaktika" }

const LAST_KEY = "simcrm:appearance:last"
const userKey = (uid: string) => `simcrm:appearance:${uid}`

function sanitize(raw: unknown): Appearance {
  const v = (raw ?? {}) as Partial<Appearance>
  return {
    theme: THEMES.some((t) => t.id === v.theme) ? (v.theme as ThemeId) : DEFAULT_APPEARANCE.theme,
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
  return `(function(){try{var a=JSON.parse(localStorage.getItem(${JSON.stringify(key)})||"null");if(!a)return;var d=document.documentElement;if(${JSON.stringify(themes)}.indexOf(a.theme)>=0)d.dataset.theme=a.theme;else delete d.dataset.theme;}catch(e){}})()`
}
