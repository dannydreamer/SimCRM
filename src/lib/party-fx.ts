// 🎭 Party effects — a few seconds of nonsense, then the page exactly as it was.
// §6.9
//
// React owns the page's DOM, so nothing here restructures it. Psychedelic is
// a class on <html>; gravity paints letters on a canvas while the real text
// goes transparent; the dance flies *copies* of rows around and only toggles
// the originals' visibility. A transparent shield sits over everything while
// an effect runs, so nothing underneath can be clicked by accident; a click
// or Esc ends it early.

export type FxKind = "psychedelic" | "gravity" | "dance"

export const FX_LABELS: Record<FxKind | "random", string> = {
  random:      "אקראי",
  psychedelic: "פסיכדלי",
  gravity:     "כוח משיכה",
  dance:       "ריקוד",
}

let stopCurrent: (() => void) | null = null
let lastKind: FxKind | null = null

export function isFxRunning() {
  return stopCurrent !== null
}

export function runFx(kind: FxKind | "random") {
  if (typeof window === "undefined" || stopCurrent) return

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    gentle()
    return
  }

  let k: FxKind
  if (kind === "random") {
    const pool = (["psychedelic", "gravity", "dance"] as FxKind[]).filter((x) => x !== lastKind)
    k = pool[Math.floor(Math.random() * pool.length)]
  } else {
    k = kind
  }
  lastKind = k

  const cleanups: (() => void)[] = []
  let done = false
  const stop = () => {
    if (done) return
    done = true
    for (const c of cleanups.reverse()) c()
    stopCurrent = null
  }
  stopCurrent = stop

  cleanups.push(shield(stop))
  const run = k === "psychedelic" ? psychedelic : k === "gravity" ? gravity : dance
  if (!run(stop, (c) => cleanups.push(c))) {
    // Not enough on the page for this one — fall back to the one that always works.
    psychedelic(stop, (c) => cleanups.push(c))
  }
}

type OnCleanup = (fn: () => void) => void

// ─── Shared ──────────────────────────────────────────────────────────────────

function shield(stop: () => void): () => void {
  const el = document.createElement("div")
  el.className = "fx-keep"
  Object.assign(el.style, {
    position: "fixed", inset: "0", zIndex: "9990", cursor: "pointer", background: "transparent",
  })
  const hint = document.createElement("div")
  hint.className = "fx-keep"
  hint.textContent = "לחיצה או Esc לעצירה"
  Object.assign(hint.style, {
    position: "fixed", bottom: "14px", left: "50%", transform: "translateX(-50%)",
    background: "rgba(17,24,39,.75)", color: "#fff", fontSize: "12px",
    padding: "4px 12px", borderRadius: "9999px", zIndex: "9999", pointerEvents: "none",
  })
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") stop() }
  el.addEventListener("click", stop)
  document.addEventListener("keydown", onKey)
  document.body.append(el, hint)
  return () => {
    el.remove()
    hint.remove()
    document.removeEventListener("keydown", onKey)
  }
}

function later(ms: number, fn: () => void, onCleanup: OnCleanup) {
  const t = setTimeout(fn, ms)
  onCleanup(() => clearTimeout(t))
}

function loop(fn: (t: number) => boolean, onCleanup: OnCleanup) {
  let id = 0
  const start = performance.now()
  const tick = (now: number) => {
    if (fn(now - start)) id = requestAnimationFrame(tick)
  }
  id = requestAnimationFrame(tick)
  onCleanup(() => cancelAnimationFrame(id))
}

const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

function inViewport(r: DOMRect) {
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 &&
    r.top < window.innerHeight && r.left < window.innerWidth
}

function gentle() {
  const html = document.documentElement
  html.classList.add("fx-gentle")
  setTimeout(() => html.classList.remove("fx-gentle"), 1900)
}

// ─── Psychedelic ─────────────────────────────────────────────────────────────

