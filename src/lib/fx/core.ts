// Shared machinery for the 🎭 party effects. §6.9
//
// React owns the page's DOM, so no effect restructures it. Effects draw on
// canvases, move *copies* of elements, set classes on <html>, or set inline
// style on an element React leaves unstyled — and every one of those is
// undone through onCleanup. A transparent shield covers the page while an
// effect runs; a click on it or Esc ends the effect at once.

import { Sound } from "./sound"

export interface Ctx {
  W: number
  H: number
  /** First name of whoever is signed in — the Matrix addresses them. */
  userName: string
  sound: Sound
  /** Fixed, full-viewport, above the page. Interactive children go here. */
  shield: HTMLElement
  stop(): void
  onCleanup(fn: () => void): void
  later(ms: number, fn: () => void): void
  /** Runs every frame with ms since start and since last frame, until it returns false. */
  loop(fn: (t: number, dt: number) => boolean | void): void
}

export function makeCtx(soundOn: boolean, userName: string, onDone: () => void): Ctx {
  const cleanups: (() => void)[] = []
  let done = false
  const sound = new Sound(soundOn)

  const shield = document.createElement("div")
  shield.className = "fx-keep"
  Object.assign(shield.style, {
    position: "fixed", inset: "0", zIndex: "9990", cursor: "pointer", background: "transparent",
  })
  const hint = document.createElement("div")
  hint.className = "fx-keep"
  hint.textContent = "לחיצה או Esc לעצירה"
  Object.assign(hint.style, {
    position: "fixed", bottom: "14px", left: "50%", transform: "translateX(-50%)",
    background: "rgba(17,24,39,.75)", color: "#fff", fontSize: "12px",
    padding: "4px 12px", borderRadius: "9999px", zIndex: "10001", pointerEvents: "none",
  })

  const ctx: Ctx = {
    W: window.innerWidth,
    H: window.innerHeight,
    userName,
    sound,
    shield,
    stop() {
      if (done) return
      done = true
      for (const c of cleanups.reverse()) {
        try { c() } catch { /* keep restoring the rest */ }
      }
      sound.dispose()
      onDone()
    },
    onCleanup(fn) { cleanups.push(fn) },
    later(ms, fn) {
      const id = setTimeout(() => { if (!done) fn() }, ms)
      cleanups.push(() => clearTimeout(id))
    },
    loop(fn) {
      let id = 0
      const start = performance.now()
      let last = start
      const tick = (now: number) => {
        if (done) return
        const dt = Math.min(50, now - last)
        last = now
        if (fn(now - start, dt) !== false) id = requestAnimationFrame(tick)
      }
      id = requestAnimationFrame(tick)
      cleanups.push(() => cancelAnimationFrame(id))
    },
  }

  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") ctx.stop() }
  shield.addEventListener("click", (e) => { if (e.target === shield) ctx.stop() })
  document.addEventListener("keydown", onKey)
  document.body.append(shield, hint)
  cleanups.push(() => {
    shield.remove()
    hint.remove()
    document.removeEventListener("keydown", onKey)
  })
  return ctx
}

// ─── Maths ────────────────────────────────────────────────────────────────────

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
export const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2)
export const easeIn = (x: number) => x * x * x
export const easeOut = (x: number) => 1 - (1 - x) ** 3
export const easeOutBack = (x: number) => 1 + 2.7 * (x - 1) ** 3 + 1.7 * (x - 1) ** 2
export const rand = (a: number, b: number) => a + Math.random() * (b - a)
export const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)]
/** 0→1 progress of t through [a, b]. */
export const phase = (t: number, a: number, b: number) => clamp01((t - a) / (b - a))

export function lerpAngle(a: number, b: number, t: number) {
  let d = (b - a) % (2 * Math.PI)
  if (d > Math.PI) d -= 2 * Math.PI
  if (d < -Math.PI) d += 2 * Math.PI
  return a + d * t
}

export function inViewport(r: DOMRect) {
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 &&
    r.top < window.innerHeight && r.left < window.innerWidth
}

// ─── Layers ───────────────────────────────────────────────────────────────────

export function el<K extends keyof HTMLElementTagNameMap>(
  ctx: Ctx, tag: K, style: Partial<CSSStyleDeclaration>, parent: HTMLElement = document.body,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  e.className = "fx-keep"
  Object.assign(e.style, style)
  parent.appendChild(e)
  ctx.onCleanup(() => e.remove())
  return e
}

