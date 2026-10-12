"use client"

import { useEffect, useRef, useState } from "react"

// The effects live in their own chunk, fetched on first open.
type Fx = typeof import("@/lib/fx")
let fxModule: Promise<Fx> | null = null
const loadFx = () => (fxModule ??= import("@/lib/fx"))

/**
 * 🎭 in the header — picks a party effect. Visible while the effects are on
 * trial; the plan is to hide it behind the logo once settled. §6.9
 */
export function PartyButton() {
  const [open, setOpen] = useState(false)
  const [fx, setFx] = useState<Fx | null>(null)
  const [soundOn, setSoundOnState] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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

  async function toggle() {
    if (open) { setOpen(false); return }
    setOpen(true)
    const m = await loadFx()
    setFx(m)
    setSoundOnState(m.isSoundOn())
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={toggle}
        title="מסיבה"
        aria-label="מסיבה"
        aria-expanded={open}
        className="w-8 h-8 rounded-full flex items-center justify-center text-base hover:bg-gray-100 transition-colors"
      >
        🎭
      </button>
      {open && (
        <div className="absolute left-0 top-10 z-50 w-64 bg-white border border-gray-200 rounded-xl shadow-lg p-2">
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
                      requestAnimationFrame(() => fx.runFx(e.id))
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
