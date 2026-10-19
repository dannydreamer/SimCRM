import { type Ctx, canvasLayer, collectGlyphs, drawGlyph, ease, lerp, phase, rand } from "../core"
import { note } from "../sound"

// The page turns to sky — soft sunrays, drifting clouds — and its letters
// gather into birds, which fly off calmly in a V and fade into the distance.
// To the opening of Grieg's "Morning Mood".

const SKY_TOP = "#6FB4EC"
const SKY_BOTTOM = "#D4EEFF"

interface Bird { x: number; y: number; ph: number }

export function migration(ctx: Ctx): boolean {
  const base = collectGlyphs(2200)
  if (base.length < 30) return false
  const { W, H } = ctx
  const { g } = canvasLayer(ctx)
  // The real text goes transparent while the sky comes up, and comes back as
  // it clears — so this effect handles the class itself.
  const html = document.documentElement
  html.classList.add("fx-hide-text")
  let textHidden = true
  const showText = () => { if (textHidden) { textHidden = false; html.classList.remove("fx-hide-text") } }
  ctx.onCleanup(showText)

  const vanish = { x: W * 0.78, y: H * 0.18 }
  const start = { x: W * 0.42, y: H * 0.45 }

  // A V of 13 — the leader, six trailing back on each side — with its point
  // aimed where the flock is going.
  const N = 13
  const span = Math.min(84, W / 14)
  const dir = Math.atan2(vanish.y - start.y, vanish.x - start.x)
  const fwd = { x: Math.cos(dir), y: Math.sin(dir) }
  const birds: Bird[] = [{ x: 0, y: 0, ph: 0 }]
  for (let i = 1; i <= 6; i++) {
    for (const side of [-1, 1]) {
      const back = i * span * 0.55, lateral = side * i * span * 0.6
      birds.push({ x: -back * fwd.x - lateral * fwd.y, y: -back * fwd.y + lateral * fwd.x, ph: rand(0, 1.5) })
    }
  }
  // Every letter joins a bird and takes a place along one of its wings.
  const ps = base.map((gl, i) => {
    const b = i % N
    const f = Math.random()                    // 0 at the body → 1 at the wing tip
    return { gl, b, f, wing: Math.random() < 0.5 ? -1 : 1, jitter: rand(-1.5, 1.5), delay: rand(0, 1200) }
  })

  // Clouds and rays.
  const clouds = Array.from({ length: 6 }, (_, i) => ({ x: rand(-0.1, 1) * W, y: rand(0.08, 0.6) * H, s: rand(0.7, 1.4), v: rand(0.006, 0.014), seed: i }))

  const SKY_IN = 1600, DEPART = 5400, GONE = 13200, END = 14400
  music(ctx)

  ctx.loop((t) => {
    const sky = phase(t, 0, SKY_IN) * (1 - phase(t, GONE, END))
    g.clearRect(0, 0, W, H)
    if (t > GONE + 300) showText()

    // Sky.
    g.globalAlpha = sky
    const sg = g.createLinearGradient(0, 0, 0, H)
    sg.addColorStop(0, SKY_TOP)
    sg.addColorStop(1, SKY_BOTTOM)
    g.fillStyle = sg
    g.fillRect(0, 0, W, H)
    // Sun and soft rays from the upper left.
    const sun = g.createRadialGradient(W * 0.08, -H * 0.05, 10, W * 0.08, -H * 0.05, Math.max(W, H) * 0.7)
    sun.addColorStop(0, "rgba(255,250,220,.9)")
    sun.addColorStop(0.25, "rgba(255,245,210,.35)")
    sun.addColorStop(1, "rgba(255,245,210,0)")
    g.fillStyle = sun
    g.fillRect(0, 0, W, H)
    g.save()
    g.translate(W * 0.08, -H * 0.05)
    for (let i = 0; i < 7; i++) {
      const a = 0.25 + i * 0.17 + Math.sin(t / 3000 + i) * 0.03
      g.rotate(0)
      g.fillStyle = `rgba(255,255,240,${0.07 + 0.03 * Math.sin(t / 1500 + i * 2)})`
      g.beginPath()
      g.moveTo(0, 0)
      g.lineTo(Math.cos(a - 0.035) * W * 1.6, Math.sin(a - 0.035) * W * 1.6)
      g.lineTo(Math.cos(a + 0.035) * W * 1.6, Math.sin(a + 0.035) * W * 1.6)
      g.closePath()
      g.fill()
    }
    g.restore()
    // Clouds: soft white puffs, drifting.
    for (const c of clouds) {
      const x = ((c.x + t * c.v) % (W * 1.3)) - W * 0.15
      drawCloud(g, x, c.y, c.s)
    }
    g.globalAlpha = 1

    // The formation's place and size: hovering, then away into the distance.
    const away = ease(phase(t, DEPART, GONE))
    const fx = lerp(start.x, vanish.x, away) + Math.sin(t / 1400) * 6 * (1 - away)
    const fy = lerp(start.y, vanish.y, away) + Math.sin(t / 900) * 5 * (1 - away)
    const scale = lerp(1, 0.04, away ** 0.8)
    const fade = 1 - phase(t, GONE - 1800, GONE)

    for (const p of ps) {
      const b = birds[p.b]
      // Wing shape: a gull's M, flapping slowly.
      const flap = Math.sin(t / 380 + b.ph)
      const bx = fx + b.x * scale
      const by = fy + b.y * scale
      const wx = p.wing * p.f * span * 0.38
      const wy = (-Math.sin(p.f * Math.PI) * 0.2 - flap * 0.35 * p.f) * span * 0.38
      const tx = bx + wx * scale
      const ty = by + (wy + p.jitter) * scale
      const k = ease(phase(t, 600 + p.delay, 600 + p.delay + 2600))
      // On the way, a gentle rise rather than a straight line.
      const x = lerp(p.gl.x, tx, k)
      const y = lerp(p.gl.y, ty, k) - Math.sin(k * Math.PI) * 60
      const letterScale = lerp(1, 0.62 * Math.max(0.15, scale), k)
      const color = k > 0.5 ? "rgba(40,52,74,.9)" : p.gl.color
      g.globalAlpha = k > 0.9 ? fade : 1
      if (g.globalAlpha > 0.01) drawGlyph(g, p.gl, x, y, k * p.wing * 0.4, color, letterScale)
    }
    g.globalAlpha = 1

    if (t >= END) { ctx.stop(); return false }
  })
  return true
}