function psychedelic(stop: () => void, onCleanup: OnCleanup): boolean {
  const html = document.documentElement
  html.classList.add("fx-psy")
  onCleanup(() => html.classList.remove("fx-psy"))
  later(7000, stop, onCleanup)
  return true
}

// ─── Gravity ─────────────────────────────────────────────────────────────────

interface Glyph {
  ch: string; font: string; color: string
  ox: number; oy: number; w: number; h: number   // where it lives (centre)
  x: number; y: number; vx: number; vy: number
  rot: number; vr: number
  delay: number; bounced: boolean; resting: boolean; slides: number
}

const MAX_GLYPHS = 3500

function collectGlyphs(): Glyph[] {
  const glyphs: Glyph[] = []
  const styleCache = new Map<Element, { font: string; color: string } | null>()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      const p = n.parentElement
      if (!p || !n.nodeValue?.trim()) return NodeFilter.FILTER_REJECT
      if (p.closest("script, style, noscript, .fx-keep")) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })
  const range = document.createRange()
  for (let n = walker.nextNode(); n && glyphs.length < MAX_GLYPHS; n = walker.nextNode()) {
    const el = n.parentElement!
    let st = styleCache.get(el)
    if (st === undefined) {
      const cs = getComputedStyle(el)
      st = cs.visibility === "hidden" || cs.opacity === "0" ? null : {
        font: `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`,
        color: cs.color,
      }
      styleCache.set(el, st)
    }
    if (!st) continue
    const text = n.nodeValue!
    let i = 0
    for (const ch of text) {               // by code point, so emoji stay whole
      const len = ch.length
      if (ch.trim()) {
        range.setStart(n, i)
        range.setEnd(n, i + len)
        const r = range.getBoundingClientRect()
        if (inViewport(r)) {
          const cx = r.left + r.width / 2
          const cy = r.top + r.height / 2
          glyphs.push({
            ch, font: st.font, color: st.color,
            ox: cx, oy: cy, w: r.width, h: r.height,
            x: cx, y: cy, vx: (Math.random() - 0.5) * 4, vy: 0,
            rot: 0, vr: (Math.random() - 0.5) * 0.25,
            // Lower lines go first, with plenty of jitter, so it crumbles
            // rather than dropping as one sheet.
            delay: (1 - cy / window.innerHeight) * 700 + Math.random() * 600,
            bounced: false, resting: false, slides: 0,
          })
        }
      }
      i += len
    }
  }
  return glyphs
}

