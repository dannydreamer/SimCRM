import { type Ctx, el, ease, lerp, phase, pickBlocks, rand, setStyle } from "../core"

// Red velvet curtains close over the page, a spotlight sweeps across them and
// "ההצגה מתחילה" appears; they open, the rows take a bow one after another to
// applause, and roses land on the stage.

const VELVET = `
  linear-gradient(180deg, rgba(0,0,0,.25), rgba(0,0,0,0) 30%, rgba(0,0,0,.35)),
  repeating-linear-gradient(90deg, #6d0b16 0px, #a3162a 22px, #c21f35 34px, #8b1020 52px, #6d0b16 70px)`

export function curtain(ctx: Ctx): boolean {
  const { W, H, sound } = ctx
  const left = el(ctx, "div", {
    position: "fixed", top: "0", left: "0", width: "52vw", height: "100vh", zIndex: "9975",
    background: VELVET, transformOrigin: "0 0", transform: "scaleX(0)", boxShadow: "8px 0 30px rgba(0,0,0,.5)",
  })
  const right = el(ctx, "div", {
    position: "fixed", top: "0", right: "0", width: "52vw", height: "100vh", zIndex: "9975",
    background: VELVET, transformOrigin: "100% 0", transform: "scaleX(0)", boxShadow: "-8px 0 30px rgba(0,0,0,.5)",
  })
  const valance = el(ctx, "div", {
    position: "fixed", top: "0", left: "0", right: "0", height: "56px", zIndex: "9977",
    background: `radial-gradient(circle at 30px -6px, #a3162a 0 34px, transparent 35px) 0 0/60px 64px repeat-x,
                 linear-gradient(#7a0e1b, #a3162a)`,
    borderBottom: "4px solid #d4a73a", transform: "translateY(-80px)",
  })

  const title = el(ctx, "div", {
    position: "fixed", inset: "0", display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: "9978", pointerEvents: "none", fontFamily: "'Frank Ruhl Libre', 'David', serif",
    fontSize: `${Math.min(84, W / 9)}px`, fontWeight: "700", color: "#F4D27A", direction: "rtl",
    textShadow: "0 2px 0 #7a5a12, 0 0 24px rgba(255,210,120,.6)", opacity: "0", letterSpacing: "2px",
  })
  title.textContent = "ההצגה מתחילה"

  // A spotlight: a dark veil with a moving hole in it.
  const spot = el(ctx, "div", { position: "fixed", inset: "0", zIndex: "9976", pointerEvents: "none", opacity: "0" })
  // On the curtains, light instead of shadow.
  const glow = el(ctx, "div", { position: "fixed", inset: "0", zIndex: "9977", pointerEvents: "none", opacity: "0", mixBlendMode: "screen" })

  const bowers = pickBlocks(14, { minWidth: 60 }).filter((e) => e.tagName === "TR" || /^H\d$/.test(e.tagName))
  const bowRects = bowers.map((b) => b.getBoundingClientRect())
  const BOW_START = 5200
  const BOW_GAP = 160

  // ── Sound ──
  sound.whoosh(0, 1.3, false, 0.2)
  if (sound.on) {
    // Drumroll, crescendo, then a cymbal as the curtains part.
    for (let i = 0; i < 60; i++) sound.noise(1.6 + i * 0.033, 0.05, { filter: "bandpass", freq: 220, q: 0.6, vol: 0.05 + (i / 60) * 0.3 })
    sound.kick(3.6)
    sound.noise(3.6, 2.2, { filter: "highpass", freq: 5000, vol: 0.25, release: 2 })
    // Applause: many hands, rising and falling.
    for (let i = 0; i < 160; i++) {
      const at = 5.1 + Math.random() * 3.6
      const env = Math.sin(((at - 5.1) / 3.6) * Math.PI)
      sound.clap(at, 0.05 + env * 0.25)
    }
  }

  const roses: { e: HTMLElement; x0: number; vx: number; vy: number; born: number; rot: number }[] = []
  let roseCount = 0

  ctx.loop((t) => {
    // Curtains: close, hold, open into bunches at the sides, then away.
    let c = 0
    if (t < 1400) c = ease(phase(t, 0, 1400))
    else if (t < 3600) c = 1
    else if (t < 5000) c = lerp(1, 0.16, ease(phase(t, 3600, 5000)))
    else if (t < 8600) c = 0.16
    else c = lerp(0.16, 0, ease(phase(t, 8600, 9400)))
    const sway = t < 1600 ? Math.sin(t / 120) * 0.006 * (1 - phase(t, 1100, 1600)) : 0
    left.style.transform = `scaleX(${c + sway})`
    right.style.transform = `scaleX(${c - sway})`
    valance.style.transform = `translateY(${t < 600 ? lerp(-80, 0, ease(t / 600)) : t > 8800 ? lerp(0, -80, ease(phase(t, 8800, 9400))) : 0}px)`

    // Title under a sweeping light while the curtains are shut.
    title.style.opacity = String(phase(t, 1900, 2500) * (1 - phase(t, 3400, 3700)))
    const sweepX = W * (0.15 + 0.7 * ease(phase(t, 1500, 3300)))
    glow.style.opacity = String(phase(t, 1400, 1800) * (1 - phase(t, 3500, 3800)))
    glow.style.background = `radial-gradient(circle at ${sweepX}px ${H * 0.5}px, rgba(255,230,170,.55) 0, rgba(255,230,170,0) ${Math.min(W, H) * 0.3}px)`

    // On stage: the spotlight follows the row taking its bow.
    if (t > 3600) {
      const i = Math.min(bowers.length - 1, Math.max(0, Math.floor((t - BOW_START) / BOW_GAP)))
      const r = bowRects[i]
      const sx = r ? r.left + r.width / 2 : W / 2
      const sy = r ? r.top + r.height / 2 : H / 2
      spot.style.opacity = String(phase(t, 3700, 4600) * (1 - phase(t, 8400, 9200)) * 0.85)
      spot.style.background = `radial-gradient(ellipse ${Math.min(W * 0.45, 520)}px 170px at ${sx}px ${sy}px, rgba(0,0,0,0) 0, rgba(0,0,0,0) 45%, rgba(0,0,0,.72) 100%)`
    }

    // Roses thrown from the front rows.
    if (t > 5400 && t < 7800 && roseCount < 9 && Math.random() < 0.05) {
      roseCount++
      const fromLeft = Math.random() < 0.5
      const e = el(ctx, "div", { position: "fixed", left: "0", top: "0", fontSize: "30px", zIndex: "9979", pointerEvents: "none" })
      e.textContent = "🌹"
      roses.push({ e, x0: fromLeft ? -30 : W + 30, vx: (fromLeft ? 1 : -1) * rand(4, 9), vy: rand(-17, -12), born: t, rot: rand(-0.3, 0.3) })
    }
    for (const r of roses) {
      const s = (t - r.born) / 16
      const floor = H - 40
      const x = r.x0 + r.vx * s
      const y = Math.min(floor, H + r.vy * s + 0.25 * s * s)
      r.e.style.transform = `translate(${x}px, ${y}px) rotate(${y >= floor ? 1.4 : r.rot * s}rad)`
      r.e.style.opacity = String(1 - phase(t, 8600, 9200))
    }

    if (t >= 9500) { ctx.stop(); return false }
  })

  // The bows themselves are CSS, staggered per row.
  ctx.later(BOW_START, () => {
    bowers.forEach((b, i) => setStyle(ctx, b, {
      animation: `fx-bow 1.1s ease-in-out ${i * (BOW_GAP / 1000)}s both`, transformOrigin: "50% 100%",
    }))
  })
  return true
}
