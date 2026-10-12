import { type Ctx, canvasLayer, ease, lerp, liftOut, phase } from "../core"

// A row folds itself into a paper airplane, loops the loop around the
// screen, glides back and unfolds into its place.

type P = { x: number; y: number }

function catmull(ps: P[], u: number): P {
  const n = ps.length - 1
  const s = Math.min(n - 1e-6, Math.max(0, u * n))
  const i = Math.floor(s)
  const f = s - i
  const p0 = ps[Math.max(0, i - 1)], p1 = ps[i], p2 = ps[i + 1], p3 = ps[Math.min(n, i + 2)]
  const c = (a: number, b: number, c2: number, d: number) =>
    0.5 * (2 * b + (-a + c2) * f + (2 * a - 5 * b + 4 * c2 - d) * f * f + (-a + 3 * b - 3 * c2 + d) * f * f * f)
  return { x: c(p0.x, p1.x, p2.x, p3.x), y: c(p0.y, p1.y, p2.y, p3.y) }
}

function drawPlane(g: CanvasRenderingContext2D, x: number, y: number, a: number, s: number, bank: number) {
  g.save()
  g.translate(x, y)
  g.rotate(a)
  g.scale(s, s * (0.55 + 0.45 * Math.cos(bank)))
  g.lineJoin = "round"
  g.shadowColor = "rgba(30,40,60,.3)"
  g.shadowBlur = 10
  g.shadowOffsetY = 8
  // far wing
  g.fillStyle = "#E3E8F0"
  g.beginPath(); g.moveTo(34, 0); g.lineTo(-26, -20); g.lineTo(-18, 0); g.closePath(); g.fill()
  // near wing
  g.fillStyle = "#FFFFFF"
  g.beginPath(); g.moveTo(34, 0); g.lineTo(-26, 20); g.lineTo(-18, 0); g.closePath(); g.fill()
  // keel
  g.fillStyle = "#C9D2E0"
  g.beginPath(); g.moveTo(34, 0); g.lineTo(-20, 0); g.lineTo(-24, 6); g.closePath(); g.fill()
  g.shadowColor = "transparent"
  g.strokeStyle = "#8A97AD"
  g.lineWidth = 1.2
  g.beginPath(); g.moveTo(34, 0); g.lineTo(-26, -20); g.lineTo(-18, 0); g.lineTo(-26, 20); g.closePath(); g.stroke()
  g.beginPath(); g.moveTo(34, 0); g.lineTo(-18, 0); g.stroke()
  g.restore()
}

export function plane(ctx: Ctx): boolean {
  const { W, H, sound } = ctx
  // Rows if the page has them; otherwise any sizeable block — the calendar
  // and the organization cards have no table.
  const rows = Array.from(document.querySelectorAll<HTMLElement>(
    "main tbody tr, main li, main h1, main h2, main h3, main .rounded-xl, main .rounded-lg, main p, main button",
  )).filter((e) => { const r = e.getBoundingClientRect(); return r.width > 80 && r.width < W * 0.95 && r.height > 14 && r.top > 0 && r.bottom < H })
  if (!rows.length) return false
  const row = rows.sort((a, b) => Math.abs(a.getBoundingClientRect().top - H / 2) - Math.abs(b.getBoundingClientRect().top - H / 2))[0]
  const { copies, rects } = liftOut(ctx, [row])
  const copy = copies[0]
  const r = rects[0]
  copy.style.transformOrigin = "50% 50%"
  const home: P = { x: r.left + r.width / 2, y: r.top + r.height / 2 }

  const path: P[] = [
    home,
    { x: home.x + W * 0.12, y: home.y - H * 0.18 },
    { x: W * 0.72, y: H * 0.22 },
    // the loop
    { x: W * 0.62, y: H * 0.08 },
    { x: W * 0.52, y: H * 0.25 },
    { x: W * 0.62, y: H * 0.42 },
    { x: W * 0.74, y: H * 0.26 },
    // across the screen and a swoop
    { x: W * 0.45, y: H * 0.15 },
    { x: W * 0.15, y: H * 0.3 },
    { x: W * 0.12, y: H * 0.68 },
    { x: W * 0.35, y: H * 0.82 },
    { x: home.x - W * 0.15, y: home.y + 40 },
    home,
  ]

  const { g } = canvasLayer(ctx, 9986)
  const FOLD = 900, FLY_END = 6200, LAND = 7100
  sound.noise(0.05, 0.25, { filter: "highpass", freq: 3000, vol: 0.12 })
  sound.noise(0.45, 0.25, { filter: "highpass", freq: 3500, vol: 0.12 })
  sound.whoosh(1.0, 0.9, true, 0.22)
  sound.whoosh(2.2, 1.1, true, 0.25)
  sound.whoosh(3.6, 0.9, false, 0.22)
  sound.whoosh(5.0, 1.0, false, 0.2)
  sound.noise(6.3, 0.3, { filter: "highpass", freq: 3000, vol: 0.12 })

  const trail: P[] = []
  ctx.loop((t) => {
    g.clearRect(0, 0, W, H)
    // 1. Fold: the row squeezes into a dart, and the plane takes its place.
    if (t < FOLD) {
      const k = ease(phase(t, 0, FOLD))
      copy.style.transform = `translate(${r.left}px, ${r.top}px) scale(${lerp(1, 0.06, k)}, ${lerp(1, 0.6, Math.min(1, k * 2))}) rotate(${k * 20}deg)`
      copy.style.opacity = String(1 - phase(t, FOLD * 0.6, FOLD))
      if (k > 0.6) drawPlane(g, home.x, home.y, -0.3, phase(t, FOLD * 0.6, FOLD), 0)
    } else if (t < FLY_END) {
      // 2. Fly.
      const u = ease(phase(t, FOLD, FLY_END))
      const p = catmull(path, u)
      const q = catmull(path, Math.min(1, u + 0.004))
      const a = Math.atan2(q.y - p.y, q.x - p.x)
      trail.push(p)
      if (trail.length > 40) trail.shift()
      g.setLineDash([4, 6])
      g.strokeStyle = "rgba(120,135,160,.5)"
      g.lineWidth = 1.5
      g.beginPath()
      trail.forEach((tp, i) => (i ? g.lineTo(tp.x, tp.y) : g.moveTo(tp.x, tp.y)))
      g.stroke()
      g.setLineDash([])
      drawPlane(g, p.x, p.y, a, 1.4, Math.sin(t / 300) * 0.8)
    } else {
      // 3. Land and unfold.
      const k = ease(phase(t, FLY_END, LAND))
      if (k < 0.5) drawPlane(g, home.x, home.y, 0, 1.4 * (1 - k * 2), 0)
      copy.style.opacity = String(phase(t, FLY_END, FLY_END + 300))
      copy.style.transform = `translate(${r.left}px, ${r.top}px) scale(${lerp(0.06, 1, k)}, ${lerp(0.6, 1, k)}) rotate(${(1 - k) * 20}deg)`
    }
    if (t >= LAND + 150) { ctx.stop(); return false }
  })
  return true
}
