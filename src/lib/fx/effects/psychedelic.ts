import { type Ctx, el, htmlClass, phase, ease } from "../core"
import { note } from "../sound"

// Level 2: the page bounces in rainbow colours for a moment, then becomes a
// kaleidoscope — live copies of the page cut into mirrored wedges that turn,
// drift and melt, while the colours cycle.

export function psychedelic(ctx: Ctx): boolean {
  htmlClass(ctx, "fx-psy")
  music(ctx)
  const main = document.querySelector("main")
  if (main) ctx.later(1400, () => kaleidoscope(ctx, main))
  ctx.later(11200, ctx.stop)
  return true
}

function kaleidoscope(ctx: Ctx, main: HTMLElement) {
  const { W, H } = ctx
  const cx = W / 2
  const cy = H / 2
  const N = main.getElementsByTagName("*").length > 2500 ? 6 : 8
  const half = Math.PI / N
  const R = Math.hypot(W, H) * 0.75

  // The melt: a displacement filter whose noise we re-seed as it runs.
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  svg.setAttribute("width", "0")
  svg.setAttribute("height", "0")
  svg.setAttribute("class", "fx-keep")
  svg.style.position = "absolute"
  svg.innerHTML = `<filter id="fx-liquid" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.006 0.011" numOctaves="2" seed="3"/>
    <feDisplacementMap in="SourceGraphic" scale="0" xChannelSelector="R" yChannelSelector="G"/>
  </filter>`
  document.body.appendChild(svg)
  ctx.onCleanup(() => svg.remove())
  const turb = svg.querySelector("feTurbulence")!
  const disp = svg.querySelector("feDisplacementMap")!

  const stage = el(ctx, "div", {
    position: "fixed", inset: "0", zIndex: "9970", pointerEvents: "none", opacity: "0",
    background: "#000", overflow: "hidden",
  })
  const spinner = el(ctx, "div", { position: "absolute", inset: "0", transformOrigin: `${cx}px ${cy}px` }, stage)
  const mr = main.getBoundingClientRect()
  const inners: HTMLElement[] = []
  const wedge = [
    `${cx}px ${cy}px`,
    `${cx + Math.cos(-half) * R}px ${cy + Math.sin(-half) * R}px`,
    `${cx + Math.cos(half) * R}px ${cy + Math.sin(half) * R}px`,
  ].join(",")

  for (let k = 0; k < N; k++) {
    const w = el(ctx, "div", {
      position: "absolute", inset: "0",
      clipPath: `polygon(${wedge})`,
      transformOrigin: `${cx}px ${cy}px`,
      // Every other wedge mirrored, so neighbours meet seamlessly.
      transform: `rotate(${(k * 360) / N}deg)${k % 2 ? " scaleY(-1)" : ""}`,
    }, spinner)
    const inner = el(ctx, "div", {
      position: "absolute", left: `${-W}px`, top: `${-H}px`, width: `${W * 3}px`, height: `${H * 3}px`,
      background: "var(--app-canvas, #fff)",
    }, w)
    const copy = main.cloneNode(true) as HTMLElement
    copy.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"))
    Object.assign(copy.style, {
      position: "absolute", left: `${W + mr.left}px`, top: `${H + mr.top}px`,
      width: `${mr.width}px`, height: `${mr.height}px`, overflow: "hidden",
    })
    inner.appendChild(copy)
    copy.scrollTop = main.scrollTop
    inners.push(inner)
  }

  const IN = 900, OUT_AT = 8000, OUT = 1000
  ctx.loop((t) => {
    const s = t / 1000
    stage.style.opacity = String(t < IN ? ease(phase(t, 0, IN)) : 1 - ease(phase(t, OUT_AT, OUT_AT + OUT)))
    spinner.style.transform = `rotate(${s * 22}deg) scale(${1 + 0.15 * Math.sin(s * 0.9)})`
    // The page drifts under the mirrors — what makes a kaleidoscope move.
    const dx = Math.sin(s * 0.7) * W * 0.18
    const dy = Math.cos(s * 0.5) * H * 0.22
    for (const inner of inners) inner.style.transform = `translate(${dx}px, ${dy}px) rotate(${s * -9}deg)`
    const melt = 18 + 14 * Math.sin(s * 1.3)
    disp.setAttribute("scale", String(melt))
    turb.setAttribute("baseFrequency", `${0.006 + 0.003 * Math.sin(s)} ${0.011 + 0.004 * Math.cos(s * 0.8)}`)
    stage.style.filter = `url(#fx-liquid) hue-rotate(${(s * 140) % 360}deg) saturate(1.9)`
    return t < OUT_AT + OUT
  })
}

/** A wobbly arpeggio over a drone, gliding between notes. */
function music(ctx: Ctx) {
  const s = ctx.sound
  if (!s.on) return
  // D dorian, wandering.
  const scale = [-7, -5, -4, -2, 0, 2, 3, 5, 7, 8, 10, 12]
  for (let i = 0; i < 80; i++) {
    const n = scale[(i * 5 + Math.floor(i / 8) * 3) % scale.length]
    const t = i * 0.13
    s.tone(note(n), t, 0.22, { type: i % 3 ? "sine" : "triangle", vol: 0.18, slideTo: note(n + (i % 4 === 0 ? 2 : 0)), pan: Math.sin(i * 0.7) * 0.8 })
  }
  for (let i = 0; i < 5; i++) {
    s.tone(note(-19), i * 2.1, 2.3, { type: "sawtooth", vol: 0.05, detune: (i % 2 ? 1 : -1) * 12, attack: 0.6, release: 0.8 })
    s.tone(note(-12 + (i % 2 ? 3 : 0)), i * 2.1, 2.3, { type: "sine", vol: 0.12, attack: 0.6, release: 0.8 })
  }
}
