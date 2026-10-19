import {
  type Ctx, type Seg, canvasLayer, collectGlyphs, drawGlyph, hideText, ease, easeOut, lerp, phase, rand, samplePath,
} from "../core"
import { note } from "../sound"

// Every letter on the page flies to the centre and forms a Star of David —
// two interlocking triangles that turn and glow — then flies home. During
// Hanukkah the letters build a menorah instead, and its candles light.

const BLUE = "#1F5FBF"
const GOLD = "#C9A227"

function isHanukkah(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-u-ca-hebrew", { timeZone: "Asia/Jerusalem", day: "numeric", month: "long" }).formatToParts(d)
  const day = Number(parts.find((p) => p.type === "day")?.value)
  const month = parts.find((p) => p.type === "month")?.value
  return (month === "Kislev" && day >= 25) || (month === "Tevet" && day <= 2)
}

function triangle(cx: number, cy: number, R: number, up: boolean): Seg[] {
  const angles = (up ? [-90, 30, 150] : [90, 210, 330]).map((a) => (a * Math.PI) / 180)
  const p = angles.map((a) => ({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R }))
  return [0, 1, 2].map((i) => ({ kind: "line", x1: p[i].x, y1: p[i].y, x2: p[(i + 1) % 3].x, y2: p[(i + 1) % 3].y }))
}

function menorah(cx: number, cy: number, R: number) {
  const top = cy - 0.1 * R
  const segs: Seg[] = [
    { kind: "line", x1: cx - 0.3 * R, y1: cy + 0.95 * R, x2: cx + 0.3 * R, y2: cy + 0.95 * R },
    { kind: "line", x1: cx, y1: cy + 0.95 * R, x2: cx, y2: top - 0.25 * R },
  ]
  const candles: { x: number; y: number }[] = [{ x: cx, y: top - 0.25 * R }]   // the shamash, raised
  for (let k = 1; k <= 4; k++) {
    const r = k * 0.22 * R
    segs.push({ kind: "arc", cx, cy: top, r, a1: 0, a2: Math.PI })
    for (const sx of [1, -1]) candles.push({ x: cx + sx * r, y: top })
  }
  const flames: { x: number; y: number }[] = []
  for (const c of candles) {
    const h = 0.22 * R
    segs.push({ kind: "line", x1: c.x, y1: c.y, x2: c.x, y2: c.y - h })
    flames.push({ x: c.x, y: c.y - h - 10 })
  }
  // Light the shamash, then the candles from left to right as they're kindled.
  const order = [0, ...flames.map((_, i) => i).slice(1).sort((a, b) => flames[a].x - flames[b].x)]
  return { segs, flames: order.map((i) => flames[i]) }
}

