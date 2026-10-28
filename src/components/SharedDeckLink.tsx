"use client"

// The Techs' way to the facilitator's deck — spec §14 F-06, "Sharing".
// Deliberately out of the way: nothing at all unless a deck was shared for this
// workshop, and then only a faint ⋯ at the foot of the page that opens the
// download. Two clicks, so nobody stumbles into it.

import { useEffect, useState } from "react"
import { useUser } from "@/app/(app)/user-context"
import { canDownloadSharedDeck } from "@/lib/deck/access"
import { downloadFile, formatSize, type DeckFileMeta } from "@/lib/deck/transfer"

export function SharedDeckLink({ workshopId }: { workshopId: string }) {
  const user = useUser()
  const eligible = canDownloadSharedDeck(user.roles)
  const [deck, setDeck] = useState<DeckFileMeta | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!eligible) return
    let live = true
    fetch(`/api/matzgot/shared?workshopId=${encodeURIComponent(workshopId)}`)
      .then((r) => (r.ok ? r.json() : { deck: null }))
      .then((b) => { if (live) setDeck(b.deck ?? null) })
      .catch(() => {})
    return () => { live = false }
  }, [eligible, workshopId])

  if (!deck) return null

  async function download() {
    setBusy(true)
    setError(null)
    try { await downloadFile(deck!) } catch (e) { setError((e as Error).message) }
    setBusy(false)
  }

  return (
    <div className="mt-10 flex flex-col items-end gap-2">
      <button
        onClick={() => setOpen((o) => !o)}
        title="עוד"
        className="px-2 text-gray-300 hover:text-gray-500 text-lg leading-none"
      >
        ⋯
      </button>
      {open && (
        <div className="border border-gray-200 rounded-lg px-4 py-3 bg-white text-sm flex items-center gap-3">
          <span className="text-gray-600">מצגת המתחקר/ת</span>
          <button
            onClick={download}
            disabled={busy}
            className="px-3 py-1.5 bg-navy text-white text-xs font-medium rounded hover:bg-navy-dark disabled:opacity-50"
          >
            {busy ? "מוריד..." : <>הורדה · <span dir="ltr">{formatSize(deck.size)}</span></>}
          </button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      )}
    </div>
  )
}