export function canvasLayer(ctx: Ctx, z = 9980) {
  const canvas = el(ctx, "canvas", {
    position: "fixed", inset: "0", width: "100vw", height: "100vh",
    zIndex: String(z), pointerEvents: "none",
  })
  const dpr = window.devicePixelRatio || 1
  canvas.width = ctx.W * dpr
  canvas.height = ctx.H * dpr
  const g = canvas.getContext("2d")!
  g.scale(dpr, dpr)
  return { canvas, g }
}

export function htmlClass(ctx: Ctx, cls: string) {
  const html = document.documentElement
  html.classList.add(cls)
  ctx.onCleanup(() => html.classList.remove(cls))
}

/** The real text goes transparent; effects paint the letters themselves. */
export const hideText = (ctx: Ctx) => htmlClass(ctx, "fx-hide-text")

/** Inline style on an element React doesn't style, restored on cleanup. */
export function setStyle(ctx: Ctx, target: HTMLElement, style: Partial<CSSStyleDeclaration>) {
  const prev = target.getAttribute("style")
  Object.assign(target.style, style)
  ctx.onCleanup(() => {
    if (prev === null) target.removeAttribute("style")
    else target.setAttribute("style", prev)
  })
}

/** The app shell's outermost element — header, nav, page and footer. */
export function appRoot(): HTMLElement | null {
  return document.querySelector("main")?.closest<HTMLElement>("body > *") ?? null
}

// ─── Glyphs: every visible letter, with where it sits and how it looks ───────

export interface Glyph {
  ch: string
  font: string
  color: string
  /** Centre of the letter on screen. */
  x: number
  y: number
  w: number
  h: number
}

export function collectGlyphs(max = 3500): Glyph[] {
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
  for (let n = walker.nextNode(); n && glyphs.length < max; n = walker.nextNode()) {
    const parent = n.parentElement!
    let st = styleCache.get(parent)
    if (st === undefined) {
      const cs = getComputedStyle(parent)
      st = cs.visibility === "hidden" || cs.opacity === "0" ? null : {
        font: `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`,
        color: cs.color,
      }
      styleCache.set(parent, st)
    }
    if (!st) continue
    let i = 0
    for (const ch of n.nodeValue!) {           // by code point, so emoji stay whole
      const len = ch.length
      if (ch.trim()) {
        range.setStart(n, i)
        range.setEnd(n, i + len)
        const r = range.getBoundingClientRect()
        if (inViewport(r)) {
          glyphs.push({ ch, font: st.font, color: st.color, x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height })
        }
      }
      i += len
    }
  }
  return glyphs
}

export function drawGlyph(
  g: CanvasRenderingContext2D, gl: Glyph, x: number, y: number,
  rot = 0, color = gl.color, scale = 1,
) {
  g.save()
  g.translate(x, y)
  if (rot) g.rotate(rot)
  if (scale !== 1) g.scale(scale, scale)
  g.font = gl.font
  g.fillStyle = color
  g.textAlign = "center"
  g.textBaseline = "middle"
  g.fillText(gl.ch, 0, 0)
  g.restore()
}

/** Points along a set of segments, evenly spread — for letters to gather on. */
export type Seg =
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number }
  | { kind: "arc"; cx: number; cy: number; r: number; a1: number; a2: number }

export function samplePath(segs: Seg[], n: number): { x: number; y: number; a: number }[] {
  const lens = segs.map((s) => s.kind === "line" ? Math.hypot(s.x2 - s.x1, s.y2 - s.y1) : Math.abs(s.a2 - s.a1) * s.r)
  const total = lens.reduce((a, b) => a + b, 0)
  const out: { x: number; y: number; a: number }[] = []
  for (let i = 0; i < n; i++) {
    let d = ((i + 0.5) / n) * total
    let k = 0
    while (k < segs.length - 1 && d > lens[k]) { d -= lens[k]; k++ }
    const s = segs[k]
    const f = lens[k] ? d / lens[k] : 0
    if (s.kind === "line") {
      out.push({ x: lerp(s.x1, s.x2, f), y: lerp(s.y1, s.y2, f), a: Math.atan2(s.y2 - s.y1, s.x2 - s.x1) })
    } else {
      const a = lerp(s.a1, s.a2, f)
      out.push({ x: s.cx + Math.cos(a) * s.r, y: s.cy + Math.sin(a) * s.r, a: a + Math.PI / 2 })
    }
  }
  return out
}

