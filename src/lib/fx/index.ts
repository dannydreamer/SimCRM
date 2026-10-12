// 🎭 Party effects — a few seconds of play, then the page exactly as it was.
// Loaded on demand by PartyButton, so none of this ships with ordinary pages.
// §6.9

import { makeCtx, type Ctx } from "./core"
import { isSoundOn } from "./sound"
import { psychedelic } from "./effects/psychedelic"
import { gravity } from "./effects/gravity"
import { hula } from "./effects/hula"
import { bird } from "./effects/bird"
import { matrix } from "./effects/matrix"
import { star } from "./effects/star"
import { curtain } from "./effects/curtain"
import { pacman } from "./effects/pacman"
import { blackhole } from "./effects/blackhole"
import { dominoes } from "./effects/dominoes"
import { plane } from "./effects/plane"
import { aquarium } from "./effects/aquarium"
import { fireworks } from "./effects/fireworks"
import { earthquake } from "./effects/earthquake"

export { isSoundOn, setSoundOn } from "./sound"

type Run = (ctx: Ctx) => boolean

/** In menu order. A run returns false when the page lacks what it needs. */
const EFFECTS: { id: string; label: string; run: Run }[] = [
  { id: "psychedelic", label: "פסיכדלי",     run: psychedelic },
  { id: "gravity",     label: "כוח משיכה",   run: gravity },
  { id: "hula",        label: "ריקוד הולה",  run: hula },
  { id: "bird",        label: "ציפור וקן",   run: bird },
  { id: "matrix",      label: "מטריקס",      run: matrix },
  { id: "star",        label: "מגן דוד",     run: star },
  { id: "curtain",     label: "ההצגה מתחילה", run: curtain },
  { id: "pacman",      label: "פקמן",        run: pacman },
  { id: "blackhole",   label: "חור שחור",    run: blackhole },
  { id: "dominoes",    label: "דומינו",      run: dominoes },
  { id: "plane",       label: "מטוס נייר",   run: plane },
  { id: "aquarium",    label: "אקווריום",    run: aquarium },
  { id: "fireworks",   label: "זיקוקים",     run: fireworks },
  { id: "earthquake",  label: "רעידת אדמה",  run: earthquake },
]

export const FX_MENU = [{ id: "random", label: "אקראי" }, ...EFFECTS.map(({ id, label }) => ({ id, label }))]

let running = false
let last: string | null = null

export function runFx(id: string) {
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
  const ctx = makeCtx(isSoundOn(), () => { running = false })
  try {
    // Not enough on this page for the chosen one — the one that always works.
    if (!chosen.run(ctx)) psychedelic(ctx)
  } catch (e) {
    ctx.stop()
    throw e
  }
}
