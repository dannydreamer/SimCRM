import { type Ctx, canvasLayer, ease, lerp, phase, rand } from "../core"

// The screen fills with water from the bottom up. The page floats and sways,
// fish and bubbles drift through, seaweed waves on the sand — then it drains.

interface Fish { y: number; speed: number; dir: number; size: number; body: string; fin: string; stripes: boolean; born: number; phase: number }

const FISH_COLORS: [string, string, boolean][] = [
  ["#FF8C1A", "#FFFFFF", true],     // clownfish
  ["#3BA7F5", "#1A5FA8", false],
  ["#FFD23F", "#E8A400", false],
  ["#B05CE8", "#7A2DB8", false],
  ["#FF5C7A", "#C2304C", false],
  ["#2EC4B6", "#1A8077", false],
]

function drawFish(g: CanvasRenderingContext2D, x: number, y: number, f: Fish, t: number) {
  g.save()
  g.translate(x, y)
  g.scale(f.dir * f.size, f.size)
  const wag = Math.sin(t / 110 + f.phase) * 0.35
  // tail
  g.fillStyle = f.fin
  g.save()
  g.translate(-16, 0)
  g.rotate(wag)
  g.beginPath(); g.moveTo(2, 0); g.lineTo(-12, -9); g.lineTo(-9, 0); g.lineTo(-12, 9); g.closePath(); g.fill()
  g.restore()
  // body
  g.fillStyle = f.body
  g.beginPath(); g.ellipse(0, 0, 18, 10, 0, 0, Math.PI * 2); g.fill()
  if (f.stripes) {
    g.fillStyle = f.fin
    for (const sx of [-6, 6]) { g.beginPath(); g.ellipse(sx, 0, 2.6, 9.5, 0, 0, Math.PI * 2); g.fill() }
  }
  // fin
  g.fillStyle = f.fin
  g.beginPath(); g.moveTo(-4, -9); g.quadraticCurveTo(2, -17 - wag * 4, 8, -8); g.closePath(); g.fill()
  // eye
  g.fillStyle = "#fff"
  g.beginPath(); g.arc(10, -2, 3.2, 0, Math.PI * 2); g.fill()
  g.fillStyle = "#111"
  g.beginPath(); g.arc(11, -2, 1.7, 0, Math.PI * 2); g.fill()
  g.restore()
}

