import { type Ctx, canvasLayer, ease, el, lerp, lerpAngle, liftOut, phase, pickBlocks } from "../core"

// Rows fly out of the page and become a hula dancer — torso, head, arms and
// legs, and long hair, all made of rows — with a smiling face, a grass skirt,
// a lei and a hibiscus drawn on top. Hips sway, arms wave side to side.

interface Limb { x: number; y: number; a: number; len: number; th: number; round: number }

const PART_COUNT = 10
const HAIR_COUNT = 6

function place(e: HTMLElement, l: Limb) {
  e.style.width = `${l.len}px`
  e.style.height = `${l.th}px`
  e.style.borderRadius = `${l.round}px`
  e.style.transform = `translate(${l.x}px, ${l.y}px) rotate(${l.a}rad) translateY(${-l.th / 2}px)`
}

interface Pose {
  limbs: Limb[]
  hip: { x: number; y: number; a: number; w: number }
  neck: { x: number; y: number }
  head: { x: number; y: number; r: number; tilt: number }
  sway: number
  U: number
}

const dir = (a: number) => [Math.cos(a), Math.sin(a)] as const
const end = (l: Limb) => { const [dx, dy] = dir(l.a); return [l.x + dx * l.len, l.y + dy * l.len] as const }
const mirror = (a: number) => Math.PI - a

function pose(s: number, W: number, H: number): Pose {
  const U = Math.min(W / 7, H / 7.4)
  const T = U * 0.5
  const ph = s * Math.PI * 2 * 0.8            // one hip sway every 1¼ s
  const sway = Math.sin(ph)
  const seg = (x: number, y: number, a: number, len: number, th = T): Limb => ({ x, y, a, len, th, round: th / 2 })

  // Hips carry the dance; the upper body stays nearly still above them.
  const hipX = W / 2 + sway * U * 0.55
  const hipY = H * 0.55 + Math.abs(Math.cos(ph)) * U * 0.06
  const torso = seg(hipX, hipY, -Math.PI / 2 - sway * 0.2, U * 1.9, T * 1.9)
  const [shX, shY] = end(torso)

  // Arms: both reach to one side and ripple, then glide to the other side.
  const side = ease((Math.sin(s * Math.PI * 2 * 0.2) + 1) / 2)   // 0 = right, 1 = left
  const wave = Math.sin(ph * 2)
  const rightCfg = {
    upR: -0.25 + 0.08 * wave, foR: -0.25 + 0.08 * wave - 0.35 * Math.sin(ph * 2 + 1),
    upL: 0.45, foL: 0.05 + 0.3 * Math.sin(ph * 2 + 2),
  }
  const upR = lerpAngle(rightCfg.upR, mirror(rightCfg.upL), side)
  const foR = lerpAngle(rightCfg.foR, mirror(rightCfg.foL), side)
  const upL = lerpAngle(rightCfg.upL, mirror(rightCfg.upR), side)
  const foL = lerpAngle(rightCfg.foL, mirror(rightCfg.foR), side)
  const upperR = seg(shX, shY, upR, U * 1.1)
  const upperL = seg(shX, shY, upL, U * 1.1)
  const [eRX, eRY] = end(upperR)
  const [eLX, eLY] = end(upperL)
  const foreR = seg(eRX, eRY, foR, U)
  const foreL = seg(eLX, eLY, foL, U)

  // Knees soft, the one on the side the hip leaves bending more.
  const bendR = 0.25 + 0.2 * Math.max(0, -sway)
  const bendL = 0.25 + 0.2 * Math.max(0, sway)
  const thighR = seg(hipX + U * 0.18, hipY, Math.PI / 2 - 0.12 - bendR * 0.5 - sway * 0.25, U * 1.3)
  const thighL = seg(hipX - U * 0.18, hipY, Math.PI / 2 + 0.12 + bendL * 0.5 - sway * 0.25, U * 1.3)
  const [kRX, kRY] = end(thighR)
  const [kLX, kLY] = end(thighL)
  const footX = W / 2
  const shinR = seg(kRX, kRY, Math.atan2(H * 0.55 + U * 2.45 - kRY, footX + U * 0.45 - kRX), U * 1.25)
  const shinL = seg(kLX, kLY, Math.atan2(H * 0.55 + U * 2.45 - kLY, footX - U * 0.45 - kLX), U * 1.25)

  const d = U * 1.1
  const [tx, ty] = dir(torso.a)
  const hcX = shX + tx * (d / 2 + U * 0.12)
  const hcY = shY + ty * (d / 2 + U * 0.12)
  const tilt = -sway * 0.18
  const head: Limb = { x: hcX - Math.cos(tilt) * d / 2, y: hcY - Math.sin(tilt) * d / 2, a: tilt, len: d, th: d, round: d / 2 }

  // Hair: rows falling from the crown and the sides of the head, behind it,
  // down past the shoulders, swaying a beat behind the hips.
  const hair: Limb[] = []
  const HT = U * 0.24
  for (let i = 0; i < HAIR_COUNT; i++) {
    // alternate sides, so even two spare rows frame the face
    const side = i % 2 ? 1 : -1
    const k = 1 - Math.floor(i / 2) / (HAIR_COUNT / 2 - 1)        // 1 side → 0 crown
    const a = -Math.PI / 2 + side * (0.35 + k * 1.05) + tilt
    const sx = hcX + Math.cos(a) * d * 0.38
    const sy = hcY + Math.sin(a) * d * 0.38
    const fall = Math.PI / 2 - side * (0.12 + k * 0.1) + Math.sin(s * 2.4 + i) * 0.07 - sway * 0.12
    hair.push({ x: sx, y: sy, a: fall, len: U * (2.0 + k * 0.25), th: HT, round: HT / 2 })
  }

  return {
    // Most important first: six usable rows still make a body, head, legs and
    // arms; hair comes last, from whatever rows are left.
    limbs: [torso, head, thighR, thighL, upperR, upperL, shinR, shinL, foreR, foreL, ...hair],
    hip: { x: hipX, y: hipY, a: torso.a + Math.PI / 2, w: T * 2.6 },
    neck: { x: shX, y: shY },
    head: { x: hcX, y: hcY, r: d / 2, tilt },
    sway, U,
  }
}

