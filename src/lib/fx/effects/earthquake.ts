import { type Ctx, appRoot, canvasLayer, el, ease, phase, rand, setStyle } from "../core"

// The page shakes harder and harder, cracks spread across it and it shatters
// like glass; the shards fall away. Then a rewind: they fly back together.

type P = { x: number; y: number }

export function earthquake(ctx: Ctx): boolean {
  const root = appRoot()
  if (!root) return false
  const { W, H, sound } = ctx
  const SHAKE = 2600, FALL = 1500, REWIND_AT = SHAKE + FALL + 500, REWIND = 1400, END = REWIND_AT + REWIND + 250

  // A jittered grid over the viewport, cut into triangles.
  const heavy = root.getElementsByTagName("*").length > 3000
  const cols = heavy ? 3 : 4, rows = heavy ? 2 : 3
  const grid: P[][] = []
  for (let r = 0; r <= rows; r++) {
    grid.push([])
    for (let c = 0; c <= cols; c++) {
      const edge = r === 0 || c === 0 || r === rows || c === cols
      grid[r].push({
        x: (c / cols) * W + (edge && (c === 0 || c === cols) ? 0 : rand(-0.25, 0.25) * (W / cols)),
        y: (r / rows) * H + (edge && (r === 0 || r === rows) ? 0 : rand(-0.25, 0.25) * (H / rows)),
      })
    }
  }
  const tris: P[][] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = grid[r][c], b = grid[r][c + 1], d = grid[r + 1][c], e = grid[r + 1][c + 1]
      if ((r + c) % 2) { tris.push([a, b, e], [a, e, d]) } else { tris.push([a, b, d], [b, e, d]) }
    }
  }
  const impact: P = { x: W * rand(0.35, 0.65), y: H * rand(0.35, 0.6) }

  // Cracks: every shard edge, jagged, revealed outward from the impact.
  const edges: { pts: P[]; dist: number }[] = []
  const seen = new Set<string>()
  for (const tri of tris) {
    for (let i = 0; i < 3; i++) {
      const p = tri[i], q = tri[(i + 1) % 3]
      const key = [p.x, p.y, q.x, q.y].map((v) => v.toFixed(1)).sort().join()
      if (seen.has(key)) continue
      seen.add(key)
      const onBorder = (p.x === q.x && (p.x === 0 || p.x === W)) || (p.y === q.y && (p.y === 0 || p.y === H))
      if (onBorder) continue
      const pts: P[] = [p]
      for (let k = 1; k < 8; k++) pts.push({ x: p.x + (q.x - p.x) * (k / 8) + rand(-5, 5), y: p.y + (q.y - p.y) * (k / 8) + rand(-5, 5) })
      pts.push(q)
      edges.push({ pts, dist: Math.hypot((p.x + q.x) / 2 - impact.x, (p.y + q.y) / 2 - impact.y) })
    }
  }
  const maxDist = Math.max(...edges.map((e) => e.dist))

  const { g } = canvasLayer(ctx, 9980)
  setStyle(ctx, root, { willChange: "transform" })

  let shards: { el: HTMLElement; vx: number; vy: number; vr: number; cx: number; cy: number }[] = []
  let backdrop: HTMLElement | null = null
  let vhs: HTMLElement | null = null

  function shatter() {
    const rr = root!.getBoundingClientRect()
    backdrop = el(ctx, "div", { position: "fixed", inset: "0", background: "#0b0d12", zIndex: "9973" })
    shards = tris.map((tri) => {
      const cx = (tri[0].x + tri[1].x + tri[2].x) / 3
      const cy = (tri[0].y + tri[1].y + tri[2].y) / 3
      const box = el(ctx, "div", {
        position: "fixed", inset: "0", zIndex: "9975", pointerEvents: "none",
        clipPath: `polygon(${tri.map((p) => `${p.x}px ${p.y}px`).join(",")})`,
        transformOrigin: `${cx}px ${cy}px`, overflow: "hidden",
        background: "var(--app-canvas, #fff)",
        filter: "drop-shadow(0 0 1px rgba(255,255,255,.8))",
      })
      const copy = root!.cloneNode(true) as HTMLElement
      copy.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"))
      Object.assign(copy.style, {
        position: "absolute", left: `${rr.left}px`, top: `${rr.top}px`, width: `${rr.width}px`,
        transform: "none", margin: "0",
      })
      box.appendChild(copy)
      const away = Math.atan2(cy - impact.y, cx - impact.x)
      return { el: box, vx: Math.cos(away) * rand(0.05, 0.25), vy: rand(-0.35, -0.05), vr: rand(-0.0015, 0.0015), cx, cy }
    })
    setStyle(ctx, root!, { visibility: "hidden" })
  }

  const poseAt = (s: number) => (sh: (typeof shards)[number]) => {
    const x = sh.vx * s
    const y = sh.vy * s + 0.5 * 0.0026 * s * s
    sh.el.style.transform = `translate(${x}px, ${y}px) rotate(${sh.vr * s}rad)`
  }

  // ── Sound ──
  if (sound.on) {
    sound.noise(0, SHAKE / 1000 + 0.3, { filter: "lowpass", freq: 120, freqTo: 380, vol: 0.5, attack: 2, release: 0.3 })
    sound.tone(38, 0, SHAKE / 1000, { type: "sine", vol: 0.5, attack: 2 })
    for (let i = 0; i < 14; i++) sound.click(1.8 + i * 0.055, 0.2)
    // the shatter: bright noise and a glassy ring
    sound.noise(SHAKE / 1000, 0.7, { filter: "highpass", freq: 2500, vol: 0.5, release: 0.6 })
    for (let i = 0; i < 12; i++) sound.tone(rand(2500, 5000), SHAKE / 1000 + i * 0.03, 0.3, { type: "sine", vol: 0.08 })
    // the rewind whirr
    for (let i = 0; i < 7; i++) sound.tone(300 + i * 60, REWIND_AT / 1000 + i * 0.2, 0.2, { type: "sawtooth", vol: 0.05, slideTo: 1400 + i * 120 })
  }

  ctx.loop((t) => {
    g.clearRect(0, 0, W, H)
    if (t < SHAKE) {
      const amp = ease(phase(t, 0, SHAKE)) * 14 + 1
      root.style.transform = `translate(${rand(-amp, amp)}px, ${rand(-amp, amp) * 0.7}px) rotate(${rand(-amp, amp) * 0.04}deg)`
    } else if (!shards.length) {
      root.style.transform = "none"
      shatter()
    }

    // Cracks spread in the last moments of the shaking, and go with the shatter.
    const crack = phase(t, SHAKE - 900, SHAKE - 50)
    if (crack > 0 && t < SHAKE) {
      g.strokeStyle = "rgba(255,255,255,.95)"
      g.lineWidth = 1.6
      g.shadowColor = "rgba(0,0,0,.6)"
      g.shadowBlur = 3
      for (const e of edges) {
        const show = (crack * maxDist * 1.15 - e.dist) / 120
        if (show <= 0) continue
        const n = Math.max(2, Math.ceil(e.pts.length * Math.min(1, show)))
        g.beginPath()
        e.pts.slice(0, n).forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)))
        g.stroke()
      }
      g.shadowBlur = 0
    }

    if (shards.length) {
      if (t < REWIND_AT) {
        shards.forEach(poseAt(Math.min(FALL, t - SHAKE)))
      } else {
        // Rewind: the fall played backwards, with a VCR's look.
        if (!vhs) {
          vhs = el(ctx, "div", {
            position: "fixed", inset: "0", zIndex: "9979", pointerEvents: "none",
            background: "repeating-linear-gradient(0deg, rgba(0,0,0,.18) 0 2px, transparent 2px 4px)",
            color: "#fff", fontFamily: "ui-monospace, monospace", fontSize: "26px", padding: "24px 32px",
            textShadow: "2px 0 #f0f, -2px 0 #0ff", direction: "rtl",
          })
          vhs.textContent = "⏪ הרצה לאחור"
        }
        const k = ease(phase(t, REWIND_AT, REWIND_AT + REWIND))
        shards.forEach(poseAt(FALL * (1 - k)))
      }
    }

    if (t >= END) { ctx.stop(); return false }
  })
  void backdrop
  return true
}
