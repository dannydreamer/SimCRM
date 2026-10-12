import { type Ctx, easeIn, easeOutBack, lerp, liftOut, phase, rand } from "../core"

// The first row tips over and knocks down the next, all the way down the
// table. The last one hits a button, which flies off like a ball. Then
// everything stands back up.

export function dominoes(ctx: Ctx): boolean {
  const main = document.querySelector("main")
  if (!main) return false
  const { W, H, sound } = ctx
  const visible = (e: HTMLElement) => {
    const r = e.getBoundingClientRect()
    return r.height > 10 && r.width > 60 && r.top >= 0 && r.bottom <= H
  }
  let rows = Array.from(main.querySelectorAll<HTMLElement>("tbody tr")).filter(visible).slice(0, 18)
  if (rows.length < 4) {
    rows = Array.from(main.querySelectorAll<HTMLElement>("li, h1, h2, h3, p, .rounded-xl, .rounded-lg")).filter(visible).slice(0, 14)
  }
  if (rows.length < 4) return false
  rows.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)

  // The ball: a button, preferably the page's main one.
  const btn = Array.from(main.querySelectorAll<HTMLElement>("button, a.rounded-lg"))
    .filter((b) => visible(b) && !rows.some((r) => r.contains(b)))
    .sort((a, b) => (b.className.includes("bg-navy") ? 1 : 0) - (a.className.includes("bg-navy") ? 1 : 0))[0]

  const lifted = liftOut(ctx, btn ? [...rows, btn] : rows)
  const copies = lifted.copies.slice(0, rows.length)
  const rects = lifted.rects.slice(0, rows.length)
  const ball = btn ? lifted.copies[rows.length] : null
  const ballRect = btn ? lifted.rects[rows.length] : null
  copies.forEach((c) => { c.style.transformOrigin = "50% 100%"; c.style.boxShadow = "none" })

  const START = 300, GAP = 170, FALL = 420
  const fellAt = (i: number) => START + i * GAP
  const lastDown = fellAt(rows.length - 1) + FALL
  const HIT = lastDown
  const FLY = 1700
  const UP = HIT + FLY + 300
  const UP_GAP = 60, UP_DUR = 500
  const END = UP + rows.length * UP_GAP + UP_DUR + 400

  if (sound.on) {
    rows.forEach((_, i) => {
      const at = (fellAt(i) + FALL) / 1000
      sound.click(at, 0.35)
      sound.tone(rand(500, 700), at, 0.06, { type: "triangle", vol: 0.12 })
    })
    if (ball) sound.tone(180, HIT / 1000, 0.45, { type: "sine", vol: 0.35, slideTo: 760 })
    sound.whoosh(UP / 1000, 0.9, true, 0.25)
    ;[0, 4, 7, 12].forEach((n, i) => sound.tone(523 * 2 ** (n / 12), (END - 500) / 1000 + i * 0.05, 0.6, { type: "triangle", vol: 0.15 }))
  }

  // Ball flight: launched up and away, bouncing on the floor, out of sight.
  const fly = (s: number) => {
    if (!ballRect) return { x: 0, y: 0, rot: 0 }
    const vx = -0.55, vy0 = -0.9, gr = 0.0022
    let y = ballRect.top, v = vy0, x = ballRect.left
    // integrate in 10 ms steps — cheap at this length
    for (let k = 0; k < s / 10; k++) {
      v += gr * 10
      y += v * 10
      x += vx * 10
      if (y > H - ballRect.height - 8 && v > 0) { y = H - ballRect.height - 8; v = -v * 0.55 }
    }
    return { x, y, rot: s * 0.012 }
  }

  ctx.loop((t) => {
    copies.forEach((c, i) => {
      const r = rects[i]
      let a = 0
      if (t < UP) {
        a = 88 * easeIn(phase(t, fellAt(i), fellAt(i) + FALL))
        // the little wobble of the one about to go
        if (t > fellAt(i) - 120 && t < fellAt(i)) a = 4 * Math.sin((t - fellAt(i)) / 25)
      } else {
        const j = rows.length - 1 - i
        a = 88 * (1 - easeOutBack(phase(t, UP + j * UP_GAP, UP + j * UP_GAP + UP_DUR)))
      }
      c.style.transform = `translate(${r.left}px, ${r.top}px) perspective(900px) rotateX(${a}deg)`
      c.style.filter = `brightness(${1 - Math.min(Math.abs(a), 88) / 220})`
    })

    if (ball && ballRect) {
      let x = ballRect.left, y = ballRect.top, rot = 0
      if (t >= HIT && t < UP) {
        const f = fly(t - HIT)
        x = f.x; y = f.y; rot = f.rot
      } else if (t >= UP) {
        // flies back in along a lazy arc
        const out = fly(FLY)
        const k = easeOutBack(phase(t, UP, UP + 900))
        x = lerp(out.x, ballRect.left, k)
        y = lerp(out.y, ballRect.top, k) - Math.sin(k * Math.PI) * 120
        rot = lerp(out.rot, 0, k)
      }
      ball.style.transform = `translate(${x}px, ${y}px) rotate(${rot}rad)`
    }

    if (t >= END) { ctx.stop(); return false }
  })
  void W
  return true
}