function drawCloud(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const puffs = [[0, 0, 38], [34, -14, 30], [64, 0, 34], [26, 10, 30], [-30, 6, 26], [90, 10, 24]]
  for (const [dx, dy, r] of puffs) {
    const cx = x + dx * s, cy = y + dy * s, rr = r * s
    const rg = g.createRadialGradient(cx, cy, rr * 0.2, cx, cy, rr)
    rg.addColorStop(0, "rgba(255,255,255,.95)")
    rg.addColorStop(0.7, "rgba(255,255,255,.7)")
    rg.addColorStop(1, "rgba(255,255,255,0)")
    g.fillStyle = rg
    g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.fill()
  }
}

/** Grieg, "Morning Mood" (Peer Gynt, 1875): the flute's opening, over strings. */
function music(ctx: Ctx) {
  const s = ctx.sound
  if (!s.on) return
  const E5 = note(7), Fs5 = note(9), Gs5 = note(11), B5 = note(14), Cs6 = note(16)
  const phrase: [number, number][] = [
    [Gs5, 1], [Fs5, 1], [E5, 1], [Fs5, 1], [Gs5, 1], [Fs5, 1],
    [E5, 1], [Fs5, 1], [Gs5, 1], [Fs5, 1], [Gs5, 1], [B5, 1],
    [Gs5, 1], [B5, 1], [Cs6, 1], [Gs5, 1], [Cs6, 1], [B5, 1],
    [Gs5, 1], [Fs5, 1], [E5, 4],
  ]
  const bpm = 190 // quavers in a gentle 6/8
  const flute = { type: "sine" as OscillatorType, vol: 0.22, attack: 0.05 }
  const len = s.melody(phrase, 0.6, bpm, flute)
  s.melody(phrase, 0.6, bpm, { ...flute, vol: 0.08, detune: 7 })        // a touch of chorus
  // Second time, an octave down and softer, as the birds leave.
  s.melody(phrase.map(([f, b]) => [f / 2, b] as [number, number]), 0.6 + len + 0.4, bpm, { ...flute, vol: 0.16 })
  // Strings: E major, a turn to A, home to E.
  const chord = (fs: number[], at: number, dur: number) =>
    fs.forEach((f) => s.tone(f, at, dur, { type: "triangle", vol: 0.05, attack: 0.8, release: 1 }))
  const E = [note(-17), note(-10), note(-5), note(-1)]
  const A = [note(-12), note(-5), note(-8), note(0)]
  const B = [note(-10), note(-3), note(-6), note(2)]
  chord(E, 0.4, 4.2)
  chord(A, 4.4, 2.2)
  chord(B, 6.4, 1.4)
  chord(E, 7.8, 6)
}