function gravity(stop: () => void, onCleanup: OnCleanup): boolean {
  const glyphs = collectGlyphs()
  if (glyphs.length < 20) return false

  const W = window.innerWidth
  const H = window.innerHeight
  const dpr = window.devicePixelRatio || 1
  const canvas = document.createElement("canvas")
  canvas.className = "fx-keep"
  canvas.width = W * dpr
  canvas.height = H * dpr
  Object.assign(canvas.style, {
    position: "fixed", inset: "0", width: "100vw", height: "100vh",
    zIndex: "9980", pointerEvents: "none",
  })
  document.body.appendChild(canvas)
  onCleanup(() => canvas.remove())
  const ctx = canvas.getContext("2d")!
  ctx.scale(dpr, dpr)
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"

  const html = document.documentElement
  html.classList.add("fx-hide-text")
  onCleanup(() => html.classList.remove("fx-hide-text"))

  // A height map along the floor, so letters pile up instead of overlapping.
  const BUCKET = 4
  const floor = new Float32Array(Math.ceil(W / BUCKET) + 1).fill(H)
  const span = (x: number, w: number) => {
    const a = Math.max(0, Math.floor((x - w / 2) / BUCKET))
    const b = Math.min(floor.length - 1, Math.floor((x + w / 2) / BUCKET))
    return [a, b] as const
  }
  const topAt = (x: number, w: number) => {
    if (x - w / 2 < 0 || x + w / 2 > W) return -Infinity // the screen edge is a wall
    const [a, b] = span(x, w)
    let top = H
    for (let i = a; i <= b; i++) top = Math.min(top, floor[i])
    return top
  }

  const FALL_END = 3600
  const RETURN_START = 4300
  const RETURN_END = 5600
  let returnFrom: { x: number; y: number; rot: number }[] | null = null

  loop((t) => {
    ctx.clearRect(0, 0, W, H)
    if (t < RETURN_START) {
      for (const g of glyphs) {
        if (g.resting || t < g.delay || t > FALL_END + 400) continue
        g.vy += 0.55
        g.x = Math.max(g.w / 2, Math.min(W - g.w / 2, g.x + g.vx))
        g.y += g.vy
        g.rot += g.vr
        const top = topAt(g.x, g.w)
        if (g.y + g.h / 2 >= top) {
          g.y = top - g.h / 2
          // Like sand: a letter landing on a slope slides off it, so the text
          // spreads into dunes instead of standing in towers.
          const step = Math.max(g.w, 6)
          const left = topAt(g.x - step, g.w)
          const right = topAt(g.x + step, g.w)
          const lower = Math.max(left, right)
          if (lower - top > g.h * 0.4 && g.slides < 60) {
            g.slides++
            g.x += left > right ? -step : step
            g.vy = 1
            continue
          }
          if (!g.bounced && g.vy > 5) {
            g.bounced = true
            g.vy = -g.vy * 0.3
            g.vx *= 0.6
          } else {
            g.resting = true
            // Letters nest into the pile rather than stacking at full height.
            const settle = top - g.h * 0.45
            const [a, b] = span(g.x, g.w)
            for (let i = a; i <= b; i++) floor[i] = Math.min(floor[i], settle)
          }
        }
      }
    } else {
      returnFrom ??= glyphs.map((g) => ({ x: g.x, y: g.y, rot: g.rot }))
      const p = ease(clamp01((t - RETURN_START) / (RETURN_END - RETURN_START)))
      glyphs.forEach((g, i) => {
        const f = returnFrom![i]
        g.x = lerp(f.x, g.ox, p)
        g.y = lerp(f.y, g.oy, p)
        g.rot = lerp(f.rot, 0, p)
      })
    }
    for (const g of glyphs) {
      ctx.save()
      ctx.translate(g.x, g.y)
      if (g.rot) ctx.rotate(g.rot)
      ctx.font = g.font
      ctx.fillStyle = g.color
      ctx.fillText(g.ch, 0, 0)
      ctx.restore()
    }
    if (t >= RETURN_END) { stop(); return false }
    return true
  }, onCleanup)
  return true
}

// ─── Dance ───────────────────────────────────────────────────────────────────

interface Limb { x: number; y: number; a: number; len: number; th: number; round: number }

const PART_COUNT = 10 // torso, head, 2×thigh, 2×upper arm, 2×shin, 2×forearm

function pickDancers(): HTMLElement[] {
  const main = document.querySelector("main")
  if (!main) return []
  const ok = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    return inViewport(r) && r.width > 40 && r.height > 14 && r.top >= 0 && r.bottom <= window.innerHeight
  }
  const picked: HTMLElement[] = []
  const add = (sel: string) => {
    for (const el of main.querySelectorAll<HTMLElement>(sel)) {
      if (picked.length >= PART_COUNT) return
      if (!ok(el) || picked.some((p) => p.contains(el) || el.contains(p))) continue
      picked.push(el)
    }
  }
  add("tbody tr")
  add("thead tr, li, h1, h2, h3, button, a, p, input, select, label")
  return picked
}

