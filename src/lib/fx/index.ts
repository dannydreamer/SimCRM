// 🎭 Party effects — a few seconds of play, then the page exactly as it was.
// Loaded on demand by PartyButton, so none of this ships with ordinary pages.
// §6.9

import { makeCtx, type Ctx } from "./core"
import { isSoundOn } from "./sound"
import { hula } from "./effects/hula"
import { bird } from "./effects/bird"
import { matrix } from "./effects/matrix"
import { star } from "./effects/star"
import { pacman } from "./effects/pacman"
import { aquarium } from "./effects/aquarium"
import { migration } from "./effects/migration"
import { origami } from "./effects/origami"

export { isSoundOn, setSoundOn } from "./sound"

type Run = (ctx: Ctx) => boolean

/** In menu order. A run returns false when the page lacks what it needs. */
const EFFECTS: { id: string; label: string; run: Run }[] = [
  { id: "hula",        label: "ריקוד הולה",  run: hula },
  { id: "bird",        label: "ציפור וקן",   run: bird },
  { id: "matrix",      label: "מטריקס",      run: matrix },
  { id: "star",        label: "מגן דוד",     run: star },
  { id: "pacman",      label: "פקמן",        run: pacman },
  { id: "aquarium",    label: "אקווריום",    run: aquarium },
  { id: "migration",   label: "נדידת ציפורים", run: migration },
  { id: "origami",     label: "ארנב אוריגמי", run: origami },
]

export const FX_MENU = [{ id: "random", label: "אקראי" }, ...EFFECTS.map(({ id, label }) => ({ id, label }))]

let running = false
let last: string | null = null

export function runFx(id: string, userName = "") {
  if (running || typeof window === "undefined") return

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const html = document.documentElement
    html.classList.add("fx-gentle")
    setTimeout(() => html.classList.remove("fx-gentle"), 1900)
    return
  }

  const pool = EFFECTS.filter((e) => e.id !== last)
  const chosen = id === "random"
    ? pool[Math.floor(Math.random() * pool.length)]
    : EFFECTS.find((e) => e.id === id)
  if (!chosen) return
  last = chosen.id

  running = true
  const ctx = makeCtx(isSoundOn(), userName.trim().split(/\s+/)[0] ?? "", () => { running = false })
  try {
    // An effect that finds too little on this page declines before touching
    // anything; then another one plays. The bird always can.
    if (!chosen.run(ctx)) {
      const others = EFFECTS.filter((e) => e !== chosen).sort(() => Math.random() - 0.5)
      if (!others.some((e) => e.run(ctx))) ctx.stop()
    }
  } catch (e) {
    ctx.stop()
    throw e
  }
}
