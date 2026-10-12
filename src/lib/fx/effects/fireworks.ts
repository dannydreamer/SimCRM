import {
  type Ctx, canvasLayer, collectGlyphs, drawGlyph, hideText, ease, easeOut, lerp, phase, rand, sampleText,
} from "../core"

// Night falls. The page's letters gather at the foot of the screen, launch
// as rockets and burst into colour — and the last of them spell כיתקטיקה in
// gold before flying home.

const HUES = ["#FF4D6D", "#FFD23F", "#3BCEAC", "#4DA3FF", "#C77DFF", "#FF9F1C", "#F15BB5"]
const GOLD = "#FFD54A"

export function fireworks(ctx: Ctx): boolean {
  const base = collectGlyphs(2400)
  if (base.length < 40) return false
  const { W, H, sound } = ctx
  const K = 7
  const FLIGHT = 900
  const launchAt = (k: number) => 1100 + k * 520
  const burstAt = (k: number) => launchAt(k) + FLIGHT
  const FINALE = burstAt(K - 1) + 1500
  const HOLD = FINALE + 1300
  const HOME = HOLD + 1500
  const END = HOME + 1300

  const rockets = Array.from({ length: K }, (_, k) => {
    const x = ((k + 0.5) / K) * W
    return {
      pad: { x, y: H - 30 },
      burst: { x: x + rand(-60, 60), y: rand(H * 0.14, H * 0.42) },
      hue: HUES[k % HUES.length],
    }
  })
  const words = sampleText("כיתקטיקה", W / 2, H * 0.42, Math.min(170, W / 6.5), base.length)

  const counts = new Array(K).fill(0)
  const ps = base.map((gl, i) => {
    const k = Math.min(K - 1, Math.floor((gl.x / W) * K))
    const idx = counts[k]++
    return {
      gl, k, idx,
      gStart: rand(0, 500),
      pad: { x: rockets[k].pad.x + rand(-26, 26), y: H - 24 - rand(0, 40) },
      x: gl.x, y: gl.y, vx: 0, vy: 0, burst: false,
      word: words[i], from: { x: 0, y: 0 }, fromHome: { x: 0, y: 0 },
    }
  })

  const { g } = canvasLayer(ctx)
  hideText(ctx)
  const stars = Array.from({ length: 90 }, () => ({ x: rand(0, W), y: rand(0, H * 0.75), ph: rand(0, 6), r: rand(0.5, 1.6) }))
  const sparks: { x: number; y: number; vx: number; vy: number; born: number; c: string }[] = []

  if (sound.on) {
    for (let k = 0; k < K; k++) {
      const l = launchAt(k) / 1000, b = burstAt(k) / 1000
      sound.tone(500, l, FLIGHT / 1000, { type: "sine", vol: 0.08, slideTo: 1600 })
      sound.noise(l, FLIGHT / 1000, { filter: "highpass", freq: 3000, vol: 0.05 })
      sound.boom(b, 0.5)
      for (let i = 0; i < 10; i++) sound.click(b + 0.15 + Math.random() * 0.6, 0.12)
    }
    sound.boom(FINALE / 1000 - 0.1, 0.8)
    for (let i = 0; i < 24; i++) sound.tone(rand(1800, 4200), FINALE / 1000 + Math.random() * 1.6, 0.08, { type: "sine", vol: 0.06 })
  }

  ctx.loop((t, dt) => {
    g.clearRect(0, 0, W, H)
    const night = phase(t, 0, 900) * (1 - phase(t, HOME, END))
    g.fillStyle = `rgba(8,12,35,${0.9 * night})`
    g.fillRect(0, 0, W, H)
    for (const s of stars) {
      g.fillStyle = `rgba(255,255,255,${night * (0.4 + 0.6 * Math.abs(Math.sin(t / 700 + s.ph)))})`
      g.beginPath(); g.arc(s.x, s.y, s.r, 0, Math.PI * 2); g.fill()
    }

    // Burst sparks: plain dots, for richness.
    for (let k = 0; k < K; k++) {
      if (t >= burstAt(k) && t - dt < burstAt(k)) {
        const r = rockets[k]
        for (let i = 0; i < 70; i++) {
          const a = rand(0, Math.PI * 2), v = rand(1, 5)
          sparks.push({ x: r.burst.x, y: r.burst.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, born: t, c: r.hue })
        }
      }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]
      const age = (t - s.born) / 1100
      if (age > 1) { sparks.splice(i, 1); continue }
      s.vy += 0.05; s.vx *= 0.98; s.vy *= 0.98
      s.x += s.vx; s.y += s.vy
      g.globalAlpha = 1 - age
      g.fillStyle = s.c
      g.beginPath(); g.arc(s.x, s.y, 1.8, 0, Math.PI * 2); g.fill()
    }
    g.globalAlpha = 1

    // Rocket heads with their glow.
    for (let k = 0; k < K; k++) {
      if (t < launchAt(k) || t > burstAt(k)) continue
      const r = rockets[k]
      const f = easeOut(phase(t, launchAt(k), burstAt(k)))
      const hx = lerp(r.pad.x, r.burst.x, f), hy = lerp(r.pad.y, r.burst.y, f)
      g.fillStyle = "#FFF6D0"
      g.shadowColor = r.hue
      g.shadowBlur = 16
      g.beginPath(); g.arc(hx, hy, 3, 0, Math.PI * 2); g.fill()
      g.shadowBlur = 0
    }

    for (const p of ps) {
      const r = rockets[p.k]
      let color = p.gl.color
      let glow = 0
      if (t < HOME) {
        if (t < launchAt(p.k)) {
          // gather on the pad
          const f = ease(phase(t, 200 + p.gStart, launchAt(p.k) - 80))
          p.x = lerp(p.gl.x, p.pad.x, f)
          p.y = lerp(p.gl.y, p.pad.y, f)
        } else if (t < burstAt(p.k)) {
          // ride up in the rocket's tail
          const lag = (p.idx / Math.max(1, counts[p.k])) * 380
          const f = easeOut(phase(t - lag, launchAt(p.k), burstAt(p.k)))
          p.x = lerp(p.pad.x, r.burst.x, f) + Math.sin(p.idx) * 3
          p.y = lerp(p.pad.y, r.burst.y, f)
        } else if (t < FINALE) {
          if (!p.burst) {
            p.burst = true
            const a = rand(0, Math.PI * 2), v = rand(1.5, 6.5)
            p.x = r.burst.x; p.y = r.burst.y
            p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v
          }
          p.vy += 0.045; p.vx *= 0.975; p.vy *= 0.975
          p.x += p.vx * dt / 16; p.y += p.vy * dt / 16
          color = r.hue
          glow = 8
        } else {
          if (p.from.x === 0 && p.from.y === 0) p.from = { x: p.x, y: p.y }
          const f = ease(phase(t, FINALE, FINALE + 1200))
          p.x = lerp(p.from.x, p.word.x, f)
          p.y = lerp(p.from.y, p.word.y, f)
          color = f > 0.3 ? GOLD : r.hue
          glow = 6 + 6 * Math.abs(Math.sin(t / 200 + p.idx))
        }
      } else {
        if (p.fromHome.x === 0 && p.fromHome.y === 0) p.fromHome = { x: p.x, y: p.y }
        const f = ease(phase(t, HOME, END - 100))
        p.x = lerp(p.fromHome.x, p.gl.x, f)
        p.y = lerp(p.fromHome.y, p.gl.y, f)
        color = f > 0.6 ? p.gl.color : GOLD
      }
      if (glow) { g.shadowColor = color; g.shadowBlur = glow }
      drawGlyph(g, p.gl, p.x, p.y, 0, color)
      g.shadowBlur = 0
    }

    if (t >= END) { ctx.stop(); return false }
  })
  return true
}
