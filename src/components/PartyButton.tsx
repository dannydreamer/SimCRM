"use client"

import { useEffect, useRef, useState } from "react"
import { FX_LABELS, runFx, type FxKind } from "@/lib/party-fx"

const CHOICES: (FxKind | "random")[] = ["random", "psychedelic", "gravity", "dance"]

/**
 * 🎭 in the header — picks a party effect. Visible while the effects are on
 * trial; the plan is to hide it behind the logo once one is chosen. §6.9
 */
export function PartyButton() {
  const [open, setOpen] = useState(false)
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

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title="מסיבה"
        aria-label="מסיבה"
        aria-expanded={open}
        className="w-8 h-8 rounded-full flex items-center justify-center text-base hover:bg-gray-100 transition-colors"
      >
        🎭
      </button>
      {open && (
        <div className="absolute left-0 top-10 z-50 w-36 bg-white border border-gray-200 rounded-xl shadow-lg py-1">
          {CHOICES.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setOpen(false)
                // Let the menu close before the page is captured.
                requestAnimationFrame(() => runFx(k))
              }}
              className="w-full text-right px-3 py-1.5 text-sm text-gray-700 hover:bg-navy-light hover:text-navy"
            >
              {FX_LABELS[k]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
