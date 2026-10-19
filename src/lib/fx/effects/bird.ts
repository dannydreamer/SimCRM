import { type Ctx, canvasLayer, ease, easeOut, lerp, phase, rand } from "../core"

// A bird flies in, builds a nest on one of the rows twig by twig, a chick pops
// up, the bird brings it a worm, and the two fly off together.

const BLUE = "#3B6FB6"
const BLUE_DARK = "#2A5190"
const BELLY = "#F2B880"
const BEAK = "#F4A51C"

type Pt = { x: number; y: number }

function drawBird(
  g: CanvasRenderingContext2D, x: number, y: number, s: number, flap: number, facing: number,
  carry: "twig" | "worm" | null, t: number, perched: boolean,
) {
  g.save()
  g.translate(x, y)
  g.scale(facing * s, s)
  if (perched) {
    g.strokeStyle = "#8a5a2b"
    g.lineWidth = 1.6
    g.beginPath(); g.moveTo(-2, 8); g.lineTo(-4, 15); g.moveTo(3, 8); g.lineTo(2, 15); g.stroke()
  }
  // tail
  g.fillStyle = BLUE_DARK
  g.beginPath(); g.moveTo(-12, -1); g.lineTo(-27, -7); g.lineTo(-25, 4); g.closePath(); g.fill()
  // body, belly, head
  g.fillStyle = BLUE
  g.beginPath(); g.ellipse(0, 0, 15, 10, -0.1, 0, Math.PI * 2); g.fill()
  g.fillStyle = BELLY
  g.beginPath(); g.ellipse(4, 4, 9, 5.5, -0.2, 0, Math.PI * 2); g.fill()
  g.fillStyle = BLUE
  g.beginPath(); g.arc(12, -7, 7.5, 0, Math.PI * 2); g.fill()
  // eye
  g.fillStyle = "#111"
  g.beginPath(); g.arc(14.5, -8.5, 1.7, 0, Math.PI * 2); g.fill()
  g.fillStyle = "#fff"
  g.beginPath(); g.arc(15, -9, 0.6, 0, Math.PI * 2); g.fill()
  // beak
  g.fillStyle = BEAK
  g.beginPath(); g.moveTo(18.5, -8); g.lineTo(25.5, -6); g.lineTo(18.5, -4); g.closePath(); g.fill()
  // wing
  g.save()
  g.translate(-2, -3)
  g.rotate(-flap)
  g.fillStyle = BLUE_DARK
  g.beginPath(); g.ellipse(-5, -1, 11, 5, -0.2, 0, Math.PI * 2); g.fill()
  g.restore()
  // what it carries
  if (carry === "twig") {
    g.strokeStyle = "#7a4f24"
    g.lineWidth = 2
    g.beginPath(); g.moveTo(14, -3); g.lineTo(36, -9); g.moveTo(28, -7); g.lineTo(33, -13); g.stroke()
  } else if (carry === "worm") {
    g.strokeStyle = "#E88A9A"
    g.lineWidth = 3
    g.lineCap = "round"
    g.beginPath()
    g.moveTo(25, -6)
    for (let i = 1; i <= 6; i++) g.lineTo(25 + Math.sin(t / 90 + i) * 3, -6 + i * 3)
    g.stroke()
  }
  g.restore()
}

function drawChick(g: CanvasRenderingContext2D, x: number, y: number, s: number, beak: number, t: number) {
  g.save()
  g.translate(x, y)
  g.scale(s, s)
  g.fillStyle = "#FFD84D"
  g.beginPath(); g.arc(0, 0, 8, 0, Math.PI * 2); g.fill()
  // fluff
  g.strokeStyle = "#E8B923"
  g.lineWidth = 1.2
  g.beginPath(); g.moveTo(-1, -8); g.lineTo(-3, -12); g.moveTo(1, -8); g.lineTo(2, -12.5); g.stroke()
  g.fillStyle = "#111"
  g.beginPath(); g.arc(-3, -2, 1.3, 0, Math.PI * 2); g.arc(3, -2, 1.3, 0, Math.PI * 2); g.fill()
  // beak, opening
  const o = beak * 4
  g.fillStyle = BEAK
  g.beginPath(); g.moveTo(-3, 1); g.lineTo(0, 1 - o - 1); g.lineTo(3, 1); g.closePath(); g.fill()
  g.beginPath(); g.moveTo(-3, 2); g.lineTo(0, 2 + o + 2.5); g.lineTo(3, 2); g.closePath(); g.fill()
  if (beak > 0.3) {
    g.fillStyle = "#C2413A"
    g.beginPath(); g.ellipse(0, 1.5, 2, o * 0.6, 0, 0, Math.PI * 2); g.fill()
  }
  g.restore()
  void t
}