/** Points filling the strokes of `text`, drawn large — for letters to spell a word. */
export function sampleText(text: string, cx: number, cy: number, size: number, n: number) {
  const c = document.createElement("canvas")
  const w = Math.ceil(size * text.length * 0.75)
  const h = Math.ceil(size * 1.4)
  c.width = w
  c.height = h
  const g = c.getContext("2d")!
  g.font = `800 ${size}px ${getComputedStyle(document.body).fontFamily}`
  g.textAlign = "center"
  g.textBaseline = "middle"
  g.direction = "rtl"
  g.fillText(text, w / 2, h / 2)
  const data = g.getImageData(0, 0, w, h).data
  const pts: { x: number; y: number }[] = []
  const step = 3
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if (data[(y * w + x) * 4 + 3] > 128) pts.push({ x: cx - w / 2 + x, y: cy - h / 2 + y })
    }
  }
  // Shuffle, then take or repeat to exactly n.
  for (let i = pts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pts[i], pts[j]] = [pts[j], pts[i]]
  }
  return Array.from({ length: n }, (_, i) => pts[i % Math.max(1, pts.length)] ?? { x: cx, y: cy })
}

// ─── Copies: stand-ins for page elements that keep their look ───────────────

/** Visible rows first, then other sizeable elements, none nested in another. */
export function pickBlocks(max: number, opts: { minWidth?: number } = {}): HTMLElement[] {
  const main = document.querySelector("main")
  if (!main) return []
  const minW = opts.minWidth ?? 40
  const ok = (e: HTMLElement) => {
    const r = e.getBoundingClientRect()
    return inViewport(r) && r.width > minW && r.height > 14 && r.top >= 0 && r.bottom <= window.innerHeight
  }
  const picked: HTMLElement[] = []
  const add = (sel: string) => {
    for (const e of main.querySelectorAll<HTMLElement>(sel)) {
      if (picked.length >= max) return
      if (!ok(e) || picked.some((p) => p.contains(e) || e.contains(p))) continue
      picked.push(e)
    }
  }
  add("tbody tr")
  add("thead tr, li, h1, h2, h3, button, a, p, input, select, label")
  return picked
}

export function copyOf(src: HTMLElement, r: DOMRect, z = 9985): HTMLElement {
  const inner = src.cloneNode(true) as HTMLElement
  inner.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"))
  inner.removeAttribute("id")
  let content: HTMLElement = inner
  if (src.tagName === "TR") {
    const cells = src.children
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

  const cs = getComputedStyle(src)
  const wrap = document.createElement("div")
  wrap.className = "fx-keep"
  wrap.dir = "rtl"
  const bg = cs.backgroundColor
  Object.assign(wrap.style, {
    position: "fixed", left: "0", top: "0", overflow: "hidden",
    display: "flex", alignItems: "center", justifyContent: "flex-start",
    background: bg && bg !== "rgba(0, 0, 0, 0)" ? bg : "var(--app-canvas, #fff)",
    font: cs.font, color: cs.color,
    border: "1px solid var(--color-gray-300, #d1d5db)", boxShadow: "0 2px 8px rgba(0,0,0,.12)",
    transformOrigin: "0 0", zIndex: String(z), pointerEvents: "none",
    willChange: "transform, width, height",
    width: `${r.width}px`, height: `${r.height}px`,
    transform: `translate(${r.left}px, ${r.top}px)`,
  })
  wrap.appendChild(content)
  return wrap
}

/** Copies of `els` laid exactly over them; the originals are hidden until cleanup. */
export function liftOut(ctx: Ctx, els: HTMLElement[], z = 9985) {
  const rects = els.map((e) => e.getBoundingClientRect())
  const copies = els.map((e, i) => copyOf(e, rects[i], z))
  els.forEach((e) => setStyle(ctx, e, { visibility: "hidden" }))
  copies.forEach((c) => document.body.appendChild(c))
  ctx.onCleanup(() => copies.forEach((c) => c.remove()))
  return { rects, copies }
}
