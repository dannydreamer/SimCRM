// A one-off burst of confetti and a short message, drawn on a throwaway
// canvas that removes itself, with a trumpet fanfare when the 🎭 menu's sound
// is on. Display-only — it never touches status. §6.9

import { Sound, isSoundOn, note } from "./fx/sound"

const PALETTE = ["#31AA59", "#86C9BB", "#F9CFCC", "#0B8390", "#F4C542", "#FFFFFF"]

export function celebrate(message?: string) {
  if (typeof window === "undefined") return
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  if (message) showToast(message)
  fanfare()
  if (reduced) return

  const canvas = document.createElement("canvas")
  const dpr = window.devicePixelRatio || 1
  const W = window.innerWidth
  const H = window.innerHeight
  canvas.width = W * dpr
  canvas.height = H * dpr
  Object.assign(canvas.style, {
    position: "fixed", inset: "0", width: "100vw", height: "100vh",
    pointerEvents: "none", zIndex: "9999",
  })
  document.body.appendChild(canvas)
  const ctx = canvas.getContext("2d")!
  ctx.scale(dpr, dpr)

  const navy = getComputedStyle(document.documentElement).getPropertyValue("--color-navy").trim() || "#2C4B9A"
  const colors = [navy, navy, ...PALETTE]

  // Two cannons from the bottom corners, aimed up and inward.
  const pieces = Array.from({ length: 160 }, (_, i) => {
    const left = i % 2 === 0
    const angle = (left ? -60 : -120) * (Math.PI / 180) + (Math.random() - 0.5) * 0.7
    const speed = 11 + Math.random() * 9
    return {
      x: left ? 0 : W, y: H,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      w: 6 + Math.random() * 6, h: 3 + Math.random() * 4,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      color: colors[Math.floor(Math.random() * colors.length)],
    }
  })

  const start = performance.now()
  const DURATION = 3200
  function frame(now: number) {
    const t = now - start
    ctx.clearRect(0, 0, W, H)
    ctx.globalAlpha = t > DURATION - 600 ? Math.max(0, (DURATION - t) / 600) : 1
    for (const p of pieces) {
      p.vy += 0.28
      p.vx *= 0.99
      p.vy *= 0.99
      p.x += p.vx
      p.y += p.vy
      p.rot += p.vr
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.scale(1, Math.cos(p.rot * 3)) // the flutter
      ctx.fillStyle = p.color
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      ctx.restore()
    }
    if (t < DURATION) requestAnimationFrame(frame)
    else canvas.remove()
  }
  requestAnimationFrame(frame)
}

function showToast(message: string) {
  const el = document.createElement("div")
  el.textContent = message
  el.setAttribute("role", "status")
  el.dir = "rtl"
  Object.assign(el.style, {
    position: "fixed", top: "84px", left: "50%", transform: "translate(-50%, -8px)",
    background: "var(--color-navy)", color: "#fff", padding: "10px 18px",
    borderRadius: "9999px", fontSize: "15px", fontWeight: "600",
    boxShadow: "0 6px 20px rgba(0,0,0,.15)", zIndex: "10000",
    opacity: "0", transition: "opacity .3s, transform .3s", pointerEvents: "none",
  })
  document.body.appendChild(el)
  requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = "translate(-50%, 0)" })
  setTimeout(() => { el.style.opacity = "0" }, 3000)
  setTimeout(() => el.remove(), 3400)
}

/** Ta-ta-ta-taaa, ta-ta-ta-taaaa — two brassy voices a third apart. */
function fanfare() {
  if (!isSoundOn()) return
  const s = new Sound(true)
  const brass = (semis: number, at: number, dur: number) => {
    const f = note(semis)
    s.tone(f, at, dur, { type: "sawtooth", vol: 0.22, attack: 0.03, release: Math.min(0.2, dur * 0.4) })
    s.tone(f, at, dur, { type: "square", vol: 0.08, attack: 0.03, detune: 6, release: Math.min(0.2, dur * 0.4) })
    s.tone(f * 2, at, dur, { type: "sine", vol: 0.06, attack: 0.04, release: Math.min(0.2, dur * 0.4) })
  }
  // [melody, harmony a third below, start, length] in semitones from A4
  const notes: [number, number, number, number][] = [
    [-2, -5, 0.00, 0.13], [-2, -5, 0.15, 0.13], [-2, -5, 0.30, 0.13], [3, -2, 0.45, 0.55],
    [-2, -5, 1.05, 0.13], [3, -2, 1.20, 0.13], [7, 3, 1.35, 0.13], [10, 7, 1.50, 1.1],
  ]
  for (const [m, h, at, dur] of notes) { brass(m, at, dur); brass(h, at, dur) }
  s.noise(1.5, 1.0, { filter: "highpass", freq: 6000, vol: 0.08, release: 0.9 })   // a cymbal under the last note
  setTimeout(() => s.dispose(), 3000)
}