interface Twig { a: number; r: number; len: number; tilt: number; color: string }
const TWIGS: Twig[] = Array.from({ length: 46 }, (_, i) => ({
  a: Math.PI * (0.05 + 0.9 * Math.random()),
  r: 0.75 + Math.random() * 0.3,
  len: 10 + Math.random() * 14,
  tilt: rand(-0.5, 0.5),
  color: ["#7a4f24", "#8f6232", "#5f3c1a", "#a47640"][i % 4],
}))

function drawNest(g: CanvasRenderingContext2D, x: number, y: number, p: number, front: boolean) {
  const n = Math.round(TWIGS.length * p)
  g.save()
  g.lineCap = "round"
  for (let i = 0; i < n; i++) {
    const tw = TWIGS[i]
    // back half first (behind the chick), then front half
    const isFront = tw.a > Math.PI * 0.2 && tw.a < Math.PI * 0.8
    if (isFront !== front) continue
    const cx = x + Math.cos(tw.a) * 26 * tw.r
    const cy = y - 4 + Math.sin(tw.a) * 10 * tw.r
    const ang = tw.a + Math.PI / 2 + tw.tilt
    g.strokeStyle = tw.color
    g.lineWidth = 2.2
    g.beginPath()
    g.moveTo(cx - Math.cos(ang) * tw.len / 2, cy - Math.sin(ang) * tw.len / 2)
    g.lineTo(cx + Math.cos(ang) * tw.len / 2, cy + Math.sin(ang) * tw.len / 2)
    g.stroke()
  }
  g.restore()
}

function findPerch(W: number, H: number): Pt {
  const rows = Array.from(document.querySelectorAll<HTMLElement>("main tbody tr, main li, main h1, main h2, main .rounded-xl"))
    .map((e) => e.getBoundingClientRect())
    .filter((r) => r.width > 120 && r.top > H * 0.25 && r.top < H * 0.75)
  const r = rows[Math.floor(rows.length / 2)]
  if (!r) return { x: W * 0.45, y: H * 0.55 }
  return { x: r.left + r.width * rand(0.3, 0.6), y: r.top }
}

