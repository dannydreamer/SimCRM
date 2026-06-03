"use client"

import { useEffect, useRef, useState, useCallback, Suspense } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"

// ─── Types ───────────────────────────────────────────────────────────────────

type RagColor = "GREEN" | "YELLOW" | "RED"

interface SlotState {
  feedbackId:   string | null
  aspect1Color: RagColor;  aspect1Text: string
  aspect2Color: RagColor;  aspect2Text: string
  aspect3Color: RagColor;  aspect3Text: string
  aspect4Color: RagColor;  aspect4Text: string
  saving:   boolean
  saved:    boolean
  // transient — not sent to server
  pendingText: boolean
}

interface ActorRow {
  actorId:    string
  actorName:  string
  feedbackId: string | null
  aspect1Color: RagColor;  aspect1Text: string
  aspect2Color: RagColor;  aspect2Text: string
  aspect3Color: RagColor;  aspect3Text: string
  aspect4Color: RagColor;  aspect4Text: string
}

interface RoomRow {
  id:              string
  roomNumber:      number
  facilitatorName: string | null
  actors:          ActorRow[]
}

interface WorkshopData {
  id:        string
  date:      string
  groupName: string
  orgName:   string
  director:  ActorRow | null
  rooms:     RoomRow[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ASPECTS = [
  {
    key:   "aspect1",
    label: "התכוננות לסדנה",
    desc:  "האם קרא/ה את התרחיש? שלח/ה שאלות מוקדמות? ציין/ה פרטי תלבושת חסרים מספיק זמן מראש? הגיע/ה לאימון מוכן?",
  },
  {
    key:   "aspect2",
    label: "השחקן כסימולטור",
    desc:  "האם הגיב/ה באמינות? קידם/ה את המתאמן לעבר נקודות התחקיר? נצמד לרפליקות? ידע מתי לרכך ומתי לאתגר?",
  },
  {
    key:   "aspect3",
    label: "שיקוף",
    desc:  "עמד/ה במסגרת הזמן? דיבר/ה מתוך הדמות בלבד? ניסח/ה חוויה רגשית? נמנע/ה מהמלצות?",
  },
  {
    key:   "aspect4",
    label: "התנהלות מקצועית",
    desc:  "הגיע/ה בזמן? תלבושת מלאה? זמין/ה לאורך הסדנה? נשאר/ה עד שחרור רשמי?",
  },
] as const

type AspectKey = (typeof ASPECTS)[number]["key"]

const RAG_OPTIONS: { value: RagColor; label: string; activeClasses: string; inactiveClasses: string }[] = [
  {
    value:          "RED",
    label:          "חמור",
    activeClasses:  "bg-red-500 text-white",
    inactiveClasses:"bg-red-50 text-red-700 hover:bg-red-100",
  },
  {
    value:          "YELLOW",
    label:          "במעקב",
    activeClasses:  "bg-amber-400 text-white",
    inactiveClasses:"bg-amber-50 text-amber-700 hover:bg-amber-100",
  },
  {
    value:          "GREEN",
    label:          "תקין",
    activeClasses:  "bg-brand-green text-white",
    inactiveClasses:"bg-green-50 text-green-700 hover:bg-green-100",
  },
]

const TEXTAREA_BORDER: Record<RagColor, string> = {
  RED:    "border-red-300",
  YELLOW: "border-amber-300",
  GREEN:  "border-green-300",
}

function slotKey(roomId: string | null, actorId: string) {
  return `${roomId}:${actorId}`
}

function defaultSlot(actor: ActorRow): SlotState {
  return {
    feedbackId:   actor.feedbackId,
    aspect1Color: actor.aspect1Color, aspect1Text: actor.aspect1Text,
    aspect2Color: actor.aspect2Color, aspect2Text: actor.aspect2Text,
    aspect3Color: actor.aspect3Color, aspect3Text: actor.aspect3Text,
    aspect4Color: actor.aspect4Color, aspect4Text: actor.aspect4Text,
    saving: false, saved: actor.feedbackId !== null, pendingText: false,
  }
}

function getColor(s: SlotState, a: AspectKey): RagColor {
  switch (a) {
    case "aspect1": return s.aspect1Color
    case "aspect2": return s.aspect2Color
    case "aspect3": return s.aspect3Color
    case "aspect4": return s.aspect4Color
  }
}

function getText(s: SlotState, a: AspectKey): string {
  switch (a) {
    case "aspect1": return s.aspect1Text
    case "aspect2": return s.aspect2Text
    case "aspect3": return s.aspect3Text
    case "aspect4": return s.aspect4Text
  }
}

function setColor(s: SlotState, a: AspectKey, v: RagColor): SlotState {
  switch (a) {
    case "aspect1": return { ...s, aspect1Color: v }
    case "aspect2": return { ...s, aspect2Color: v }
    case "aspect3": return { ...s, aspect3Color: v }
    case "aspect4": return { ...s, aspect4Color: v }
  }
}

function setAspectText(s: SlotState, a: AspectKey, v: string): SlotState {
  switch (a) {
    case "aspect1": return { ...s, aspect1Text: v }
    case "aspect2": return { ...s, aspect2Text: v }
    case "aspect3": return { ...s, aspect3Text: v }
    case "aspect4": return { ...s, aspect4Text: v }
  }
}

// ─── Stable module-level helpers (must NOT be inside render) ────────────────

export function hasAnyText(s: SlotState): boolean {
  return s.aspect1Text.trim() !== "" || s.aspect2Text.trim() !== "" ||
         s.aspect3Text.trim() !== "" || s.aspect4Text.trim() !== ""
}

interface ActorCardProps {
  actor:         ActorRow
  roomId:        string | null
  slot:          SlotState | undefined
  onColorChange: (roomId: string | null, actorId: string, aspect: AspectKey, value: RagColor) => void
  onTextChange:  (roomId: string | null, actorId: string, aspect: AspectKey, value: string) => void
  onTextBlur:    (roomId: string | null, actorId: string) => void
}

function ActorCard({ actor, roomId, slot, onColorChange, onTextChange, onTextBlur }: ActorCardProps) {
  if (!slot) return null

  const isSaved    = slot.saved || !!slot.feedbackId
  const isComplete = isSaved && hasAnyText(slot)
  const statusEl = slot.saving ? (
    <span className="text-xs text-amber-500 font-medium">שומר...</span>
  ) : isComplete ? (
    <span className="text-xs text-green-600 font-medium">✓ נשמר</span>
  ) : isSaved ? (
    <span className="text-xs text-amber-600 font-medium">נשמר — חסר טקסט</span>
  ) : (
    <span className="text-xs text-gray-400">—</span>
  )

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="font-semibold text-gray-800">{actor.actorName}</p>
        {statusEl}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {ASPECTS.map(({ key: aspect, label, desc }) => {
          const currentColor = getColor(slot, aspect)
          const currentText  = getText(slot, aspect)
          return (
            <div key={aspect} className="space-y-2">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-0.5">
                {label}
              </p>
              <p className="text-xs text-gray-400 leading-snug mb-1">{desc}</p>

              <div className="flex gap-1.5">
                {RAG_OPTIONS.map((opt) => {
                  const isActive = currentColor === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => onColorChange(roomId, actor.actorId, aspect, opt.value)}
                      className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all ${
                        isActive ? opt.activeClasses : opt.inactiveClasses
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>

              <textarea
                rows={2}
                value={currentText}
                placeholder="הערות..."
                onChange={(e) => onTextChange(roomId, actor.actorId, aspect, e.target.value)}
                onBlur={() => onTextBlur(roomId, actor.actorId)}
                className={`w-full text-sm border rounded-md px-2 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-brand-blue/40 placeholder:text-gray-300 transition-colors ${TEXTAREA_BORDER[currentColor]}`}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Inner component (needs useSearchParams) ─────────────────────────────────

function FeedbackPageInner() {
  const { data: session, status } = useSession()
  const router   = useRouter()
  const params   = useSearchParams()
  const workshopId = params.get("workshopId")

  const [workshop, setWorkshop]   = useState<WorkshopData | null>(null)
  const [loading,  setLoading]    = useState(true)
  const [error,    setError]      = useState<string | null>(null)
  const [slots,    setSlots]      = useState<Map<string, SlotState>>(new Map())
  const slotsRef = useRef<Map<string, SlotState>>(new Map())

  // Keep ref in sync with state
  useEffect(() => {
    slotsRef.current = slots
  }, [slots])

  // ── Auth guard ──
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login")
  }, [status, router])

  const allowed =
    session?.user.roles.includes("MANAGER") ||
    session?.user.roles.includes("FEEDBACK_DOCUMENTER")

  // ── Load ──
  useEffect(() => {
    if (!workshopId) return
    setLoading(true)
    fetch(`/api/feedback?workshopId=${workshopId}`, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("שגיאה בטעינה")
        return r.json()
      })
      .then((data: WorkshopData) => {
        setWorkshop(data)
        const m = new Map<string, SlotState>()
        if (data.director) {
          m.set(slotKey(null, data.director.actorId), defaultSlot(data.director))
        }
        data.rooms.forEach((room) =>
          room.actors.forEach((actor) =>
            m.set(slotKey(room.id, actor.actorId), defaultSlot(actor))
          )
        )
        setSlots(m)
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message)
        setLoading(false)
      })
  }, [workshopId])

  // ── Save ──
  const saveSlot = useCallback(
    async (roomId: string | null, actorId: string, slotData: SlotState) => {
      const key = slotKey(roomId, actorId)

      // Mark saving
      setSlots((prev) => {
        const next = new Map(prev)
        const cur  = next.get(key)
        if (cur) next.set(key, { ...cur, saving: true, saved: false })
        return next
      })

      try {
        const res = await fetch("/api/feedback", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workshopId,
            roomId,
            actorId,
            aspect1Color: slotData.aspect1Color, aspect1Text: slotData.aspect1Text,
            aspect2Color: slotData.aspect2Color, aspect2Text: slotData.aspect2Text,
            aspect3Color: slotData.aspect3Color, aspect3Text: slotData.aspect3Text,
            aspect4Color: slotData.aspect4Color, aspect4Text: slotData.aspect4Text,
          }),
        })
        const json = await res.json()

        // Update feedbackId + mark saved
        setSlots((prev) => {
          const next = new Map(prev)
          const cur  = next.get(key)
          if (cur) next.set(key, { ...cur, feedbackId: json.id, saving: false, saved: true, pendingText: false })
          return next
        })
      } catch {
        setSlots((prev) => {
          const next = new Map(prev)
          const cur  = next.get(key)
          if (cur) next.set(key, { ...cur, saving: false })
          return next
        })
      }
    },
    [workshopId]
  )

  const handleColorChange = useCallback(
    (roomId: string | null, actorId: string, aspect: AspectKey, value: RagColor) => {
      const key = slotKey(roomId, actorId)
      setSlots((prev) => {
        const next = new Map(prev)
        const cur  = next.get(key)
        if (!cur) return prev
        const updated = setColor({ ...cur, saving: false, saved: false }, aspect, value)
        next.set(key, updated)
        // Save immediately using the updated slot
        setTimeout(() => saveSlot(roomId, actorId, updated), 0)
        return next
      })
    },
    [saveSlot]
  )

  const handleTextChange = useCallback(
    (roomId: string | null, actorId: string, aspect: AspectKey, value: string) => {
      const key = slotKey(roomId, actorId)
      setSlots((prev) => {
        const next = new Map(prev)
        const cur  = next.get(key)
        if (!cur) return prev
        next.set(key, setAspectText({ ...cur, saved: false, pendingText: true }, aspect, value))
        return next
      })
    },
    []
  )

  const handleTextBlur = useCallback(
    (roomId: string | null, actorId: string) => {
      const key  = slotKey(roomId, actorId)
      const slot = slotsRef.current.get(key)
      if (slot?.pendingText) {
        saveSlot(roomId, actorId, slot)
      }
    },
    [saveSlot]
  )

  // ── Progress ──
  const totalActors = workshop
    ? workshop.rooms.reduce((sum, r) => sum + r.actors.length, 0) + (workshop.director ? 1 : 0)
    : 0
  const savedActors = Array.from(slots.values()).filter(
    (s) => (s.saved || s.feedbackId !== null) && hasAnyText(s)
  ).length

  // ── Render helpers ──
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" })

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">טוען...</p>
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="p-8 text-center text-red-600 font-semibold">אין הרשאה לגשת לדף זה</div>
    )
  }

  if (error || !workshop) {
    return (
      <div className="p-8 text-center text-red-600">{error ?? "שגיאה בטעינה"}</div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6" dir="rtl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/sadnaot/${workshop.id}`}
          className="text-sm text-brand-blue hover:underline mb-3 inline-block"
        >
          ← חזרה לסדנה
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              פידבק — {workshop.groupName}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {workshop.orgName} · {formatDate(workshop.date)}
            </p>
          </div>

          {/* Progress badge */}
          <div
            className={`text-sm font-semibold px-3 py-1.5 rounded-full whitespace-nowrap ${
              savedActors === totalActors && totalActors > 0
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {savedActors === totalActors && totalActors > 0
              ? "✓ כל הפידבק הוזן"
              : `${savedActors} / ${totalActors} שחקנים הוזנו`}
          </div>
        </div>
      </div>

      {/* Info note */}
      <p className="text-sm text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 mb-6">
        פידבק ייחשב כמלא לאחר מילוי טקסט לפחות בהיבט אחד
      </p>

      {/* Director section */}
      {workshop.director && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-gray-700 border-b border-gray-200 pb-2 mb-4">
            במאי/ת הסדנה
          </h2>
          <ActorCard
            actor={workshop.director}
            roomId={null}
            slot={slots.get(slotKey(null, workshop.director.actorId))}
            onColorChange={handleColorChange}
            onTextChange={handleTextChange}
            onTextBlur={handleTextBlur}
          />
        </section>
      )}

      {/* Rooms */}
      {workshop.rooms.length === 0 && !workshop.director && (
        <p className="text-gray-500 text-center py-12">אין חדרים פעילים בסדנה זו</p>
      )}

      {workshop.rooms.map((room) => (
        <section key={room.id} className="mb-10">
          <h2 className="text-lg font-semibold text-gray-700 border-b border-gray-200 pb-2 mb-4">
            חדר {room.roomNumber}
            {room.facilitatorName && (
              <span className="text-gray-400 font-normal text-base mr-2">
                — {room.facilitatorName}
              </span>
            )}
          </h2>

          {room.actors.length === 0 && (
            <p className="text-sm text-gray-400 pr-2">אין שחקנים בחדר זה</p>
          )}

          <div className="space-y-6">
            {room.actors.map((actor) => (
              <ActorCard
                key={actor.actorId}
                actor={actor}
                roomId={room.id}
                slot={slots.get(slotKey(room.id, actor.actorId))}
                onColorChange={handleColorChange}
                onTextChange={handleTextChange}
                onTextBlur={handleTextBlur}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

// ─── Export (Suspense wrapper for useSearchParams) ────────────────────────────

export default function FeedbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-gray-500">טוען...</p>
        </div>
      }
    >
      <FeedbackPageInner />
    </Suspense>
  )
}
