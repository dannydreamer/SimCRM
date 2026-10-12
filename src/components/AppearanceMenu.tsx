"use client"

import { useEffect, useRef, useState } from "react"
import {
  THEMES, applyAppearance, loadAppearance, saveAppearance,
  DEFAULT_APPEARANCE, type Appearance,
} from "@/lib/appearance"

/** The 🎨 button in the header and its popover. §6.9 */
export function AppearanceMenu({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  const [appearance, setAppearance] = useState<Appearance>(DEFAULT_APPEARANCE)
  const ref = useRef<HTMLDivElement>(null)

  // The init script already painted the stored choice; re-apply in case it
  // ran for a different user (a sign-out and sign-in without a full reload).
  useEffect(() => { applyAppearance(loadAppearance(userId)) }, [userId])

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

  function update(patch: Partial<Appearance>) {
    const next = { ...appearance, ...patch }
    setAppearance(next)
    applyAppearance(next)
    saveAppearance(userId, next)
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          if (!open) setAppearance(loadAppearance(userId))
          setOpen(!open)
        }}
        title="מראה אישי"
        aria-label="מראה אישי"
        aria-expanded={open}
        className="w-8 h-8 rounded-full flex items-center justify-center text-base hover:bg-gray-100 transition-colors"
      >
        🎨
      </button>

      {open && (
        <div className="absolute left-0 top-10 z-50 w-64 bg-white border border-gray-200 rounded-xl shadow-lg p-4 space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">ערכת צבעים</p>
            <div className="grid grid-cols-5 gap-2">
              {THEMES.map((t) => {
                const active = appearance.theme === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => update({ theme: t.id })}
                    title={t.label}
                    className="flex flex-col items-center gap-1 group"
                  >
                    <span
                      className={`w-9 h-9 rounded-full border-2 transition-transform group-hover:scale-110 ${
                        active ? "border-gray-800" : "border-white shadow-sm"
                      }`}
                      style={{ background: `linear-gradient(135deg, ${t.swatch[0]} 50%, ${t.swatch[1]} 50%)` }}
                    />
                    <span className={`text-[11px] leading-tight ${active ? "font-semibold text-gray-900" : "text-gray-500"}`}>
                      {t.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
          <p className="text-[11px] text-gray-400">נשמר בדפדפן הזה בלבד.</p>
        </div>
      )}
    </div>
  )
}
