import { type Ctx, appRoot, canvasLayer, ease, easeOut, el, lerp, phase, setStyle } from "../core"

// The whole page becomes a sheet of paper: it shrinks to a square, folds
// corner to corner, folds again, and is shaped into an origami bunny. The
// background turns into a forest, and the bunny hops away to the left.

type P = { x: number; y: number }

const PAPER = "#F4F1EA"

// The bunny in its own 260 × 290 box, facing left. Outline clockwise from the nose.
const OUTLINE: P[] = [
  [40, 135], [58, 112], [72, 97], [86, 4], [100, 96], [106, 98], [124, 10], [118, 104], [128, 112],
  [152, 120], [190, 138], [220, 168], [238, 194], [258, 204], [244, 226], [238, 250], [216, 282],
  [180, 289], [130, 289], [86, 289], [90, 270], [96, 232], [92, 176], [70, 163], [52, 152],
].map(([x, y]) => ({ x, y }))

// Facets, for the folded-paper look: [points, shade] with shade -1 dark … +1 light.
const FACETS: [number[][], number][] = [
  [[[40, 135], [72, 97], [128, 112]], 0.6],
  [[[40, 135], [128, 112], [92, 176]], -0.1],
  [[[40, 135], [92, 176], [52, 152]], -0.5],
  [[[106, 98], [124, 10], [118, 104]], -0.6],      // far ear
  [[[72, 97], [86, 4], [100, 96]], 0.5],           // near ear
  [[[80, 90], [86, 20], [94, 92]], 0.15],          // inside of the near ear
  [[[128, 112], [152, 120], [92, 176]], 0.1],
  [[[152, 120], [190, 138], [96, 232]], 0.45],
  [[[92, 176], [152, 120], [96, 232]], -0.2],
  [[[190, 138], [238, 194], [216, 282]], -0.45],
  [[[190, 138], [216, 282], [130, 289]], 0.2],
  [[[96, 232], [190, 138], [130, 289]], -0.15],
  [[[96, 232], [130, 289], [86, 289]], -0.55],
  [[[238, 194], [258, 204], [244, 226]], 0.8],      // tail
]