export function bird(ctx: Ctx): boolean {
  const { W, H, sound } = ctx
  const { g } = canvasLayer(ctx, 9984)
  const nest = findPerch(W, H)
  const perch: Pt = { x: nest.x + 34, y: nest.y - 12 }
  const s = Math.max(1.4, Math.min(2, W / 700))

  // Each leg: [start ms, end ms, from, to, arc height, carrying]
  type Leg = [number, number, Pt, Pt, number, "twig" | "worm" | null]
  const sky = (dx: number): Pt => ({ x: Math.min(W + 40, Math.max(-40, nest.x + dx)), y: -50 })
  const legs: Leg[] = [
    [0, 2200, { x: W + 50, y: H * 0.2 }, perch, -60, "twig"],
  ]
  let t0 = 2600
  for (let i = 0; i < 3; i++) {
    const away = sky(i % 2 ? -260 : 220)
    legs.push([t0, t0 + 650, perch, away, 40, null])
    legs.push([t0 + 650, t0 + 1350, away, perch, -40, "twig"])
    t0 += 1550
  }
  // t0 ≈ 7250: the nest is done
  const CHICK_UP = t0 + 200
  const WORM_OUT = t0 + 1200
  const worm = sky(320)
  legs.push([WORM_OUT, WORM_OUT + 700, perch, worm, 40, null])
  legs.push([WORM_OUT + 700, WORM_OUT + 1700, worm, perch, -50, "worm"])
  const FEED = WORM_OUT + 1700            // ≈ 10150
  const SWALLOW = FEED + 900
  const LEAVE = SWALLOW + 1100
  const END = LEAVE + 2400

  const landings = new Set<number>()
  legs.forEach((l, i) => { if (l[3] === perch) landings.add(i) })
  const sounded = new Set<string>()
  const once = (key: string, fn: () => void) => { if (!sounded.has(key)) { sounded.add(key); fn() } }

  const hearts: { x: number; y: number; born: number }[] = []

  ctx.loop((t) => {
    g.clearRect(0, 0, W, H)

    // Nest progress: a quarter per twig delivered.
    let delivered = 0
    legs.forEach((l, i) => { if (l[5] === "twig" && landings.has(i) && t >= l[1]) delivered++ })
    const nestP = Math.min(1, delivered / 4)
    const nestAlpha = 1 - phase(t, END - 900, END)

    // Where is the parent?
    let pos: Pt = perch
    let flying = false
    let carry: "twig" | "worm" | null = null
    let facing = -1
    for (let i = 0; i < legs.length; i++) {
      const [a, b, from, to, arc, c] = legs[i]
      if (t >= a && t < b) {
        const k = ease(phase(t, a, b))
        pos = { x: lerp(from.x, to.x, k), y: lerp(from.y, to.y, k) + Math.sin(k * Math.PI) * arc }
        flying = true
        carry = c
        facing = to.x >= from.x ? 1 : -1
        if (landings.has(i) && k > 0.97) once(`land${i}`, () => sound.chirp())
        if (!landings.has(i) && k < 0.1) once(`off${i}`, () => sound.noise(0, 0.25, { filter: "bandpass", freq: 600, q: 0.7, vol: 0.12 }))
        break
      }
    }
    if (!flying && t >= FEED && t < SWALLOW) carry = "worm"
    if (t >= LEAVE) {
      const k = easeOut(phase(t, LEAVE, END - 300))
      pos = { x: lerp(perch.x, -80, k), y: lerp(perch.y, H * 0.15, k) - Math.sin(k * Math.PI) * 40 }
      flying = true
      facing = -1
    }

    // The chick
    const chickRise = easeOut(phase(t, CHICK_UP, CHICK_UP + 500))
    let chick: Pt = { x: nest.x, y: nest.y - 6 - chickRise * 12 }
    let beak = 0
    if (t > CHICK_UP + 500 && t < WORM_OUT) beak = Math.max(0, Math.sin(t / 70)) * 0.6
    if (t >= FEED && t < SWALLOW) beak = 0.4 + 0.6 * Math.abs(Math.sin(t / 60))
    if (t > CHICK_UP + 400) once("cheep", () => { sound.chirp(0, 1.45); sound.chirp(0.4, 1.5) })
    if (t > FEED) once("beg", () => { for (let i = 0; i < 4; i++) sound.chirp(i * 0.18, 1.55) })
    if (t > SWALLOW) once("gulp", () => {
      sound.tone(500, 0, 0.18, { type: "sine", slideTo: 900, vol: 0.25 })
      for (let i = 0; i < 6; i++) sound.chirp(0.3 + i * 0.12, 1.3 + (i % 2) * 0.2)
    })
    if (t > SWALLOW && hearts.length < 5 && Math.random() < 0.06) hearts.push({ x: chick.x + rand(-10, 10), y: chick.y - 10, born: t })
    let chickFlying = false
    if (t >= LEAVE + 300) {
      const k = easeOut(phase(t, LEAVE + 300, END))
      chick = { x: lerp(nest.x, -60, k), y: lerp(chick.y, H * 0.2, k) - Math.sin(k * Math.PI) * 30 + Math.sin(t / 80) * 4 }
      chickFlying = true
    }

    // Draw: back of the nest, chick, front of the nest, worm handover, parent.
    g.globalAlpha = nestAlpha
    drawNest(g, nest.x, nest.y, nestP, false)
    g.globalAlpha = 1
    if (chickRise > 0) {
      if (chickFlying) {
        drawBird(g, chick.x, chick.y, s * 0.55, Math.sin(t / 40) * 0.9, -1, null, t, false)
      } else {
        drawChick(g, chick.x, chick.y, s, beak, t)
      }
    }
    g.globalAlpha = nestAlpha
    drawNest(g, nest.x, nest.y, nestP, true)
    g.globalAlpha = 1

    // The worm crosses from beak to beak, then is gone.
    if (t >= FEED + 300 && t < SWALLOW) {
      const k = phase(t, FEED + 300, SWALLOW)
      const wx = lerp(perch.x - 22 * s, chick.x, k)
      const wy = lerp(perch.y - 6 * s, chick.y, k)
      g.strokeStyle = "#E88A9A"
      g.lineWidth = 3
      g.lineCap = "round"
      g.beginPath()
      g.moveTo(wx, wy)
      for (let i = 1; i <= 5; i++) g.lineTo(wx + Math.sin(t / 70 + i) * 3, wy + i * 3 * (1 - k))
      g.stroke()
      carry = null
    }

    // Leaning in to feed: a little bow.
    const bow = t >= FEED && t < SWALLOW ? 0.35 : 0
    g.save()
    g.translate(pos.x, pos.y)
    g.rotate(facing === -1 ? -bow : bow)
    drawBird(g, 0, 0, s, flying ? Math.sin(t / 45) * 0.9 : Math.sin(t / 400) * 0.05, facing, carry, t, !flying)
    g.restore()

    for (const h of hearts) {
      const age = (t - h.born) / 1000
      g.globalAlpha = Math.max(0, 1 - age)
      g.font = "16px sans-serif"
      g.fillText("❤", h.x + Math.sin(age * 6) * 5, h.y - age * 40)
    }
    g.globalAlpha = 1

    if (t >= END) { ctx.stop(); return false }
  })
  return true
}
