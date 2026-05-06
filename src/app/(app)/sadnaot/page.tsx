"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useUser } from "@/app/(app)/user-context"
import { StatusPill } from "@/components/StatusPill"

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkshopRow {
  id: string
  date: string
  startTime: string
  tentative: boolean
  cancelled: boolean
  status: string
  postponedWarning: boolean

  groupId: string
  groupName: string
  orgId: string
  orgName: string

  authorFirstName: string | null

  activeRoomCount: number
  facilitatedCount: number

  needsAssessmentDone: boolean

  scenarioCount: number
  scenariosWrittenCount: number
  scenarioUrgency: "written" | "gray" | "orange" | "red"

  castingMaleNeeded: number | null
  castingFemaleNeeded: number | null
  castingTotal: number
  castingDone: number

  pptCount: number
  feedbackFormAdded: boolean
  lettersCount: number

  feedbackExpected: number
  feedbackEntered: number

  isUpcoming: boolean
  daysUntil: number
}

interface Facilitator {
  id: string
  name: string
}

type DateFilter = "upcoming" | "past" | "all"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()}.${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}`
}

function Check({ ok }: { ok: boolean }) {
  return ok
    ? <span className="text-green-600 font-medium">✓</span>
    : <span className="text-gray-400">✗</span>
}

function Fraction({
  done,
  total,
  isUpcoming,
  showWarning = true,
  dash = false,
}: {
  done: number
  total: number
  isUpcoming: boolean
  showWarning?: boolean
  dash?: boolean
}) {
  if (dash) return <span className="text-gray-300">—</span>
  if (total === 0) return <span className="text-gray-400">—</span>
  const complete = done === total
  const urgent = !complete && isUpcoming && showWarning
  return (
    <span className={complete ? "text-green-600 font-medium" : urgent ? "text-orange-600 font-medium" : "text-gray-700"}>
      {done}/{total}
      {urgent && <span className="mr-1 text-red-500 text-xs">❗</span>}
    </span>
  )
}

function ScenarioCell({ urgency }: { urgency: WorkshopRow["scenarioUrgency"] }) {
  if (urgency === "written") return <span className="text-green-600 font-medium">✓</span>
  if (urgency === "orange")  return <span className="text-orange-500">✗</span>
  if (urgency === "red")     return <span className="text-red-600 font-bold">✗</span>
  return <span className="text-gray-400">✗</span>
}

function FeedbackCell({ w }: { w: WorkshopRow }) {
  if (w.isUpcoming) return <span className="text-gray-300">—</span>
  if (w.feedbackExpected === 0) return <span className="text-gray-300">—</span>
  if (w.feedbackEntered >= w.feedbackExpected) return <span className="text-green-600 font-medium">✓</span>
  return <span className="text-red-600 font-medium">✗</span>
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SadnaotPage() {
  const user = useUser()
  const isManager = user.roles.includes("MANAGER")

  const [workshops, setWorkshops] = useState<WorkshopRow[]>([])
  const [facilitators, setFacilitators] = useState<Facilitator[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState<DateFilter>("upcoming")
  const [facilitatorFilter, setFacilitatorFilter] = useState("")
  const [showCancelled, setShowCancelled] = useState(false)

  useEffect(() => {
    fetch("/api/facilitators")
      .then((r) => r.json())
      .then(setFacilitators)
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ filter: dateFilter })
    if (facilitatorFilter) params.set("facilitatorId", facilitatorFilter)
    fetch(`/api/workshops?${params}`)
      .then((r) => r.json())
      .then((data) => { setWorkshops(data); setLoading(false) })
  }, [dateFilter, facilitatorFilter])

  const active = workshops.filter((w) => !w.cancelled)
  const cancelled = workshops.filter((w) => w.cancelled)

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-8 pt-6 pb-4 flex items-start justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">סדנאות</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {loading ? "טוען..." : `${active.length} סדנאות בסך הכל`}
          </p>
        </div>
        {isManager && (
          <Link
            href="/sadnaot/new"
            className="px-4 py-2 bg-navy text-white text-sm font-medium rounded hover:bg-navy-dark transition-colors"
          >
            + סדנה חדשה
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="px-8 pb-4 flex items-center justify-between shrink-0">
        {/* Date filter pills */}
        <div className="flex items-center gap-1">
          {(
            [
              { key: "upcoming", label: "עתידיות + פתוחות" },
              { key: "past",     label: "עברו ונסגרו" },
              { key: "all",      label: "הכל" },
            ] as { key: DateFilter; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setDateFilter(key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                dateFilter === key
                  ? "bg-navy text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Facilitator filter */}
        {facilitators.length > 0 && (
          <select
            value={facilitatorFilter}
            onChange={(e) => setFacilitatorFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy/30"
          >
            <option value="">מתחקר/ת: הכל</option>
            {facilitators.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-8 pb-8">
        {loading ? (
          <p className="text-sm text-gray-400 py-8 text-center">טוען סדנאות...</p>
        ) : active.length === 0 && cancelled.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">אין סדנאות להצגה</p>
        ) : (
          <>
            <WorkshopTable rows={active} />

            {/* Cancelled section — only in "הכל" filter */}
            {dateFilter === "all" && cancelled.length > 0 && (
              <div className="mt-6">
                <button
                  onClick={() => setShowCancelled((v) => !v)}
                  className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2"
                >
                  <span>{cancelled.length} סדנאות שבוטלו</span>
                  <span>{showCancelled ? "▲" : "▾"}</span>
                </button>
                {showCancelled && <WorkshopTable rows={cancelled} dimmed />}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Table ────────────────────────────────────────────────────────────────────

function WorkshopTable({ rows, dimmed = false }: { rows: WorkshopRow[]; dimmed?: boolean }) {
  if (rows.length === 0) return null

  return (
    <div className={`border border-gray-200 rounded-lg overflow-x-auto ${dimmed ? "opacity-50" : ""}`}>
      <table className="w-full text-sm min-w-[1100px]">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200 text-right text-gray-500 text-xs font-medium">
            <th className="px-3 py-2 whitespace-nowrap">תאריך</th>
            <th className="px-3 py-2 whitespace-nowrap">שם הקבוצה</th>
            <th className="px-3 py-2 whitespace-nowrap">חד׳</th>
            <th className="px-3 py-2 whitespace-nowrap">סטטוס</th>
            <th className="px-3 py-2 whitespace-nowrap">כותבת</th>
            <th className="px-3 py-2 whitespace-nowrap">שיבוץ</th>
            <th className="px-3 py-2 whitespace-nowrap">איתור צרכים</th>
            <th className="px-3 py-2 whitespace-nowrap">ליהוק</th>
            <th className="px-3 py-2 whitespace-nowrap">תרחיש</th>
            <th className="px-3 py-2 whitespace-nowrap">מצגות</th>
            <th className="px-3 py-2 whitespace-nowrap">משוב עודכן</th>
            <th className="px-3 py-2 whitespace-nowrap">מכתבים</th>
            <th className="px-3 py-2 whitespace-nowrap">פידבק</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((w) => (
            <WorkshopRow key={w.id} w={w} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function WorkshopRow({ w }: { w: WorkshopRow }) {
  const cancelled = w.cancelled

  return (
    <tr
      className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors ${
        cancelled ? "opacity-50" : ""
      }`}
      onClick={() => (window.location.href = `/sadnaot/${w.id}`)}
    >
      {/* תאריך */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        <span className={`font-medium text-sim-teal ${cancelled ? "line-through" : ""}`}>
          {fmtDate(w.date)}
        </span>
      </td>

      {/* שם הקבוצה */}
      <td className="px-3 py-2.5">
        <span className={cancelled ? "line-through" : ""}>
          <Link
            href={`/irgunnim/${w.orgId}`}
            className="text-navy hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {w.orgName}
          </Link>
          {" — "}
          {w.groupName}
          {w.tentative && (
            <span className="mr-1 px-1 py-0.5 rounded text-xs bg-gray-100 text-gray-500 font-medium">?</span>
          )}
        </span>
      </td>

      {/* חד׳ */}
      <td className="px-3 py-2.5 text-gray-700">{w.activeRoomCount}</td>

      {/* סטטוס */}
      <td className="px-3 py-2.5">
        <StatusPill status={cancelled ? "CANCELLED" : w.status} />
      </td>

      {/* כותבת */}
      <td className="px-3 py-2.5">
        {w.authorFirstName
          ? <span className="text-gray-700">{w.authorFirstName}</span>
          : <span className="text-red-400">—</span>
        }
      </td>

      {/* שיבוץ */}
      <td className="px-3 py-2.5">
        <Fraction
          done={w.facilitatedCount}
          total={w.activeRoomCount}
          isUpcoming={w.isUpcoming}
        />
      </td>

      {/* איתור צרכים */}
      <td className="px-3 py-2.5 text-center">
        <Check ok={w.needsAssessmentDone} />
      </td>

      {/* ליהוק */}
      <td className="px-3 py-2.5">
        {!w.needsAssessmentDone ? (
          <span className="text-gray-300">—</span>
        ) : (
          <Fraction
            done={w.castingDone}
            total={w.castingTotal}
            isUpcoming={w.isUpcoming}
          />
        )}
      </td>

      {/* תרחיש */}
      <td className="px-3 py-2.5 text-center">
        <ScenarioCell urgency={w.scenarioUrgency} />
      </td>

      {/* מצגות */}
      <td className="px-3 py-2.5">
        <Fraction
          done={w.pptCount}
          total={w.activeRoomCount}
          isUpcoming={w.isUpcoming}
        />
      </td>

      {/* משוב עודכן */}
      <td className="px-3 py-2.5 text-center">
        {!w.needsAssessmentDone ? (
          <span className="text-gray-300">—</span>
        ) : (
          <Check ok={w.feedbackFormAdded} />
        )}
      </td>

      {/* מכתבים */}
      <td className="px-3 py-2.5">
        <Fraction
          done={w.lettersCount}
          total={w.activeRoomCount}
          isUpcoming={w.isUpcoming}
        />
      </td>

      {/* פידבק */}
      <td className="px-3 py-2.5 text-center">
        <FeedbackCell w={w} />
      </td>
    </tr>
  )
}