export function origami(ctx: Ctx): boolean {
  const root = appRoot()
  if (!root) return false
  const { W, H, sound } = ctx
  const cx = W / 2, cy = H / 2
  const S = Math.min(W, H) * 0.8                  // the square sheet
  const SCALE = 0.72                              // how big the sheet sits on the table
  const TL = { x: cx - S / 2, y: cy - S / 2 }, TR = { x: cx + S / 2, y: cy - S / 2 }
  const BR = { x: cx + S / 2, y: cy + S / 2 }, BL = { x: cx - S / 2, y: cy + S / 2 }
  const M = { x: cx, y: cy }

  // Bunny placement, in the same (unscaled) space as the sheet.
  const b = (S * 0.95) / 290
  const bunny = (p: P): P => ({ x: cx + (p.x - 130) * b, y: cy + (p.y - 145) * b })
  const groundY = cy + (cy + 145 * b - cy) * SCALE   // on screen, under the bunny's feet

  // ── Layers ──
  const backdrop = canvasLayer(ctx, 9972)
  const forest = paintForest(W, H, groundY)
  const stage = el(ctx, "div", {
    position: "fixed", inset: "0", zIndex: "9975", pointerEvents: "none", perspective: "1400px",
  })
  const group = el(ctx, "div", {
    position: "absolute", inset: "0", transformOrigin: `${cx}px ${cy}px`, transformStyle: "preserve-3d",
  }, stage)
  const body = el(ctx, "div", {
    position: "absolute", inset: "0", transformOrigin: `${cx}px ${cy + 145 * b}px`, transformStyle: "preserve-3d",
  }, group)

  const rr = root.getBoundingClientRect()
  const pageCopy = () => {
    const c = root.cloneNode(true) as HTMLElement
    c.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"))
    // visible: copies made after the real page was hidden would inherit it
    Object.assign(c.style, { position: "absolute", left: `${rr.left}px`, top: `${rr.top}px`, width: `${rr.width}px`, margin: "0", transform: "none", visibility: "visible" })
    return c
  }
  const poly = (ps: P[]) => `polygon(${ps.map((p) => `${p.x.toFixed(1)}px ${p.y.toFixed(1)}px`).join(",")})`

  /** A piece of the sheet: the page, clipped, with paper laid over it. */
  const facet = (parent: HTMLElement, ps: P[], paper: number) => {
    const f = el(ctx, "div", {
      position: "absolute", inset: "0", clipPath: poly(ps), background: "var(--app-canvas, #fff)", overflow: "hidden",
    }, parent)
    f.appendChild(pageCopy())
    const veil = el(ctx, "div", { position: "absolute", inset: "0", background: PAPER, opacity: String(paper) }, f)
    return { f, veil }
  }

  /** A flap: turns about the line a→b, showing paper on its back. */
  const flap = (ps: P[], a: P, bb: P, frontPaper = 0) => {
    const wrap = el(ctx, "div", {
      position: "absolute", inset: "0", transformOrigin: `${a.x}px ${a.y}px`, transformStyle: "preserve-3d",
    }, group)
    const piece = facet(wrap, ps, 0)
    const len = Math.hypot(bb.x - a.x, bb.y - a.y)
    const ux = (bb.x - a.x) / len, uy = (bb.y - a.y) / len
    return {
      wrap,
      turn(deg: number) {
        wrap.style.transform = `rotate3d(${ux}, ${uy}, 0, ${deg}deg)`
        // past the vertical we're looking at the back of the paper
        piece.veil.style.opacity = deg > 90 ? "0.88" : String(Math.max(frontPaper, 0.25 * Math.sin((deg * Math.PI) / 180)))
        piece.f.style.filter = `brightness(${1 - 0.25 * Math.sin((deg * Math.PI) / 180)})`
      },
    }
  }

  // Stage 1: the whole page, which becomes a square sheet.
  let sheet: { f: HTMLElement; veil: HTMLElement } | null = facet(group, [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }], 0)
  setStyle(ctx, root, { visibility: "hidden" })

  let fold1: ReturnType<typeof flap> | null = null
  let fold2: ReturnType<typeof flap> | null = null
  let base: { f: HTMLElement; veil: HTMLElement } | null = null
  let shaped: { f: HTMLElement; veil: HTMLElement } | null = null
  let shading: SVGSVGElement | null = null

  const SHRINK = 1100, F1 = 1400, F1_END = 2600, F2 = 2800, F2_END = 4000
  const MORPH = 4200, MORPH_END = 6000, SIT_END = 7000, HOP = 520, HOPS = 6
  const HOP_END = SIT_END + HOP * HOPS, FADE_END = HOP_END + 1100

  // Triangle → bunny: the same number of points, spread by length along each.
  const tri = [M, TR, BR]
  const triPts = spread(tri, OUTLINE.length)
  const bunnyPts = OUTLINE.map(bunny)

  // ── Sound ──
  const crinkle = (at: number) => { for (let i = 0; i < 5; i++) sound.noise(at + i * 0.07, 0.08, { filter: "highpass", freq: 2500 + i * 300, vol: 0.12 }) }
  crinkle(0.1)
  crinkle(F1 / 1000); crinkle((F1_END - 200) / 1000)
  crinkle(F2 / 1000); crinkle((F2_END - 200) / 1000)
  ;[0, 4, 7, 11, 14].forEach((n, i) => sound.tone(523 * 2 ** (n / 12), MORPH / 1000 + 0.3 + i * 0.22, 0.6, { type: "sine", vol: 0.12 }))
  sound.tone(600, MORPH_END / 1000, 0.15, { type: "sine", vol: 0.25, slideTo: 1200 })
  for (let i = 0; i < HOPS; i++) {
    const land = (SIT_END + HOP * (i + 0.85)) / 1000
    sound.tone(130, land, 0.12, { type: "sine", vol: 0.35, slideTo: 70 })
    sound.pluck(392 * 2 ** ([0, 2, 4, 7, 9, 12][i] / 12), (SIT_END + HOP * (i + 0.15)) / 1000, 0.18)
  }
  for (let i = 0; i < 4; i++) sound.chirp(MORPH_END / 1000 + 0.6 + i * 1.3, 1 + (i % 2) * 0.2)

  ctx.loop((t) => {
    // Table, then forest.
    const bg = backdrop.g
    const exitFade = 1 - phase(t, HOP_END + 200, FADE_END)
    bg.clearRect(0, 0, W, H)
    bg.globalAlpha = exitFade * phase(t, 0, 600)
    bg.fillStyle = "#E7DFCF"
    bg.fillRect(0, 0, W, H)
    bg.globalAlpha = exitFade * ease(phase(t, MORPH - 200, MORPH_END + 400))
    bg.drawImage(forest, 0, 0, W, H)
    bg.globalAlpha = 1
    if (t > HOP_END + 200 && root.style.visibility === "hidden") root.style.visibility = ""

    // 1. Shrink to a square sheet on the table.
    if (t < F1 && sheet) {
      const k = ease(phase(t, 0, SHRINK))
      const rect = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }]
      const sq = [TL, TR, BR, BL]
      sheet.f.style.clipPath = poly(rect.map((p, i) => ({ x: lerp(p.x, sq[i].x, k), y: lerp(p.y, sq[i].y, k) })))
      group.style.transform = `scale(${lerp(1, SCALE, k)})`
    }

    // 2. First fold: corner to corner, along TL–BR.
    if (t >= F1 && t < F2) {
      if (!fold1) {
        sheet?.f.remove(); sheet = null
        base = facet(group, [TL, TR, BR], 0)
        fold1 = flap([TL, BR, BL], TL, BR)
      }
      fold1.turn(180 * ease(phase(t, F1, F1_END)))
    }

    // 3. Second fold: in half again, along TR–M.
    if (t >= F2 && t < MORPH) {
      if (!fold2) {
        fold1?.wrap.remove(); base?.f.remove()
        base = facet(group, [TR, BR, M], 0.88)
        fold2 = flap([TR, TL, M], TR, M, 0.88)
      }
      fold2.turn(180 * ease(phase(t, F2, F2_END)))
    }

    // 4. Shaping: the folded triangle becomes the bunny.
    if (t >= MORPH) {
      if (!shaped) {
        fold2?.wrap.remove(); base?.f.remove()
        shaped = facet(body, triPts, 0.88)
        shading = makeShading(body, bunny, b)
        ctx.onCleanup(() => shading?.remove())
      }
      const k = ease(phase(t, MORPH, MORPH_END))
      shaped.f.style.clipPath = poly(triPts.map((p, i) => ({ x: lerp(p.x, bunnyPts[i].x, k), y: lerp(p.y, bunnyPts[i].y, k) })))
      shaped.veil.style.opacity = String(lerp(0.88, 0.45, k))
      shading!.style.opacity = String(phase(t, MORPH + 900, MORPH_END))
      // the eye blinks once while she sits
      const eye = shading!.querySelector("#fx-eye") as SVGElement | null
      if (eye) eye.style.transform = `scaleY(${Math.abs(t - (SIT_END - 500)) < 90 ? 0.1 : 1})`
    }

    // 5. Hop away to the left.
    if (t >= SIT_END) {
      const h = Math.min(HOPS, (t - SIT_END) / HOP)
      const i = Math.floor(h), p = h - i
      const hopLen = (cx + 160 * b * SCALE + 80) / (HOPS - 0.5)
      let dx = -(i + easeOut(phase(p, 0.15, 0.85))) * hopLen
      let dy = 0, sx = 1, sy = 1, rot = 0
      if (i < HOPS) {
        if (p < 0.15) { sy = 1 - 0.14 * Math.sin((p / 0.15) * Math.PI); sx = 2 - sy }
        else if (p < 0.85) {
          const q = (p - 0.15) / 0.7
          dy = -Math.sin(q * Math.PI) * 70
          sy = 1.06; sx = 0.96
          rot = q < 0.5 ? 10 : -6
        } else { sy = 1 - 0.1 * Math.sin(((p - 0.85) / 0.15) * Math.PI); sx = 2 - sy }
      } else {
        dx = -HOPS * hopLen
      }
      group.style.transform = `translate(${dx}px, ${dy}px) scale(${SCALE})`
      body.style.transform = `rotate(${rot}deg) scale(${sx}, ${sy})`
    } else if (t >= MORPH) {
      // a little settle as she takes shape
      const k = phase(t, MORPH_END - 200, MORPH_END + 300)
      const squash = k > 0 && k < 1 ? 1 - 0.08 * Math.sin(k * Math.PI) : 1
      body.style.transform = `scale(${2 - squash}, ${squash})`
      group.style.transform = `scale(${SCALE})`
    }

    if (t >= FADE_END) { ctx.stop(); return false }
  })
  return true
}