export function aquarium(ctx: Ctx): boolean {
  const { W, H, sound } = ctx
  const { g } = canvasLayer(ctx, 9982)

  const FILL = 2600, DRAIN = 8600, END = 10400
  const levelAt = (t: number) => t < DRAIN
    ? lerp(H + 10, H * 0.06, ease(phase(t, 0, FILL)))
    : lerp(H * 0.06, H + 30, ease(phase(t, DRAIN, END - 200)))

  // The page floats once the water is up. Rows, headings and cards, each on
  // its own beat.
  const floaters = Array.from(document.querySelectorAll<HTMLElement>("main tbody tr, main h1, main h2, main .rounded-xl, main button"))
    .filter((e) => { const r = e.getBoundingClientRect(); return r.bottom > 0 && r.top < H })
    .slice(0, 40)
  const saved = floaters.map((e) => e.getAttribute("style"))
  let floating = false
  const restore = () => {
    if (!floating) return
    floating = false
    floaters.forEach((e, i) => { if (saved[i] === null) e.removeAttribute("style"); else e.setAttribute("style", saved[i]!) })
  }
  ctx.onCleanup(restore)
  ctx.later(1400, () => {
    floating = true
    floaters.forEach((e) => {
      e.style.animation = `fx-float ${rand(2.6, 3.8).toFixed(2)}s ease-in-out ${(-rand(0, 3)).toFixed(2)}s infinite`
    })
  })
  ctx.later(DRAIN + 900, restore)

  const fish: Fish[] = []
  for (let i = 0; i < 8; i++) {
    const [body, fin, stripes] = FISH_COLORS[i % FISH_COLORS.length]
    fish.push({
      y: rand(H * 0.2, H * 0.85), speed: rand(0.06, 0.14), dir: Math.random() < 0.5 ? 1 : -1,
      size: rand(0.9, 1.6), body, fin, stripes, born: 1500 + i * 700, phase: rand(0, 6),
    })
  }
  const bubbles: { x: number; y: number; r: number; v: number; ph: number }[] = []
  const weeds = Array.from({ length: 9 }, (_, i) => ({ x: (i + 0.5) * (W / 9) + rand(-30, 30), h: rand(H * 0.12, H * 0.28), ph: rand(0, 6) }))

  if (sound.on) {
    sound.noise(0, 2.6, { filter: "lowpass", freq: 300, freqTo: 900, vol: 0.25, attack: 0.3, release: 0.6 })
    sound.noise(2.4, 6.2, { filter: "lowpass", freq: 350, vol: 0.08, attack: 1, release: 1 })
    for (let i = 0; i < 26; i++) sound.tone(rand(220, 420), 1.5 + Math.random() * 7, 0.09, { type: "sine", vol: 0.12, slideTo: rand(700, 1100) })
    sound.noise(DRAIN / 1000, 1.8, { filter: "lowpass", freq: 900, freqTo: 120, vol: 0.3, release: 1.2 })
    for (let i = 0; i < 10; i++) sound.tone(rand(150, 260), DRAIN / 1000 + i * 0.15, 0.1, { type: "sine", vol: 0.15, slideTo: rand(400, 600) })
  }

  ctx.loop((t, dt) => {
    g.clearRect(0, 0, W, H)
    const level = levelAt(t)
    if (level >= H + 5) { if (t > DRAIN) { ctx.stop(); return false } return }

    // Water body with a moving surface.
    const surface = (x: number) => level + Math.sin(x / 90 + t / 400) * 6 + Math.sin(x / 37 - t / 260) * 3
    g.beginPath()
    g.moveTo(0, H)
    for (let x = 0; x <= W; x += 12) g.lineTo(x, surface(x))
    g.lineTo(W, H)
    g.closePath()
    const wg = g.createLinearGradient(0, level, 0, H)
    wg.addColorStop(0, "rgba(120,200,255,.28)")
    wg.addColorStop(1, "rgba(20,90,170,.45)")
    g.fillStyle = wg
    g.fill()
    g.strokeStyle = "rgba(255,255,255,.75)"
    g.lineWidth = 2
    g.beginPath()
    for (let x = 0; x <= W; x += 12) {
      if (x) g.lineTo(x, surface(x))
      else g.moveTo(x, surface(x))
    }
    g.stroke()

    // Light rays from the surface.
    g.save()
    g.globalAlpha = 0.08
    g.fillStyle = "#fff"
    for (let i = 0; i < 4; i++) {
      const x = W * (0.15 + i * 0.25) + Math.sin(t / 1500 + i) * 40
      g.beginPath(); g.moveTo(x, level); g.lineTo(x + 60, level); g.lineTo(x - 80, H); g.lineTo(x - 180, H); g.closePath(); g.fill()
    }
    g.restore()

    // Sand and seaweed.
    g.fillStyle = "rgba(230,205,150,.8)"
    g.beginPath()
    g.moveTo(0, H)
    for (let x = 0; x <= W; x += 20) g.lineTo(x, H - 14 - Math.sin(x / 60) * 4)
    g.lineTo(W, H)
    g.fill()
    g.lineCap = "round"
    for (const w of weeds) {
      const sw = Math.sin(t / 700 + w.ph) * 26
      const top = Math.max(level + 10, H - w.h)
      if (top >= H - 14) continue
      g.strokeStyle = "rgba(40,150,80,.85)"
      g.lineWidth = 7
      g.beginPath()
      g.moveTo(w.x, H - 10)
      g.quadraticCurveTo(w.x + sw, (H + top) / 2, w.x - sw * 0.5, top)
      g.stroke()
    }

    // Bubbles.
    if (t < DRAIN && Math.random() < 0.25) bubbles.push({ x: rand(0, W), y: H, r: rand(2, 7), v: rand(0.8, 2), ph: rand(0, 6) })
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i]
      b.y -= b.v * dt / 16
      const bx = b.x + Math.sin(b.y / 30 + b.ph) * 4
      if (b.y < surface(bx)) { bubbles.splice(i, 1); continue }
      g.strokeStyle = "rgba(255,255,255,.85)"
      g.lineWidth = 1.3
      g.beginPath(); g.arc(bx, b.y, b.r, 0, Math.PI * 2); g.stroke()
      g.fillStyle = "rgba(255,255,255,.6)"
      g.beginPath(); g.arc(bx - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.25, 0, Math.PI * 2); g.fill()
    }

    // Fish swim across while there's water to swim in.
    for (const f of fish) {
      if (t < f.born) continue
      const travel = (t - f.born) * f.speed
      const x = f.dir > 0 ? -60 + travel : W + 60 - travel
      const y = Math.max(level + 20 * f.size, f.y + Math.sin(t / 600 + f.phase) * 14)
      if (y > H - 20) continue
      drawFish(g, x, y, f, t)
    }
  })
  return true
}
