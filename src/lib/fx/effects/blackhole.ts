import {
  type Ctx, appRoot, canvasLayer, collectGlyphs, drawGlyph, hideText, easeIn, easeOutBack, lerp, phase, rand, setStyle,
} from "../core"

// Everything spirals into a black hole at the centre of the screen. A beat of
// silence in the dark — then a big bang throws it all back where it belongs.

export function blackhole(ctx: Ctx): boolean {
  const glyphs = collectGlyphs(3000)
  const root = appRoot()
  if (glyphs.length < 20 || !root) return false
  const { W, H, sound } = ctx
  const cx = W / 2
  const cy = H / 2

  const ps = glyphs.map((gl) => {
    const dx = gl.x - cx, dy = gl.y - cy
    return { gl, r0: Math.hypot(dx, dy), a0: Math.atan2(dy, dx), delay: rand(0, 500), spin: rand(4, 7) }
  })
  const maxR = Math.hypot(cx, cy)

  // The page's frame (boxes, borders, pills) goes down the hole too.
  const rr = root.getBoundingClientRect()
  setStyle(ctx, root, { transformOrigin: `${cx - rr.left}px ${cy - rr.top}px`, willChange: "transform, filter" })

  const { g } = canvasLayer(ctx, 9981)
  hideText(ctx)

  const SUCK = 3000, DARK = 3900, BANG = 4100, BACK = 5600
  if (sound.on) {
    sound.noise(0, 3, { filter: "bandpass", freq: 150, freqTo: 2400, q: 2, vol: 0.35, attack: 2.4, release: 0.2 })
    sound.tone(60, 0, 3, { type: "sawtooth", vol: 0.08, slideTo: 30, attack: 1.5, release: 0.3 })
    sound.boom(BANG / 1000, 0.9)
    sound.whoosh(BANG / 1000, 1.2, false, 0.3)
  }

  ctx.loop((t) => {
    g.clearRect(0, 0, W, H)

    // The hole: a dark disc with a glowing ring, growing as it feeds.
    const holeR = t < SUCK ? lerp(4, 46, easeIn(phase(t, 0, SUCK))) : t < BANG ? lerp(46, 10, phase(t, SUCK, DARK)) : 0
    // The rest of the screen darkens into space.
    const dark = t < BANG ? phase(t, 600, SUCK) : 1 - phase(t, BANG, BANG + 700)
    if (dark > 0) {
      const rg = g.createRadialGradient(cx, cy, holeR, cx, cy, maxR)
      rg.addColorStop(0, `rgba(0,0,0,${dark})`)
      rg.addColorStop(1, `rgba(5,5,20,${dark * 0.9})`)
      g.fillStyle = rg
      g.fillRect(0, 0, W, H)
    }
    if (holeR > 0) {
      const ring = g.createRadialGradient(cx, cy, holeR * 0.9, cx, cy, holeR * 2.6)
      ring.addColorStop(0, "rgba(255,170,60,.9)")
      ring.addColorStop(0.35, "rgba(160,80,255,.35)")
      ring.addColorStop(1, "rgba(0,0,0,0)")
      g.fillStyle = ring
      g.beginPath(); g.arc(cx, cy, holeR * 2.6, 0, Math.PI * 2); g.fill()
      g.fillStyle = "#000"
      g.beginPath(); g.arc(cx, cy, holeR, 0, Math.PI * 2); g.fill()
    }

    // The flash.
    if (t >= BANG && t < BANG + 500) {
      g.fillStyle = `rgba(255,255,255,${1 - phase(t, BANG, BANG + 500)})`
      g.fillRect(0, 0, W, H)
    }

    // The frame: shrinks and turns into the hole, then bursts back out.
    if (t < SUCK) {
      const k = easeIn(phase(t, 300, SUCK))
      root.style.transform = `scale(${1 - k}) rotate(${k * 540}deg)`
      root.style.filter = `blur(${k * 3}px)`
    } else if (t < BANG) {
      root.style.transform = "scale(0)"
    } else {
      const k = easeOutBack(phase(t, BANG, BACK))
      root.style.transform = `scale(${k}) rotate(${(1 - phase(t, BANG, BACK)) * -200}deg)`
      root.style.filter = `blur(${(1 - phase(t, BANG, BACK)) * 4}px)`
    }

    // Letters: an inward spiral, faster as they near the centre.
    for (const p of ps) {
      let r: number, a: number
      if (t < SUCK) {
        const k = easeIn(phase(t, p.delay, SUCK - 200))
        r = p.r0 * (1 - k)
        a = p.a0 + k * k * p.spin
        if (r < holeR) continue
      } else if (t < BANG) {
        continue
      } else {
        const k = easeOutBack(phase(t, BANG + p.delay * 0.3, BACK))
        r = p.r0 * k
        a = p.a0 + (1 - k) * -p.spin * 0.5
      }
      const scale = t < SUCK ? Math.max(0.2, r / (p.r0 || 1)) : 1
      drawGlyph(g, p.gl, cx + Math.cos(a) * r, cy + Math.sin(a) * r, t < SUCK ? (a - p.a0) : 0, p.gl.color, scale)
    }

    if (t >= BACK + 200) { ctx.stop(); return false }
  })
  return true
}
