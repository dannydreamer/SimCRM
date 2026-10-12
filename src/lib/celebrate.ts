// A one-off burst of confetti and a short message, drawn on a throwaway
// canvas that removes itself. Display-only — it never touches status. §6.9

const PALETTE = ["#31AA59", "#86C9BB", "#F9CFCC", "#0B8390", "#F4C542", "#FFFFFF"]

export function celebrate(message?: string) {
  if (typeof window === "undefined") return
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  if (message) showToast(message)
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