/** n points spread along a closed polygon, in order, by length. */
function spread(poly: P[], n: number): P[] {
  const segs = poly.map((p, i) => [p, poly[(i + 1) % poly.length]] as const)
  const lens = segs.map(([a, c]) => Math.hypot(c.x - a.x, c.y - a.y))
  const total = lens.reduce((a, c) => a + c, 0)
  return Array.from({ length: n }, (_, i) => {
    let d = (i / n) * total, k = 0
    while (k < lens.length - 1 && d > lens[k]) { d -= lens[k]; k++ }
    const [a, c] = segs[k], f = d / lens[k]
    return { x: lerp(a.x, c.x, f), y: lerp(a.y, c.y, f) }
  })
}

function makeShading(parent: HTMLElement, place: (p: P) => P, b: number): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg"
  const svg = document.createElementNS(ns, "svg")
  svg.setAttribute("class", "fx-keep")
  svg.setAttribute("width", String(window.innerWidth))
  svg.setAttribute("height", String(window.innerHeight))
  Object.assign(svg.style, { position: "absolute", left: "0", top: "0", opacity: "0", overflow: "visible" })
  for (const [pts, shade] of FACETS) {
    const p = document.createElementNS(ns, "polygon")
    p.setAttribute("points", pts.map(([x, y]) => { const q = place({ x, y }); return `${q.x},${q.y}` }).join(" "))
    p.setAttribute("fill", shade > 0 ? `rgba(255,255,255,${(shade * 0.55).toFixed(2)})` : `rgba(60,45,30,${(-shade * 0.35).toFixed(2)})`)
    p.setAttribute("stroke", "rgba(120,100,80,.35)")
    p.setAttribute("stroke-width", "1")
    svg.appendChild(p)
  }
  // eye and nose
  const eye = document.createElementNS(ns, "ellipse")
  const e = place({ x: 74, y: 122 })
  eye.setAttribute("id", "fx-eye")
  eye.setAttribute("cx", String(e.x)); eye.setAttribute("cy", String(e.y))
  eye.setAttribute("rx", String(4 * b)); eye.setAttribute("ry", String(5 * b))
  eye.setAttribute("fill", "#2B2118")
  eye.style.transformBox = "fill-box"
  eye.style.transformOrigin = "center"
  svg.appendChild(eye)
  const n = place({ x: 42, y: 134 })
  const nose = document.createElementNS(ns, "circle")
  nose.setAttribute("cx", String(n.x)); nose.setAttribute("cy", String(n.y)); nose.setAttribute("r", String(3.5 * b))
  nose.setAttribute("fill", "#E88A9A")
  svg.appendChild(nose)
  parent.appendChild(svg)
  return svg
}

