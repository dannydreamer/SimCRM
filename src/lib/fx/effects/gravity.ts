import { type Ctx, canvasLayer, collectGlyphs, drawGlyph, hideText, ease, lerp, phase, rand } from "../core"

// Every visible letter comes loose, falls, bounces once and piles into dunes
// at the foot of the screen — then flies home.

export function gravity(ctx: Ctx): boolean {
  const base = collectGlyphs()
  if (base.length < 20) return false
  const { W, H, sound } = ctx

  const glyphs = base.map((g) => ({
    g, x: g.x, y: g.y, vx: rand(-2, 2), vy: 0, rot: 0, vr: rand(-0.12, 0.12),
    // Lower lines go first, with plenty of jitter, so it crumbles rather than
    // dropping as one sheet.
    delay: (1 - g.y / H) * 700 + Math.random() * 600,
    bounced: false, resting: false, slides: 0,
  }))

  const { g } = canvasLayer(ctx)
  hideText(ctx)
  sound.tone(1400, 0.2, 1.6, { type: "sine", vol: 0.12, slideTo: 300 })

  // A height map along the floor, so letters pile up instead of overlapping.
  const BUCKET = 4
  const floor = new Float32Array(Math.ceil(W / BUCKET) + 1).fill(H)
  const span = (x: number, w: number) => [
    Math.max(0, Math.floor((x - w / 2) / BUCKET)),
    Math.min(floor.length - 1, Math.floor((x + w / 2) / BUCKET)),
  ] as const
  const topAt = (x: number, w: number) => {
    if (x - w / 2 < 0 || x + w / 2 > W) return -Infinity // the screen edge is a wall
    const [a, b] = span(x, w)
    let top = H
    for (let i = a; i <= b; i++) top = Math.min(top, floor[i])
    return top
  }

  const FALL_END = 3600, RETURN_START = 4300, RETURN_END = 5600
  let returnFrom: { x: number; y: number; rot: number }[] | null = null
  let lastTick = 0

  ctx.loop((t) => {
    g.clearRect(0, 0, W, H)
    if (t < RETURN_START) {
      let landed = 0
      for (const p of glyphs) {
        if (p.resting || t < p.delay || t > FALL_END + 400) continue
        p.vy += 0.55
        p.x = Math.max(p.g.w / 2, Math.min(W - p.g.w / 2, p.x + p.vx))
        p.y += p.vy
        p.rot += p.vr
        const top = topAt(p.x, p.g.w)
        if (p.y + p.g.h / 2 >= top) {
          p.y = top - p.g.h / 2
          // Like sand: a letter landing on a slope slides off it, so the text
          // spreads into dunes instead of standing in towers.
          const step = Math.max(p.g.w, 6)
          const left = topAt(p.x - step, p.g.w)
          const right = topAt(p.x + step, p.g.w)
          if (Math.max(left, right) - top > p.g.h * 0.4 && p.slides < 60) {
            p.slides++
            p.x += left > right ? -step : step
            p.vy = 1
            continue
          }
          if (!p.bounced && p.vy > 5) {
            p.bounced = true
            p.vy = -p.vy * 0.3
            p.vx *= 0.6
          } else {
            p.resting = true
            landed++
            const settle = top - p.g.h * 0.45
            const [a, b] = span(p.x, p.g.w)
            for (let i = a; i <= b; i++) floor[i] = Math.min(floor[i], settle)
          }
        }
      }
      if (landed && t - lastTick > 35) { lastTick = t; sound.click(0, 0.06 + Math.min(0.12, landed * 0.01)) }
    } else {
      if (!returnFrom) { returnFrom = glyphs.map((p) => ({ x: p.x, y: p.y, rot: p.rot })); sound.whoosh(0, 1.2, true, 0.25) }
      const k = ease(phase(t, RETURN_START, RETURN_END))
      glyphs.forEach((p, i) => {
        const f = returnFrom![i]
        p.x = lerp(f.x, p.g.x, k)
        p.y = lerp(f.y, p.g.y, k)
        p.rot = lerp(f.rot, 0, k)
      })
    }
    for (const p of glyphs) drawGlyph(g, p.g, p.x, p.y, p.rot)
    if (t >= RETURN_END) { ctx.stop(); return false }
  })
  return true
}
