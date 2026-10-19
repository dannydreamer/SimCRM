"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"

// The effects live in their own chunk, fetched when someone starts clicking.
type Fx = typeof import("@/lib/fx")
let fxModule: Promise<Fx> | null = null
const loadFx = () => (fxModule ??= import("@/lib/fx"))

const CLICKS = 5
const RESET_MS = 1600

const HINTS = ["", "עוד 4…", "עוד 3…", "עוד 2…", "עוד אחת!"]

/**
 * The header logo. Five quick clicks open the party-effects menu; each click
 * says so — the logo wobbles harder, a ring around it fills, a hint counts
 * down. A pause resets the count. §6.9
 */
export function LogoParty({ userName }: { userName: string }) {
  const [count, setCount] = useState(0)
  const [bump, setBump] = useState(0)          // restarts the wobble on every click
  const [open, setOpen] = useState(false)
  const [fx, setFx] = useState<Fx | null>(null)
  const [soundOn, setSoundOnState] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  useEffect(() => () => { if (resetTimer.current) clearTimeout(resetTimer.current) }, [])

  async function click() {
    if (open) { setOpen(false); return }
    const next = count + 1
    setBump((b) => b + 1)
    if (resetTimer.current) clearTimeout(resetTimer.current)
    if (next < CLICKS) {
      setCount(next)
      resetTimer.current = setTimeout(() => setCount(0), RESET_MS)
      if (next === 1) void loadFx()             // start fetching while they click
      return
    }
    setCount(0)
    setOpen(true)
    const m = await loadFx()
    setFx(m)
    setSoundOnState(m.isSoundOn())
  }

  // Ring around the logo, filling a fifth per click.
  const R = 21
  const C = 2 * Math.PI * R
  const filled = open ? 1 : count / CLICKS

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={click}
        aria-label="כיתקטיקה"
        className="relative w-11 h-11 flex items-center justify-center rounded-full"
      >
        <svg width="46" height="46" viewBox="0 0 46 46" className="absolute inset-0 -m-px pointer-events-none -rotate-90" aria-hidden>
          <circle
            cx="23" cy="23" r={R} fill="none" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - filled)}
            style={{ transition: "stroke-dashoffset .25s ease, opacity .3s", opacity: filled ? 0.85 : 0 }}
          />
        </svg>
        <span
          key={bump}
          className="block"
          style={bump ? {
            animation: "fx-logo-wobble .45s ease-out",
            ["--amp" as string]: `${6 + count * 4}deg`,
            ["--pop" as string]: String(1 + count * 0.05),
          } : undefined}
        >
          <Image src="/logo.png" alt="כיתקטיקה" width={36} height={36} className="object-contain" />
        </span>
      </button>

      {count > 0 && !open && (
        <span
          key={`hint-${count}`}
          className="absolute top-full right-1/2 translate-x-1/2 mt-0.5 whitespace-nowrap text-[11px] font-semibold text-navy pointer-events-none"
          style={{ animation: "fx-hint .35s ease-out" }}
        >
          {HINTS[count]}
        </span>
      )}

      {open && (
        <div className="absolute right-0 top-12 z-50 w-64 bg-white border border-gray-200 rounded-xl shadow-lg p-2">
          <p className="px-2.5 pt-1 pb-2 text-xs font-semibold text-gray-500">🎉 מצאת את ההפתעה</p>
          {!fx ? (
            <p className="text-xs text-gray-400 p-2">טוען…</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-1">
                {fx.FX_MENU.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      // Let the menu close before the page is captured.
                      requestAnimationFrame(() => fx.runFx(e.id, userName))
                    }}
                    className={`text-right px-2.5 py-1.5 rounded-lg text-sm hover:bg-navy-light hover:text-navy ${
                      e.id === "random" ? "col-span-2 font-semibold text-navy" : "text-gray-700"
                    }`}
                  >
                    {e.id === "random" ? "🎲 " : ""}{e.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => { fx.setSoundOn(!soundOn); setSoundOnState(!soundOn) }}
                className="mt-1 w-full text-right px-2.5 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-50 border-t border-gray-100"
              >
                {soundOn ? "🔊 צליל פעיל" : "🔇 צליל כבוי"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