/** A soft forest clearing, painted once. */
function paintForest(W: number, H: number, groundY: number): HTMLCanvasElement {
  const c = document.createElement("canvas")
  c.width = W
  c.height = H
  const g = c.getContext("2d")!
  const sky = g.createLinearGradient(0, 0, 0, groundY)
  sky.addColorStop(0, "#A9DBF7")
  sky.addColorStop(1, "#E6F5FC")
  g.fillStyle = sky
  g.fillRect(0, 0, W, H)
  // sun and its glow
  const sun = g.createRadialGradient(W * 0.82, H * 0.12, 8, W * 0.82, H * 0.12, H * 0.5)
  sun.addColorStop(0, "rgba(255,248,215,1)")
  sun.addColorStop(0.15, "rgba(255,244,200,.6)")
  sun.addColorStop(1, "rgba(255,244,200,0)")
  g.fillStyle = sun
  g.fillRect(0, 0, W, H)
  // far hills
  const hill = (color: string, y: number, amp: number, f: number) => {
    g.fillStyle = color
    g.beginPath()
    g.moveTo(0, H)
    for (let x = 0; x <= W; x += 10) g.lineTo(x, y + Math.sin(x / f) * amp + Math.sin(x / (f * 0.37)) * amp * 0.3)
    g.lineTo(W, H)
    g.fill()
  }
  hill("#B9D9B0", groundY - H * 0.2, 18, 140)
  hill("#9CC791", groundY - H * 0.12, 14, 90)
  // pines: a far row, then larger ones at the sides
  const pine = (x: number, base: number, h: number, color: string) => {
    g.fillStyle = "#6B4A2E"
    g.fillRect(x - h * 0.03, base - h * 0.12, h * 0.06, h * 0.12)
    g.fillStyle = color
    for (let k = 0; k < 3; k++) {
      const top = base - h + k * h * 0.22
      const w = h * (0.22 + k * 0.1)
      g.beginPath(); g.moveTo(x, top); g.lineTo(x + w, top + h * 0.45); g.lineTo(x - w, top + h * 0.45); g.closePath(); g.fill()
    }
  }
  for (let x = 20; x < W; x += 46 + Math.random() * 30) pine(x, groundY - H * 0.04, H * (0.16 + Math.random() * 0.06), "#5E9A62")
  for (const x of [W * 0.04, W * 0.12, W * 0.88, W * 0.96, W * 0.2]) pine(x, groundY + 8, H * (0.38 + Math.random() * 0.12), "#3F7D4A")
  // ground
  const gr = g.createLinearGradient(0, groundY - 10, 0, H)
  gr.addColorStop(0, "#9ACB72")
  gr.addColorStop(1, "#6EA650")
  g.fillStyle = gr
  g.fillRect(0, groundY - 6, W, H)
  // flowers and grass tufts
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * W, y = groundY + 6 + Math.random() * (H - groundY - 10)
    if (Math.random() < 0.5) {
      g.fillStyle = ["#FFFFFF", "#FFD34D", "#FF8FB1", "#B48CFF"][i % 4]
      g.beginPath(); g.arc(x, y, 2.5, 0, Math.PI * 2); g.fill()
    } else {
      g.strokeStyle = "#5C9A43"
      g.lineWidth = 1.5
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - 3, y - 8); g.moveTo(x, y); g.lineTo(x + 3, y - 9); g.stroke()
    }
  }
  return c
}
