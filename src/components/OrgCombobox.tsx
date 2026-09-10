"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { filterOrgs, sortOrgs, type OrgSearchable } from "@/lib/org-search"

export type OrgComboboxOption = OrgSearchable

interface Props {
  orgs:      OrgComboboxOption[]
  value:     string
  onChange:  (id: string) => void
  loading?:  boolean
  disabled?: boolean
}

/** Cap on rendered rows — the list is expected to grow into the hundreds. */
const MAX_VISIBLE = 100

function Highlighted({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  if (!q) return <>{text}</>
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-navy-light text-navy rounded-sm px-0.5">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  )
}

/**
 * Organization picker: alphabetical by Hebrew collation, filtered by substring —
 * typing `אב` keeps every org whose name or city contains `אב` anywhere, not only
 * those starting with it.
 */
export function OrgCombobox({ orgs, value, onChange, loading = false, disabled = false }: Props) {
  const [open,   setOpen]   = useState(false)
  const [query,  setQuery]  = useState("")
  const [active, setActive] = useState(0)

  const rootRef  = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef  = useRef<HTMLUListElement>(null)

  const sorted  = useMemo(() => sortOrgs(orgs), [orgs])
  const matches = useMemo(() => filterOrgs(sorted, query), [sorted, query])

  const visible  = matches.slice(0, MAX_VISIBLE)
  const overflow = matches.length - visible.length
  const selected = orgs.find((o) => o.id === value) ?? null

  // Close on click outside.
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) { setOpen(false); setQuery("") }
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  // Keep the highlighted row in view.
  useEffect(() => {
    if (!open) return
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" })
  }, [open, active])

  // Re-entrant: focus and click both call it, and a click to reposition the
  // cursor mid-query must not wipe what has been typed.
  function openList() {
    if (disabled || loading || open) return
    setQuery("")
    // Start on the current selection, unless it sits past the render cap.
    const i = sorted.findIndex((o) => o.id === value)
    setActive(i >= 0 && i < MAX_VISIBLE ? i : 0)
    setOpen(true)
  }

  function choose(id: string) {
    onChange(id)
    setQuery("")
    setOpen(false)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      if (!open) { openList(); return }
      if (visible.length === 0) return
      const step = e.key === "ArrowDown" ? 1 : -1
      setActive((i) => Math.min(visible.length - 1, Math.max(0, i + step)))
      return
    }
    if (e.key === "Enter") {
      // Never let the combobox submit the form.
      e.preventDefault()
      if (open && visible[active]) choose(visible[active].id)
      else openList()
      return
    }
    if (e.key === "Escape" && open) {
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
      setQuery("")
      return
    }
    if (e.key === "Tab" && open) { setOpen(false); setQuery("") }
  }

  const label = selected ? `${selected.name} — ${selected.city}` : ""

  return (
    <div ref={rootRef} className="relative flex-1">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="org-combobox-list"
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled || loading}
          value={open ? query : label}
          placeholder={loading ? "טוען..." : "בחר/י ארגון — או הקלד/י לחיפוש"}
          onChange={(e) => { setQuery(e.target.value); setActive(0); if (!open) setOpen(true) }}
          onFocus={openList}
          onClick={openList}
          onKeyDown={handleKeyDown}
          className="w-full border border-gray-300 rounded ps-3 pe-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 disabled:bg-gray-50 disabled:text-gray-400"
        />
        {value && !disabled && !loading && (
          <button
            type="button"
            aria-label="ניקוי בחירת ארגון"
            onClick={() => { onChange(""); setQuery(""); setActive(0); setOpen(true); inputRef.current?.focus() }}
            className="absolute inset-y-0 end-2 flex items-center text-gray-400 hover:text-gray-700 text-lg leading-none"
          >
            &times;
          </button>
        )}
      </div>

      {open && (
        <ul
          id="org-combobox-list"
          ref={listRef}
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto bg-white border border-gray-200 rounded shadow-lg py-1"
        >
          {visible.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-400">אין ארגון תואם</li>
          )}
          {visible.map((o, i) => (
            <li
              key={o.id}
              role="option"
              aria-selected={o.id === value}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); choose(o.id) }}
              className={`px-3 py-2 text-sm cursor-pointer flex items-baseline gap-2 ${
                i === active ? "bg-navy-light" : ""
              } ${o.id === value ? "font-semibold text-navy" : "text-gray-800"}`}
            >
              <span><Highlighted text={o.name} query={query} /></span>
              <span className="text-xs text-gray-400"><Highlighted text={o.city} query={query} /></span>
            </li>
          ))}
          {overflow > 0 && (
            <li className="px-3 py-2 text-xs text-gray-400 border-t border-gray-100">
              ועוד {overflow} ארגונים — הקלד/י כדי לצמצם
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
