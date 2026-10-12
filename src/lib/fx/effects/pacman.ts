import { type Ctx, type Glyph, canvasLayer, collectGlyphs, drawGlyph, hideText, easeOut, lerp, phase } from "../core"

// Pac-Man eats the page line by line — right to left, as Hebrew reads —
// with the ghosts on his tail. They catch him; the letters come back.

interface Line { y: number; x1: number; x2: number; glyphs: number[] }

const GHOSTS = ["#FF0000", "#FFB8FF", "#00FFFF", "#FFB852"]
const R = 14

function lines(glyphs: Glyph[], H: number): Line[] {
  const idx = glyphs.map((_, i) => i).sort((a, b) => glyphs[a].y - glyphs[b].y)
  const out: Line[] = []
  for (const i of idx) {
    const gl = glyphs[i]
    const last = out[out.length - 1]
    if (last && Math.abs(gl.y - last.y) < 9) {
      last.glyphs.push(i)
      last.x1 = Math.min(last.x1, gl.x - gl.w)
      last.x2 = Math.max(last.x2, gl.x + gl.w)
    } else {
      out.push({ y: gl.y, x1: gl.x - gl.w, x2: gl.x + gl.w, glyphs: [i] })
    }
  }
  // Lines worth a detour, at least one Pac-Man apart.
  const kept: Line[] = []
  for (const l of out.filter((l) => l.glyphs.length >= 4 && l.y > 20 && l.y < H - 20)) {
    const prev = kept[kept.length - 1]
    if (prev && l.y - prev.y < R * 2.5) {
      prev.glyphs.push(...l.glyphs)
      prev.x1 = Math.min(prev.x1, l.x1)
      prev.x2 = Math.max(prev.x2, l.x2)
      prev.y = (prev.y + l.y) / 2
    } else kept.push(l)
  }
  return kept.slice(0, 14)
}