// ── Decorations, drawn over the row-limbs ────────────────────────────────────

const STRAW = ["#C9A75A", "#B8913F", "#D8BC72", "#A9833A"]
const strands = Array.from({ length: 46 }, (_, i) => ({
  f: i / 45, len: 0.95 + Math.random() * 0.3, color: STRAW[i % STRAW.length], phase: Math.random() * 6,
}))
const LEI = ["#FF6FA0", "#FFD34D", "#FFFFFF", "#FF9E4D", "#E84A8A"]

function decorate(g: CanvasRenderingContext2D, p: Pose, s: number, hipVel: number, alpha: number) {
  if (alpha <= 0) return
  g.save()
  g.globalAlpha = alpha
  const { hip, U } = p
  const [ux, uy] = dir(hip.a)            // along the waist
  const [dx, dy] = [-uy, ux]             // down the body

  // Her face: drawn over the head-row, smiling.
  const { head } = p
  g.save()
  g.translate(head.x, head.y)
  g.rotate(head.tilt)
  const fr = head.r
  g.fillStyle = "rgba(243,201,168,.92)"
  g.beginPath(); g.arc(0, 0, fr * 0.92, 0, Math.PI * 2); g.fill()
  g.fillStyle = "rgba(255,120,140,.35)"
  for (const cx of [-0.48, 0.48]) { g.beginPath(); g.arc(cx * fr, 0.18 * fr, fr * 0.17, 0, Math.PI * 2); g.fill() }
  g.strokeStyle = "#3B2417"
  g.lineCap = "round"
  g.lineWidth = Math.max(2, fr * 0.09)
  for (const ex of [-0.34, 0.34]) {            // happy closed eyes
    g.beginPath(); g.arc(ex * fr, -0.1 * fr, fr * 0.14, Math.PI * 1.1, Math.PI * 1.9); g.stroke()
  }
  g.strokeStyle = "#C2304C"
  g.lineWidth = Math.max(2, fr * 0.1)
  g.beginPath(); g.arc(0, 0.12 * fr, fr * 0.36, Math.PI * 0.15, Math.PI * 0.85); g.stroke()
  g.restore()

  // Hibiscus behind the ear.
  const fx = head.x + head.r * 0.75
  const fy = head.y - head.r * 0.55
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + s
    g.fillStyle = "#FF4F7B"
    g.beginPath()
    g.ellipse(fx + Math.cos(a) * head.r * 0.2, fy + Math.sin(a) * head.r * 0.2, head.r * 0.2, head.r * 0.12, a, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = "#FFD34D"
  g.beginPath(); g.arc(fx, fy, head.r * 0.08, 0, Math.PI * 2); g.fill()

  // Lei around the neck.
  const n = 15
  for (let i = 0; i < n; i++) {
    const a = Math.PI * 0.05 + (i / (n - 1)) * Math.PI * 0.9
    const r = U * 0.42
    const x = p.neck.x + Math.cos(a) * r * 1.1
    const y = p.neck.y - U * 0.05 + Math.sin(a) * r * 0.8
    g.fillStyle = LEI[i % LEI.length]
    g.beginPath(); g.arc(x, y, U * 0.11, 0, Math.PI * 2); g.fill()
    g.fillStyle = "rgba(0,0,0,.15)"
    g.beginPath(); g.arc(x, y, U * 0.035, 0, Math.PI * 2); g.fill()
  }

  // Grass skirt: strands hang from the waistband and trail the hips.
  g.lineCap = "round"
  for (const st of strands) {
    const wx = hip.x + ux * (st.f - 0.5) * hip.w * 1.25
    const wy = hip.y + uy * (st.f - 0.5) * hip.w * 1.25 + U * 0.08
    const L = U * 1.15 * st.len
    const lag = -hipVel * 9 + Math.sin(s * 6 + st.phase) * U * 0.05
    const spread = (st.f - 0.5) * U * 0.5
    g.strokeStyle = st.color
    g.lineWidth = Math.max(2, U * 0.05)
    g.beginPath()
    g.moveTo(wx, wy)
    g.quadraticCurveTo(wx + dx * L * 0.5 + spread * 0.5 + lag * 0.4, wy + dy * L * 0.5, wx + dx * L + spread + lag, wy + dy * L)
    g.stroke()
  }
  // Waistband with flowers.
  g.strokeStyle = "#7A5A22"
  g.lineWidth = U * 0.12
  g.beginPath()
  g.moveTo(hip.x - ux * hip.w * 0.65, hip.y - uy * hip.w * 0.65 + U * 0.08)
  g.lineTo(hip.x + ux * hip.w * 0.65, hip.y + uy * hip.w * 0.65 + U * 0.08)
  g.stroke()
  for (let i = 0; i < 3; i++) {
    g.fillStyle = LEI[i]
    g.beginPath()
    g.arc(hip.x + ux * (i - 1) * hip.w * 0.4, hip.y + uy * (i - 1) * hip.w * 0.4 + U * 0.08, U * 0.09, 0, Math.PI * 2)
    g.fill()
  }
  g.restore()
}

// ── The effect ────────────────────────────────────────────────────────────────

export function hula(ctx: Ctx): boolean {
  const dancers = pickBlocks(PART_COUNT + HAIR_COUNT)
  if (dancers.length < 6) return false
  const { W, H } = ctx

  const { rects, copies } = liftOut(ctx, dancers)
  const from: Limb[] = rects.map((r) => ({ x: r.left, y: r.top + r.height / 2, a: 0, len: r.width, th: r.height, round: 4 }))
  copies.forEach((c, i) => place(c, from[i]))
  if (copies[1]) copies[1].style.zIndex = "9986" // the head sits over the neck
  // Hair: dyed dark brown, behind everything else.
  copies.slice(PART_COUNT).forEach((c) => {
    c.style.zIndex = "9983"
    c.style.background = "linear-gradient(90deg, #3A2214, #5A3520 50%, #3A2214)"
    c.style.filter = "saturate(.6)"
    c.style.border = "none"
    c.style.boxShadow = "none"
  })
  const { g } = canvasLayer(ctx, 9987)

  // Music notes drifting off the dancer.
  const noteTimer = setInterval(() => {
    const n = el(ctx, "div", {
      position: "fixed", left: `${W / 2 + (Math.random() - 0.3) * W * 0.25}px`, top: `${H * 0.2}px`,
      fontSize: `${22 + Math.random() * 14}px`, color: "var(--color-navy)", zIndex: "9988",
      pointerEvents: "none", animation: "fx-note 1.8s ease-out forwards",
    })
    n.textContent = Math.random() < 0.5 ? "♪" : "♫"
    setTimeout(() => n.remove(), 1900)
  }, 550)
  ctx.onCleanup(() => clearInterval(noteTimer))
  ukulele(ctx)

  const IN = 1300, DANCE_END = 8300, OUT = 1300
  let prevHip = W / 2
  ctx.loop((t) => {
    const s = t / 1000
    const live = pose(s, W, H)
    let k = 1
    let target = live
    if (t < IN) k = ease(phase(t, 0, IN))
    else if (t > DANCE_END) {
      target = pose(DANCE_END / 1000, W, H)
      k = 1 - ease(phase(t, DANCE_END, DANCE_END + OUT))
    }
    copies.forEach((c, i) => {
      const to = target.limbs[i]
      const f = from[i]
      place(c, {
        x: lerp(f.x, to.x, k), y: lerp(f.y, to.y, k), a: lerpAngle(f.a, to.a, k),
        len: lerp(f.len, to.len, k), th: lerp(f.th, to.th, k), round: lerp(f.round, to.round, k),
      })
    })
    g.clearRect(0, 0, W, H)
    const hipVel = target.hip.x - prevHip
    prevHip = target.hip.x
    // Costume fades in once she's assembled, and out before she comes apart.
    decorate(g, target, s, hipVel, copies.length >= 6 ? Math.min(phase(t, IN * 0.7, IN), 1 - phase(t, DANCE_END, DANCE_END + OUT * 0.4)) : 0)
    if (t >= DANCE_END + OUT) { ctx.stop(); return false }
  })
  return true
}

/** I–vi–IV–V on a ukulele, island strum. */
function ukulele(ctx: Ctx) {
  const s = ctx.sound
  if (!s.on) return
  const chords = [
    [392, 262, 330, 523], // C
    [440, 262, 330, 440], // Am
    [440, 262, 349, 440], // F
    [392, 294, 392, 494], // G
  ]
  const beat = 60 / 96
  const strums = [0, 1, 1.5, 2.5, 3, 3.5]
  for (let bar = 0; bar < 6; bar++) {
    const ch = chords[bar % 4]
    for (const b of strums) {
      const up = b % 1 !== 0
      const order = up ? [...ch].reverse() : ch
      order.forEach((f, i) => s.pluck(f, (bar * 4 + b) * beat + i * 0.014, up ? 0.14 : 0.2))
    }
    s.hat(bar * 4 * beat, 0.05)
  }
}