/** A stand-in for `el` that keeps its look: rows keep their column widths. */
function copyOf(el: HTMLElement, r: DOMRect): HTMLElement {
  const inner = el.cloneNode(true) as HTMLElement
  inner.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"))
  inner.removeAttribute("id")
  let content: HTMLElement = inner
  if (el.tagName === "TR") {
    const cells = el.children
    Array.from(inner.children).forEach((c, i) => {
      (c as HTMLElement).style.width = `${(cells[i] as HTMLElement).getBoundingClientRect().width}px`
    })
    const table = document.createElement("table")
    table.style.cssText = `width:${r.width}px;table-layout:fixed;border-collapse:collapse;`
    const tbody = document.createElement("tbody")
    tbody.appendChild(inner)
    table.appendChild(tbody)
    content = table
  }
  content.style.width = `${r.width}px`
  content.style.height = `${r.height}px`
  content.style.margin = "0"
  content.style.flexShrink = "0"

  const cs = getComputedStyle(el)
  const wrap = document.createElement("div")
  wrap.className = "fx-keep"
  wrap.dir = "rtl"
  const bg = cs.backgroundColor
  Object.assign(wrap.style, {
    position: "fixed", left: "0", top: "0", overflow: "hidden",
    display: "flex", alignItems: "center", justifyContent: "flex-start",
    background: bg && bg !== "rgba(0, 0, 0, 0)" ? bg : "#fff",
    font: cs.font, color: cs.color,
    border: "1px solid #d1d5db", boxShadow: "0 2px 8px rgba(0,0,0,.12)",
    transformOrigin: "0 0", zIndex: "9985", pointerEvents: "none",
    willChange: "transform, width, height",
  })
  wrap.appendChild(content)
  return wrap
}

function place(el: HTMLElement, l: Limb) {
  el.style.width = `${l.len}px`
  el.style.height = `${l.th}px`
  el.style.borderRadius = `${l.round}px`
  el.style.transform = `translate(${l.x}px, ${l.y}px) rotate(${l.a}rad) translateY(${-l.th / 2}px)`
}

function lerpAngle(a: number, b: number, t: number) {
  let d = (b - a) % (2 * Math.PI)
  if (d > Math.PI) d -= 2 * Math.PI
  if (d < -Math.PI) d += 2 * Math.PI
  return a + d * t
}

/** The dancer at time `s` seconds — joints by forward kinematics. */
function pose(s: number, W: number, H: number): Limb[] {
  const U = Math.min(W / 7, H / 7.2)
  const T = U * 0.4
  const ph = s * Math.PI * 2 * 1.1                // ~132 bpm, a beat per half-cycle
  const beat = Math.abs(Math.sin(ph))
  const hipX = W / 2 + Math.sin(ph / 2) * U * 0.6
  const hipY = H * 0.56 - beat * U * 0.18
  const dir = (a: number) => [Math.cos(a), Math.sin(a)] as const
  const seg = (x: number, y: number, a: number, len: number, th = T): Limb => ({ x, y, a, len, th, round: th / 2 })
  const end = (l: Limb) => { const [dx, dy] = dir(l.a); return [l.x + dx * l.len, l.y + dy * l.len] as const }

  const torso = seg(hipX, hipY, -Math.PI / 2 + Math.sin(ph / 2) * 0.18, U * 2, T * 1.6)
  const [shX, shY] = end(torso)
  const mirror = (a: number) => Math.PI - a

  // Arms: one up, one down, swapping every bar — the disco point.
  const sw = Math.sin(ph / 2)
  const aR1 = -0.2 - 1.1 * sw
  const aL1 = mirror(-0.2 + 1.1 * sw)
  const upperR = seg(shX, shY, aR1, U * 1.15)
  const upperL = seg(shX, shY, aL1, U * 1.15)
  const [eRX, eRY] = end(upperR)
  const [eLX, eLY] = end(upperL)
  const foreR = seg(eRX, eRY, aR1 - 0.7 - 0.5 * beat, U * 1.05)
  const foreL = seg(eLX, eLY, aL1 + 0.7 + 0.5 * beat, U * 1.05)

  // Legs: knees pop on alternate beats.
  const kickR = Math.max(0, Math.sin(ph))
  const kickL = Math.max(0, -Math.sin(ph))
  const thighR = seg(hipX + U * 0.15, hipY, Math.PI / 2 - 0.3 - 0.5 * kickR, U * 1.35)
  const thighL = seg(hipX - U * 0.15, hipY, Math.PI / 2 + 0.3 + 0.5 * kickL, U * 1.35)
  const [kRX, kRY] = end(thighR)
  const [kLX, kLY] = end(thighL)
  const shinR = seg(kRX, kRY, Math.PI / 2 + 0.1 + 0.6 * kickR, U * 1.3)
  const shinL = seg(kLX, kLY, Math.PI / 2 - 0.1 - 0.6 * kickL, U * 1.3)

  const d = U * 1.15
  const [tx, ty] = dir(torso.a)
  const hcX = shX + tx * (d / 2 + U * 0.12)
  const hcY = shY + ty * (d / 2 + U * 0.12)
  const tilt = Math.sin(ph) * 0.25
  // The head is a "limb" whose start sits on its left edge, so it rotates about
  // its own centre once translated back by half its size.
  const head: Limb = {
    x: hcX - Math.cos(tilt) * d / 2, y: hcY - Math.sin(tilt) * d / 2,
    a: tilt, len: d, th: d, round: d / 2,
  }

  // Most important first: a page with only six usable rows still gets a body,
  // a head, legs and arms, and goes without the lower segments.
  return [torso, head, thighR, thighL, upperR, upperL, shinR, shinL, foreR, foreL]
}

