"use client"

import { useEffect, useRef, useState } from "react"
import {
  THEMES, BACKGROUNDS, seasonalPattern, applyAppearance, loadAppearance, saveAppearance,
  DEFAULT_APPEARANCE, type Appearance,
} from "@/lib/appearance"
import { celebrate } from "@/lib/celebrate"

const PINKS = ["#FF3D9A", "#FF8CC6", "#FFD6EC", "#C2167A", "#F7B5FF", "#FFFFFF", "#FFD34D"]

/** The 🎨 button in the header and its popover. §6.9 */
export function AppearanceMenu({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  const [appearance, setAppearance] = useState<Appearance>(DEFAULT_APPEARANCE)
  const ref = useRef<HTMLDivElement>(null)
  // The נעם אסרף theme asks who's choosing it first.
  const [noamAsk, setNoamAsk] = useState<null | "ask" | "no">(null)

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
    if (patch.theme === "noam" && appearance.theme !== "noam") { setNoamAsk("ask"); return }
    apply(patch)
  }

  function apply(patch: Partial<Appearance>) {
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
        <div className="absolute left-0 top-10 z-50 w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-4 space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">ערכת צבעים</p>
            <div className="grid grid-cols-3 gap-2">
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
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">רקע לכותרת</p>
            <div className="grid grid-cols-2 gap-1.5">
              {BACKGROUNDS.map((b) => {
                const active = appearance.bg === b.id
                const pattern = b.id === "seasonal" ? seasonalPattern(new Date()) : b.id
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => update({ bg: b.id })}
                    className={`relative isolate h-9 rounded-lg border text-xs transition-colors ${
                      active ? "border-navy text-navy font-semibold" : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {/* A live preview: the same layer the header uses, pinned to this pattern */}
                    {b.id !== "none" && (
                      <span data-bg-preview={pattern} className="appearance-bg absolute inset-0 -z-10 rounded-lg" aria-hidden />
                    )}
                    {b.label}
                  </button>
                )
              })}
            </div>
          </div>
          <p className="text-[11px] text-gray-400">נשמר בדפדפן הזה בלבד.</p>
        </div>
      )}

      {noamAsk && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl px-8 py-6 text-center w-72 border-4 border-pink-300">
            {noamAsk === "ask" ? (
              <>
                <p className="text-lg font-bold text-gray-900 mb-5">האם את נעם אסרף?</p>
                <div className="flex gap-3 justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      setNoamAsk(null)
                      setOpen(false)
                      apply({ theme: "noam" })
                      celebrate("יא מלכה נעם! 👑💖", PINKS)
                    }}
                    className="px-6 py-2 rounded-full text-white font-semibold bg-gradient-to-l from-pink-500 to-fuchsia-500 hover:scale-105 transition-transform"
                  >
                    כן
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNoamAsk("no")
                      setTimeout(() => setNoamAsk(null), 1500)
                    }}
                    className="px-6 py-2 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    לא
                  </button>
                </div>
              </>
            ) : (
              <p className="text-lg font-bold text-gray-700">חבל 💔</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
