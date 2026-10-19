import { type Ctx, canvasLayer, collectGlyphs, el, hideText, phase, rand } from "../core"

// The page's letters drip into green digital rain, the screen greets whoever
// is signed in by name, and Morpheus offers two pills. Blue: the story ends
// and the page comes back. Red: the rain forms a spoon, which bends.

const KATAKANA = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ"
const HEBREW = "אבגדהוזחטיכלמנסעפצקרשת"
const DIGITS = "0123456789"
const GREEN = "#22FF55"
const BRIGHT = "#D8FFD8"
const MONO = "ui-monospace, 'Cascadia Mono', 'Courier New', monospace"


export function matrix(ctx: Ctx): boolean {
  const { W, H, sound } = ctx
  const name = ctx.userName || "there"
  // U+200E after the name: a Hebrew name would otherwise drag the trailing
  // dots to its left.
  const LINES = [`Hello ${name}\u200E...`, "Follow the white rabbit.", `Knock, knock, ${ctx.userName || "Neo"}\u200E.`]
  const page = collectGlyphs(2500)
  const { g } = canvasLayer(ctx, 9980)
  hideText(ctx)

  const pageChars = page.map((p) => p.ch).join("")
  const charset = KATAKANA + KATAKANA + HEBREW + DIGITS + pageChars.slice(0, 200)
  const rc = () => charset[Math.floor(Math.random() * charset.length)]

  // Rain columns.
  const COL = 15
  const cols = Math.ceil(W / COL)
  const drops = Array.from({ length: cols }, () => ({ y: rand(-H, 0), v: rand(0.6, 1.4) }))
  let rainOn = false
  let rainDensity = 1
  let fade = 0.06

  // The page's letters, dripping.
  const drips = page.map((p) => ({ p, y: p.y, v: 0, delay: Math.random() * 700 }))

  // Typed lines.
  let typing: { text: string; start: number; hold: number } | null = null
  let typedAt = -1

  let state: "intro" | "type" | "pills" | "blue" | "red" = "intro"
  let stateAt = 0
  let figure: ReturnType<typeof buildSpoon> | null = null
  let spoonAt = -1

  // Sound: a low hum under everything, blips in the rain.
  if (sound.on) {
    for (let i = 0; i < 9; i++) sound.tone(55, i * 2.4, 2.6, { type: "sawtooth", vol: 0.05, attack: 0.8, release: 0.8 })
  }

  // The schedule, as a list of [ms, action].
  const script: [number, () => void][] = []
  let at = 1200
  script.push([at, () => { rainOn = true }])
  at = 4200
  for (const line of LINES) {
    const start = at
    script.push([start, () => { state = "type"; typing = { text: line, start, hold: 900 } }])
    // Knock, knock: a knock on the door as each word types.
    if (line.startsWith("Knock")) {
      for (const i of [0, line.indexOf("knock")]) {
        const k = (start + i * 55) / 1000
        sound.tone(170, k, 0.09, { type: "sine", vol: 0.9, slideTo: 80, attack: 0.002 })
        sound.noise(k, 0.06, { filter: "lowpass", freq: 1200, vol: 0.5 })
        sound.tone(160, k + 0.17, 0.09, { type: "sine", vol: 0.8, slideTo: 75, attack: 0.002 })
        sound.noise(k + 0.17, 0.06, { filter: "lowpass", freq: 1100, vol: 0.45 })
      }
    }
    at += line.length * 55 + 1000
  }
  script.push([at, () => { typing = null; showPills(); state = "pills"; stateAt = at }])
  script.forEach(([ms, fn]) => ctx.later(ms, fn))

  function showPills() {
    rainDensity = 0.35
    if (sound.on) {
      sound.tone(110, 0, 3, { type: "sine", vol: 0.2, attack: 0.5 })
      sound.tone(164.8, 0, 3, { type: "sine", vol: 0.12, attack: 0.8 })
    }
    const box = el(ctx, "div", {
      position: "fixed", inset: "0", display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: "28px", zIndex: "9995", pointerEvents: "none",
      fontFamily: MONO, color: GREEN, direction: "rtl", opacity: "0", transition: "opacity .8s",
    }, ctx.shield)
    const q = el(ctx, "div", { fontSize: "20px", textShadow: `0 0 8px ${GREEN}`, textAlign: "center", padding: "0 16px" }, box)
    q.textContent = "זו ההזדמנות האחרונה. אחרי זה — אין דרך חזרה."
    const row = el(ctx, "div", { display: "flex", gap: "70px", alignItems: "flex-start" }, box)
    const make = (color: "blue" | "red") => {
      const col = el(ctx, "div", { display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", width: "240px" }, row)
      const handWrap = el(ctx, "div", { position: "relative", width: "195px", height: "156px" }, col)
      handWrap.innerHTML = HAND_SVG
      const pill = el(ctx, "button", {
        position: "absolute", left: "70px", top: "48px", width: "56px", height: "24px", borderRadius: "999px",
        border: "none", cursor: "pointer", pointerEvents: "auto", transform: `rotate(${color === "blue" ? -20 : 20}deg)`,
        background: color === "blue"
          ? "linear-gradient(180deg,#9cc8ff 0%,#2a6fdb 45%,#123c8a 100%)"
          : "linear-gradient(180deg,#ff9c9c 0%,#d92a2a 45%,#7a1010 100%)",
        boxShadow: `0 0 18px ${color === "blue" ? "#2a6fdb" : "#d92a2a"}`,
        transition: "transform .2s, box-shadow .2s",
      }, handWrap)
      pill.setAttribute("aria-label", color === "blue" ? "הגלולה הכחולה" : "הגלולה האדומה")
      pill.onmouseenter = () => { pill.style.transform += " scale(1.25)" }
      pill.onmouseleave = () => { pill.style.transform = `rotate(${color === "blue" ? -20 : 20}deg)` }
      pill.onclick = (e) => { e.stopPropagation(); choose(color, box) }
      const cap = el(ctx, "div", { fontSize: "14px", textAlign: "center", lineHeight: "1.5", opacity: "0.9" }, col)
      cap.textContent = color === "blue"
        ? "כחולה — הסיפור נגמר. מתעוררים מול המסך וחוזרים לעבודה."
        : "אדומה — נשארים בארץ הפלאות, ורואים עד כמה עמוקה מחילת הארנב."
    }
    // Morpheus's right hand (our left) holds the red pill, as in the film.
    make("blue")
    make("red")
    requestAnimationFrame(() => { box.style.opacity = "1" })
    ctx.later(16000, () => { if (state === "pills") choose("blue", box) })
  }

  function choose(c: "blue" | "red", box: HTMLElement) {
    if (state !== "pills") return
    box.style.opacity = "0"
    box.style.pointerEvents = "none"
    setTimeout(() => box.remove(), 800)
    state = c
    stateAt = performance.now() - t0
    if (c === "blue") {
      sound.tone(440, 0, 1.2, { type: "sine", vol: 0.2, slideTo: 220 })
    } else {
      rainDensity = 1.6
      sound.whoosh(0, 1.6, true, 0.3)
      sound.tone(80, 0, 1.8, { type: "sawtooth", vol: 0.12, slideTo: 320 })
      figure = buildSpoon(W, H)
      const fig = figure
      ctx.later(1500, () => {
        if (!sound.on) return
        for (let i = 0; i < 30; i++) sound.tone(rand(1500, 3500), i * 0.07, 0.06, { type: "sine", vol: 0.06 })
        // the bend: a slow, eerie glide
        sound.tone(220, (fig.decodeMs + 300) / 1000, BEND_MS / 1000, { type: "sine", vol: 0.15, slideTo: 110, attack: 0.4 })
        sound.tone(331, (fig.decodeMs + 300) / 1000, BEND_MS / 1000, { type: "triangle", vol: 0.06, slideTo: 140, attack: 0.4 })
      })
      ctx.later(1500 + fig.decodeMs + 300 + BEND_MS, () => { spoonAt = performance.now() - t0 })
    }
  }

  const t0 = performance.now()
  let lastBlip = 0
  ctx.loop((t) => {
    // Trails: each frame paints a thin veil of black over the last.
    const veil = state === "blue" ? 0.06 : fade
    g.fillStyle = `rgba(0,0,0,${veil})`
    g.fillRect(0, 0, W, H)
    if (t > 600) fade = 0.09

    // 1. The page drips.
    if (t < 3500) {
      for (const d of drips) {
        if (t < d.delay || d.y > H + 20) continue
        d.v += 0.25
        d.y += d.v
        g.font = `15px ${MONO}`
        g.fillStyle = Math.random() < 0.1 ? BRIGHT : GREEN
        g.textAlign = "center"
        g.textBaseline = "middle"
        g.fillText(Math.random() < 0.3 ? rc() : d.p.ch, d.p.x, d.y)
      }
    }

    // 2. Rain.
    const rainFade = state === "blue" ? 1 - phase(t - stateAt, 0, 1200) : 1
    if (rainOn && rainFade > 0) {
      g.font = `15px ${MONO}`
      g.textAlign = "center"
      g.textBaseline = "top"
      for (let i = 0; i < cols; i++) {
        if (Math.random() > rainDensity * rainFade) continue
        const d = drops[i]
        const y = d.y * 18
        g.fillStyle = BRIGHT
        g.fillText(rc(), i * COL + COL / 2, y)
        g.fillStyle = GREEN
        g.fillText(rc(), i * COL + COL / 2, y - 18)
        d.y += d.v * (state === "red" ? 1.6 : 1)
        if (y > H && Math.random() > 0.97) d.y = rand(-10, 0)
        if (y > H * 1.5) d.y = 0
      }
      if (sound.on && t - lastBlip > 120 && state !== "type") {
        lastBlip = t
        sound.tone(rand(900, 2400), 0, 0.03, { type: "square", vol: 0.025 })
      }
    }

    // 3. The typed lines.
    if (typing) {
      const tp = typing as { text: string; start: number; hold: number }
      const n = Math.min(tp.text.length, Math.floor((t - tp.start) / 55))
      if (n !== typedAt) { typedAt = n; if (n > 0 && n <= tp.text.length) sound.click(0, 0.12) }
      g.fillStyle = "rgba(0,0,0,0.85)"
      g.fillRect(W * 0.12, H * 0.42 - 30, W * 0.76, 60)
      g.font = `26px ${MONO}`
      g.textAlign = "left"
      g.direction = "ltr" // the page is RTL; English lines must not mirror
      g.textBaseline = "middle"
      g.fillStyle = GREEN
      g.shadowColor = GREEN
      g.shadowBlur = 8
      const shown = tp.text.slice(0, n)
      g.fillText(shown, W * 0.15, H * 0.42)
      if (Math.floor(t / 400) % 2 === 0) {
        const w = g.measureText(shown).width
        g.fillRect(W * 0.15 + w + 4, H * 0.42 - 13, 14, 26)
      }
      g.shadowBlur = 0
    }

    // 4. Red pill: a spoon decodes out of the rain, then bends.
    if (state === "red" && figure) {
      const ft = t - stateAt - 1500
      if (ft > 0) drawSpoon(g, figure, ft, rc)
      if (spoonAt > 0) {
        const s = "There is no spoon."
        const n = Math.min(s.length, Math.floor((t - spoonAt) / 70))
        g.font = `22px ${MONO}`
        g.textAlign = "center"
        g.direction = "ltr"
        g.fillStyle = GREEN
        g.shadowColor = GREEN
        g.shadowBlur = 10
        g.fillText(s.slice(0, n), W / 2, figure.bottom + 28)
        g.shadowBlur = 0
      }
      const END = figure.decodeMs + 300 + BEND_MS + 2800
      if (ft > END) {
        // Dissolve: the rain thins, then the canvas fades out.
        const k = phase(ft, END, END + 1400)
        g.canvas.style.opacity = String(1 - k)
        rainDensity = 1 - k
        if (k >= 1) { ctx.stop(); return false }
      }
    }

    // Blue pill: the rain stops and the page comes back.
    if (state === "blue") {
      const k = phase(t - stateAt, 600, 1600)
      g.canvas.style.opacity = String(1 - k)
      if (k >= 1) { ctx.stop(); return false }
    }
  })
  return true
}

// ─── The spoon: decoded out of the rain, then bent ───────────────────────────

const BEND_MS = 2600

interface Cell { x: number; y: number; u: number; v: number; lock: number; ch: string }

function buildSpoon(W: number, H: number) {
  const Hf = H * 0.66
  const cellH = Math.max(12, Math.round(Hf / 38))
  const cellW = Math.round(cellH * 0.62)
  const top = (H - Hf) / 2 - 30
  const cx = W / 2
  const cells: Cell[] = []
  const charset = KATAKANA + DIGITS
  const rows = Math.floor(Hf / cellH)
  // Wide enough for the bowl once it has bent over to the side.
  const half = Math.floor((Hf * 0.42) / cellW)
  for (let r = 0; r < rows; r++) {
    for (let c = -half; c <= half; c++) {
      cells.push({
        x: cx + c * cellW, y: top + r * cellH, u: (c * cellW) / Hf, v: (r * cellH) / Hf,
        lock: r * 40 + Math.random() * 450,
        ch: charset[Math.floor(Math.random() * charset.length)],
      })
    }
  }
  return { cells, cellH, decodeMs: rows * 40 + 450, bottom: top + rows * cellH }
}

const PIVOT_V = 0.5   // where the handle bends

/** The straight spoon: an oval bowl on top, a handle widening at its end. */
function spoonShape(u: number, v: number): "fill" | "rim" | null {
  const bowl = Math.hypot(u / 0.1, (v - 0.2) / 0.17)
  if (bowl < 1) {
    // a highlight down the hollow of the bowl
    if (Math.abs(u + 0.03) < 0.012 && Math.abs(v - 0.18) < 0.09) return "rim"
    return bowl > 0.86 ? "rim" : "fill"
  }
  const halfW = v < 0.42 ? 0.016 + (0.42 - v) * 0.2 : v > 0.82 ? 0.022 + (v - 0.82) * 0.25 : 0.02
  if (v >= 0.34 && v < 0.98 && Math.abs(u) < halfW) return Math.abs(u) > halfW - 0.008 || v > 0.965 ? "rim" : "fill"
  return null
}

/** The bent spoon at angle θ: everything above the pivot turns about it. */
function bentShape(u: number, v: number, theta: number) {
  if (v >= PIVOT_V) return spoonShape(u, v)
  // undo the turn to ask whether this point was on the upper part
  const dx = u, dy = v - PIVOT_V
  const c = Math.cos(-theta), s = Math.sin(-theta)
  const u0 = dx * c - dy * s
  const v0 = PIVOT_V + dx * s + dy * c
  return v0 < PIVOT_V ? spoonShape(u0, v0) : null
}

function drawSpoon(g: CanvasRenderingContext2D, sp: ReturnType<typeof buildSpoon>, ft: number, rc: () => string) {
  const bend = ease01((ft - sp.decodeMs - 300) / BEND_MS)
  const theta = bend * 1.25                     // about 70°, over to the right
  g.font = `${sp.cellH}px ${MONO}`
  g.textAlign = "center"
  g.textBaseline = "top"
  for (const c of sp.cells) {
    const kind = bentShape(c.u, c.v, theta)
    if (!kind) continue
    if (ft < c.lock) {
      if (Math.random() < 0.5) continue
      g.fillStyle = "rgba(34,255,85,0.35)"
      g.fillText(rc(), c.x, c.y)
      continue
    }
    if (Math.random() < 0.04) c.ch = rc()          // still alive, flickering
    g.fillStyle = kind === "rim" ? BRIGHT : GREEN
    if (kind === "rim") { g.shadowColor = GREEN; g.shadowBlur = 6 }
    g.fillText(c.ch, c.x, c.y)
    g.shadowBlur = 0
  }
}

const ease01 = (x: number) => { const k = Math.max(0, Math.min(1, x)); return k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2 }

/** An open hand, palm up, seen from in front — Morpheus offering. */
const HAND_SVG = `<svg viewBox="0 0 150 120" width="195" height="156" aria-hidden="true">
  <defs><linearGradient id="fx-skin" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#9a6a55"/><stop offset="1" stop-color="#5e3d30"/></linearGradient></defs>
  <path d="M30 118 L42 80 Q40 60 52 52 L58 30 Q61 22 66 30 L66 50 L72 24 Q75 16 80 24 L78 50 L86 27 Q90 20 94 28 L89 54 L99 38 Q104 32 107 40 L98 66 Q112 58 122 50 Q130 46 128 56 Q112 76 100 88 L104 118 Z"
    fill="url(#fx-skin)" stroke="#2b1a14" stroke-width="2" stroke-linejoin="round"/>
  <path d="M60 66 Q78 74 96 66" stroke="#3d2519" stroke-width="1.5" fill="none" opacity=".6"/>
  <rect x="24" y="108" width="86" height="14" rx="3" fill="#111" stroke="#22FF55" stroke-opacity=".4"/>
</svg>`
