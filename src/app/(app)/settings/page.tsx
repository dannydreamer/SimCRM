"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"

// ─── Types ────────────────────────────────────────────────────────────────────

interface BackupStatus {
  lastSuccess: { date: string; fileSize: number | null; type: string } | null
  lastStatus:  "SUCCESS" | "FAILED" | null
  lastError:   string | null
  lastDate:    string | null
  totalCount:  number
  envWarning:  "missing_env" | null
  driveConnected: boolean
  driveFolderId:  string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// ─── Inner page (reads search params) ────────────────────────────────────────

function SettingsInner() {
  const searchParams = useSearchParams()
  const driveParam = searchParams.get("drive") // "connected" | "error" | null

  const [status, setStatus]   = useState<BackupStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [backing, setBacking] = useState(false)
  const [result, setResult]   = useState<"success" | "error" | null>(null)

  async function fetchStatus() {
    setLoading(true)
    const res = await fetch("/api/settings/backup")
    if (res.ok) setStatus(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchStatus() }, [])

  async function handleManualBackup() {
    setBacking(true)
    setResult(null)
    const res = await fetch("/api/settings/backup", { method: "POST" })
    setResult(res.ok ? "success" : "error")
    setBacking(false)
    if (res.ok) await fetchStatus()
  }

  const envOk       = status?.envWarning === null
  const driveOk     = status?.driveConnected === true
  const backupReady = envOk && driveOk
  const backupDisabled = !backupReady || backing

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 pt-6 pb-4 shrink-0">
        <h1 className="text-2xl font-bold text-gray-900">הגדרות</h1>
        <p className="text-sm text-gray-400 mt-0.5">ניהול מערכת וגיבויים</p>
      </div>

      <div className="flex-1 overflow-auto px-8 pb-8 space-y-6 max-w-2xl">

        {/* OAuth redirect result */}
        {driveParam === "connected" && (
          <div className="border border-green-200 bg-green-50 rounded-lg px-5 py-3 text-sm text-green-800">
            ✓ חיבור Google Drive הושלם בהצלחה.
          </div>
        )}
        {driveParam === "error" && (
          <div className="border border-red-200 bg-red-50 rounded-lg px-5 py-3 text-sm text-red-700">
            חיבור Google Drive נכשל — נסה שנית.
          </div>
        )}

        {/* Google Drive connection card */}
        <section className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-5 py-3">
            <h2 className="text-sm font-semibold text-gray-700">Google Drive</h2>
          </div>

          {loading ? (
            <div className="px-5 py-6 text-sm text-gray-400 text-center">טוען...</div>
          ) : (
            <div className="px-5 py-4 space-y-3">
              {/* Env warning */}
              {status?.envWarning === "missing_env" && (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  ⚠ משתני הסביבה{" "}
                  <code className="font-mono text-xs bg-amber-100 px-1 rounded">GOOGLE_CLIENT_ID</code>{" "}
                  ו-<code className="font-mono text-xs bg-amber-100 px-1 rounded">GOOGLE_CLIENT_SECRET</code>{" "}
                  חסרים ב-Vercel.
                </p>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {driveOk ? (
                      <span className="text-green-700">✓ מחובר ל-Google Drive</span>
                    ) : (
                      <span className="text-gray-500">לא מחובר</span>
                    )}
                  </p>
                  {driveOk && status?.driveFolderId && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      תיקיית גיבוי: SimCRM Files
                    </p>
                  )}
                  {!driveOk && envOk && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      יש לחבר חשבון Google Drive כדי להפעיל גיבויים.
                    </p>
                  )}
                </div>

                {!driveOk && envOk && (
                  <a
                    href="/api/drive/connect"
                    className="px-4 py-2 bg-navy text-white text-sm font-medium rounded hover:bg-navy-dark transition-colors"
                  >
                    חיבור Google Drive
                  </a>
                )}
                {driveOk && (
                  <a
                    href="/api/drive/connect"
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    חיבור מחדש
                  </a>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Backup status card */}
        <section className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-5 py-3">
            <h2 className="text-sm font-semibold text-gray-700">מצב גיבויים</h2>
          </div>

          {loading ? (
            <div className="px-5 py-8 text-sm text-gray-400 text-center">טוען...</div>
          ) : (
            <div className="divide-y divide-gray-100">
              <div className="px-5 py-3 flex items-center justify-between">
                <span className="text-sm text-gray-600">גיבוי אחרון</span>
                <span className="text-sm font-medium">
                  {status?.lastDate ? (
                    <span className={status.lastStatus === "FAILED" ? "text-red-600" : "text-gray-800"}>
                      {status.lastStatus === "SUCCESS" ? "✓ " : "✗ "}
                      {formatDateTime(status.lastDate)}
                    </span>
                  ) : (
                    <span className="text-gray-400">אין גיבויים</span>
                  )}
                </span>
              </div>

              <div className="px-5 py-3 flex items-center justify-between">
                <span className="text-sm text-gray-600">גיבוי מוצלח אחרון</span>
                <span className="text-sm text-gray-800 font-medium">
                  {status?.lastSuccess ? (
                    <>
                      {formatDateTime(status.lastSuccess.date)}
                      <span className="text-gray-400 font-normal mr-2">
                        ({formatFileSize(status.lastSuccess.fileSize)})
                      </span>
                    </>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </span>
              </div>

              {status?.lastStatus === "FAILED" && status.lastError && (
                <div className="px-5 py-3 flex items-start justify-between gap-4">
                  <span className="text-sm text-gray-600 shrink-0">שגיאה</span>
                  <span className="text-sm text-red-600 font-mono break-all text-left">{status.lastError}</span>
                </div>
              )}

              <div className="px-5 py-3 flex items-center justify-between">
                <span className="text-sm text-gray-600">סה"כ גיבויים שמורים</span>
                <span className="text-sm text-gray-800 font-medium">{status?.totalCount ?? "—"}</span>
              </div>
            </div>
          )}
        </section>

        {/* Manual backup */}
        <section className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-5 py-3">
            <h2 className="text-sm font-semibold text-gray-700">גיבוי ידני</h2>
          </div>
          <div className="px-5 py-4 flex items-center gap-4">
            <button
              onClick={handleManualBackup}
              disabled={backupDisabled}
              title={!backupReady ? "יש להגדיר את משתני הסביבה ולחבר Google Drive תחילה" : undefined}
              className="px-4 py-2 bg-navy text-white text-sm font-medium rounded hover:bg-navy-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {backing ? "מגבה..." : "צור גיבוי עכשיו"}
            </button>

            {result === "success" && (
              <span className="text-sm text-green-700 font-medium">✓ גיבוי נוצר בהצלחה</span>
            )}
            {result === "error" && (
              <span className="text-sm text-red-600 font-medium">✗ הגיבוי נכשל — נסה שוב</span>
            )}
          </div>
        </section>

      </div>
    </div>
  )
}

// ─── Page wrapper (Suspense required for useSearchParams) ─────────────────────

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsInner />
    </Suspense>
  )
}