export function pacman(ctx: Ctx): boolean {
  const glyphs = collectGlyphs()
  const ls = lines(glyphs, ctx.H)
  if (ls.length < 2) return false
  const { W, H, sound } = ctx

  // The route: along each line, alternating direction, joined by drops.
  const pts: { x: number; y: number }[] = []
  ls.forEach((l, i) => {
    const rtl = i % 2 === 0
    const a = { x: rtl ? Math.min(W - R, l.x2 + R) : Math.max(R, l.x1 - R), y: l.y }
    const b = { x: rtl ? Math.max(R, l.x1 - R) : Math.min(W - R, l.x2 + R), y: l.y }
    if (i === 0) pts.push({ x: W + 40, y: l.y })
    else pts.push({ x: pts[pts.length - 1].x, y: l.y })
    pts.push(a, b)
  })
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  const total = cum[cum.length - 1]
  const at = (d: number) => {
    d = Math.max(0, Math.min(total, d))
    let k = 1
    while (k < cum.length - 1 && cum[k] < d) k++
    const f = (d - cum[k - 1]) / (cum[k] - cum[k - 1] || 1)
    const p = pts[k - 1], q = pts[k]
    return { x: lerp(p.x, q.x, f), y: lerp(p.y, q.y, f), dx: Math.sign(q.x - p.x), dy: Math.sign(q.y - p.y) }
  }

  const speed = Math.min(1700, Math.max(380, total / 7)) / 1000   // px per ms
  const RUN = total / speed
  const CAUGHT = RUN + 450
  const DEATH = CAUGHT + 1400
  const RESTORE = DEATH + 1000

  const eaten = new Float64Array(glyphs.length).fill(-1)
  const lineOf = new Int32Array(glyphs.length).fill(-1)
  ls.forEach((l, i) => l.glyphs.forEach((g) => { lineOf[g] = i }))

  const { g } = canvasLayer(ctx)
  hideText(ctx)

  // Waka-waka, for as long as he runs.
  if (sound.on) {
    const n = Math.floor(RUN / 135)
    for (let i = 0; i < n; i++) {
      const up = i % 2 === 0
      sound.tone(up ? 240 : 480, i * 0.135, 0.12, { type: "triangle", vol: 0.12, slideTo: up ? 480 : 240 })
    }
    for (let i = 0; i < 9; i++) sound.tone(700 - i * 55, CAUGHT / 1000 + 0.3 + i * 0.12, 0.13, { type: "square", vol: 0.06, slideTo: 450 - i * 45 })
  }

  let prevPac = at(0)
  ctx.loop((t) => {
    g.clearRect(0, 0, W, H)
    const d = Math.min(total, t * speed)
    const pac = at(d)

    // Eat everything swept since the last frame — at speed he moves further
    // than a letter's width per frame.
    if (t < RUN) {
      const li = ls.findIndex((l) => Math.abs(l.y - pac.y) < 1)
      if (li >= 0 && Math.abs(prevPac.y - pac.y) < 1) {
        const lo = Math.min(prevPac.x, pac.x) - R * 0.5
        const hi = Math.max(prevPac.x, pac.x) + R * 0.5
        for (const gi of ls[li].glyphs) {
          if (eaten[gi] < 0 && glyphs[gi].x >= lo && glyphs[gi].x <= hi) eaten[gi] = t
        }
      }
    }
    prevPac = pac

    // Letters: uneaten ones as they are; eaten ones pop back at the end.
    for (let i = 0; i < glyphs.length; i++) {
      const gl = glyphs[i]
      if (eaten[i] < 0 || lineOf[i] < 0) { drawGlyph(g, gl, gl.x, gl.y); continue }
      if (t > DEATH) {
        const k = easeOut(phase(t, DEATH + (gl.x / W) * 500, DEATH + (gl.x / W) * 500 + 400))
        if (k > 0) drawGlyph(g, gl, gl.x, gl.y, 0, gl.color, 0.3 + 0.7 * k)
      }
    }

    // Ghosts trail him, then close in.
    const close = phase(t, RUN, CAUGHT)
    GHOSTS.forEach((color, i) => {
      if (t > DEATH - 300) return
      const behind = (90 + i * 46) * (1 - close) + (i % 2 ? 1 : -1) * close * 2
      const gp = at(d - behind)
      const off = close * (i - 1.5) * 26
      drawGhost(g, gp.x + (pac.dy ? off : 0), gp.y + (pac.dy ? 0 : off * 0.5), color, pac.x > gp.x ? 1 : -1, t)
    })

    // Pac-Man: chomping while he runs, then the death spiral.
    let mouth = 0.08 + 0.22 * Math.abs(Math.sin(t / 55))
    let size = 1
    if (t > CAUGHT) {
      const k = phase(t, CAUGHT, DEATH - 200)
      mouth = lerp(0.1, 1, k)
      size = 1 - phase(t, DEATH - 400, DEATH - 100)
    }
    if (size > 0) {
      const ang = pac.dx ? (pac.dx > 0 ? 0 : Math.PI) : (pac.dy > 0 ? Math.PI / 2 : -Math.PI / 2)
      const dir = t > CAUGHT ? -Math.PI / 2 : ang
      g.fillStyle = "#FFE000"
      g.beginPath()
      g.moveTo(pac.x, pac.y)
      g.arc(pac.x, pac.y, R * size, dir + mouth * Math.PI, dir + (2 - mouth) * Math.PI)
      g.closePath()
      g.fill()
    }

    if (t >= RESTORE) { ctx.stop(); return false }
  })
  return true
}

function drawGhost(g: CanvasRenderingContext2D, x: number, y: number, color: string, look: number, t: number) {
  const r = R
  g.fillStyle = color
  g.beginPath()
  g.arc(x, y - 2, r, Math.PI, 0)
  g.lineTo(x + r, y + r)
  const wob = Math.floor(t / 120) % 2 ? 0 : 3
  for (let i = 0; i < 4; i++) {
    const x1 = x + r - (i * 2 * r) / 4
    g.lineTo(x1 - r / 4, y + r - 5 + (i % 2 ? wob : 3 - wob))
    g.lineTo(x1 - r / 2, y + r)
  }
  g.closePath()
  g.fill()
  for (const ex of [-5, 5]) {
    g.fillStyle = "#fff"
    g.beginPath(); g.ellipse(x + ex, y - 4, 4, 5, 0, 0, Math.PI * 2); g.fill()
    g.fillStyle = "#1a3cff"
    g.beginPath(); g.arc(x + ex + look * 2, y - 3.5, 2.2, 0, Math.PI * 2); g.fill()
  }
}