export function star(ctx: Ctx): boolean {
  const base = collectGlyphs(2400)
  if (base.length < 30) return false
  const { W, H, sound } = ctx
  const cx = W / 2
  const cy = H / 2
  const R = Math.min(W, H) * 0.36
  const hanukkah = isHanukkah()

  // Targets: each triangle (or the menorah) drawn as a band a few letters thick.
  let targets: { x: number; y: number; a: number; color: string }[] = []
  let flames: { x: number; y: number }[] = []
  const band = (pts: { x: number; y: number; a: number }[], color: string, k: number) =>
    pts.map((p, i) => {
      const off = ((i % k) - (k - 1) / 2) * 11
      return { x: p.x - Math.sin(p.a) * off, y: p.y + Math.cos(p.a) * off, a: p.a, color }
    })
  if (hanukkah) {
    const m = menorah(cx, cy, R)
    flames = m.flames
    targets = band(samplePath(m.segs, base.length), GOLD, 2)
  } else {
    const half = Math.ceil(base.length / 2)
    const k = Math.max(1, Math.min(4, Math.round((half * 8) / (R * 3 * Math.sqrt(3)))))
    targets = [
      ...band(samplePath(triangle(cx, cy, R, true), half, ), BLUE, k),
      ...band(samplePath(triangle(cx, cy, R, false), base.length - half), BLUE, k),
    ]
  }
  // Letters read better upright.
  const upright = (a: number) => { let x = a % Math.PI; if (x > Math.PI / 2) x -= Math.PI; if (x < -Math.PI / 2) x += Math.PI; return x }

  const ps = base.map((gl, i) => ({
    gl, t: targets[i], delay: rand(0, 700), dur: rand(1500, 2000),
    cxo: rand(-1, 1) * W * 0.3, cyo: rand(-1, 1) * H * 0.3,   // a swirl on the way in
  }))

  const { g } = canvasLayer(ctx)
  hideText(ctx)
  sound.whoosh(0.1, 1.6, true, 0.2)
  if (hanukkah) {
    flames.forEach((_, i) => sound.tone(note(12 + [0, 4, 7, 12, 7, 4, 0, 4, 7][i % 9]), 2.7 + i * 0.35, 0.9, { type: "sine", vol: 0.18 }))
  } else {
    // התקווה — the opening phrase.
    const D = note(-7), E = note(-5), F = note(-4), G = note(-2), A = note(0), Bb = note(1), D5 = note(5)
    sound.melody([[D, 1], [E, 1], [F, 1], [G, 1], [A, 2], [A, 2], [Bb, 1], [A, 1], [Bb, 1], [D5, 1], [A, 4]], 2.6, 80, { vol: 0.28 })
  }

  const IN_END = 2700, HOLD_END = 7400, OUT_END = 9000
  ctx.loop((t) => {
    g.clearRect(0, 0, W, H)
    // A soft glow behind the shape while it holds.
    const glow = phase(t, IN_END - 600, IN_END) * (1 - phase(t, HOLD_END, HOLD_END + 500))
    if (glow > 0) {
      const rg = g.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.5)
      rg.addColorStop(0, `rgba(255,255,255,${0.85 * glow})`)
      rg.addColorStop(1, "rgba(255,255,255,0)")
      g.fillStyle = rg
      g.fillRect(0, 0, W, H)
    }
    const spin = hanukkah ? 0 : Math.max(0, t - IN_END) / 1000 * 0.3 * (1 - phase(t, HOLD_END - 400, HOLD_END))
    const pulse = 8 + 6 * Math.sin(t / 300)
    const spinT = (x: number, y: number) => {
      const dx = x - cx, dy = y - cy
      const c = Math.cos(spin), s = Math.sin(spin)
      return [cx + dx * c - dy * s, cy + dx * s + dy * c] as const
    }
    for (const p of ps) {
      const [tx, ty] = spinT(p.t.x, p.t.y)
      let x: number, y: number, rot: number, color: string
      if (t < HOLD_END) {
        const k = ease(phase(t, p.delay, p.delay + p.dur))
        // Quadratic curve through a swirl point.
        const mx = (p.gl.x + tx) / 2 + p.cxo * (1 - k), my = (p.gl.y + ty) / 2 + p.cyo * (1 - k)
        x = (1 - k) ** 2 * p.gl.x + 2 * (1 - k) * k * mx + k * k * tx
        y = (1 - k) ** 2 * p.gl.y + 2 * (1 - k) * k * my + k * k * ty
        rot = lerp(0, upright(p.t.a + spin), k)
        color = k >= 1 ? p.t.color : p.gl.color
      } else {
        const k = easeOut(phase(t, HOLD_END + p.delay * 0.4, HOLD_END + p.delay * 0.4 + 1100))
        x = lerp(tx, p.gl.x, k)
        y = lerp(ty, p.gl.y, k)
        rot = lerp(upright(p.t.a + spin), 0, k)
        color = k > 0.6 ? p.gl.color : p.t.color
      }
      if (t > IN_END && t < HOLD_END) { g.shadowColor = hanukkah ? "#FFD34D" : "#6FA8FF"; g.shadowBlur = pulse }
      drawGlyph(g, p.gl, x, y, rot, color)
      g.shadowBlur = 0
    }
    // Candle flames.
    if (hanukkah) {
      flames.forEach((f, i) => {
        const lit = t > IN_END + i * 350 && t < HOLD_END + 300
        if (!lit) return
        const fl = 1 + 0.15 * Math.sin(t / 60 + i * 2)
        const grd = g.createRadialGradient(f.x, f.y + 4, 1, f.x, f.y, 14 * fl)
        grd.addColorStop(0, "rgba(255,250,200,1)")
        grd.addColorStop(0.5, "rgba(255,190,60,.9)")
        grd.addColorStop(1, "rgba(255,120,0,0)")
        g.fillStyle = grd
        g.beginPath()
        g.ellipse(f.x, f.y, 6 * fl, 13 * fl, 0, 0, Math.PI * 2)
        g.fill()
      })
    }
    if (t >= OUT_END) { ctx.stop(); return false }
  })
  return true
}