function dance(stop: () => void, onCleanup: OnCleanup): boolean {
  const dancers = pickDancers()
  if (dancers.length < 6) return false

  const W = window.innerWidth
  const H = window.innerHeight
  const rects = dancers.map((d) => d.getBoundingClientRect())
  const copies = dancers.map((d, i) => copyOf(d, rects[i]))
  const from: Limb[] = rects.map((r) => ({ x: r.left, y: r.top + r.height / 2, a: 0, len: r.width, th: r.height, round: 4 }))

  const hidden = dancers.map((d) => d.style.visibility)
  dancers.forEach((d) => { d.style.visibility = "hidden" })
  onCleanup(() => dancers.forEach((d, i) => { d.style.visibility = hidden[i] }))

  copies.forEach((c, i) => { place(c, from[i]); document.body.appendChild(c) })
  if (copies[1]) copies[1].style.zIndex = "9986" // the head sits over the neck
  onCleanup(() => copies.forEach((c) => c.remove()))

  // Music notes drifting off the dancer.
  const notes: HTMLElement[] = []
  const noteTimer = setInterval(() => {
    const n = document.createElement("div")
    n.className = "fx-keep"
    n.textContent = Math.random() < 0.5 ? "♪" : "♫"
    Object.assign(n.style, {
      position: "fixed", left: `${W / 2 + (Math.random() - 0.3) * W * 0.25}px`, top: `${H * 0.2}px`,
      fontSize: `${22 + Math.random() * 14}px`, color: "var(--color-navy)", zIndex: "9986",
      pointerEvents: "none", animation: "fx-note 1.8s ease-out forwards",
    })
    document.body.appendChild(n)
    notes.push(n)
    setTimeout(() => n.remove(), 1900)
  }, 450)
  onCleanup(() => { clearInterval(noteTimer); notes.forEach((n) => n.remove()) })

  const IN = 1300, DANCE_END = 6800, OUT = 1300
  loop((t) => {
    const target = pose(t / 1000, W, H)
    let p = 1
    let backFrom: Limb[] | null = null
    if (t < IN) p = ease(clamp01(t / IN))
    else if (t > DANCE_END) {
      backFrom = pose(DANCE_END / 1000, W, H)
      p = 1 - ease(clamp01((t - DANCE_END) / OUT))
    }
    copies.forEach((c, i) => {
      const to = (backFrom ?? target)[i]
      const f = from[i]
      place(c, {
        x: lerp(f.x, to.x, p), y: lerp(f.y, to.y, p),
        a: lerpAngle(f.a, to.a, p),
        len: lerp(f.len, to.len, p), th: lerp(f.th, to.th, p),
        round: lerp(f.round, to.round, p),
      })
    })
    if (t >= DANCE_END + OUT) { stop(); return false }
    return true
  }, onCleanup)
  return true
}
