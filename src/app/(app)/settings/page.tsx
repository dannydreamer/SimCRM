"use client"

import { useEffect, useState } from "react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface BackupStatus {
  lastSuccess: { date: string; fileSize: number | null; type: string } | null
  lastStatus: "SUCCESS" | "FAILED" | null
  lastError: string | null
  lastDate: string | null
  totalCount: number
  warning: "missing_env" | "invalid_key" | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })
}

function formatFileSize(bytes: number | null) {
  if (bytes === null || bytes === 0) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [status, setStatus] = useState<BackupStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [backing, setBacking] = useState(false)
  const [result, setResult] = useState<"success" | "error" | null>(null)

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

  const backupDisabled = status?.warning !== null || backing

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 pt-6 pb-4 shrink-0">
        <h1 className="text-2xl font-bold text-gray-900">הגדרות</h1>
        <p className="text-sm text-gray-400 mt-0.5">ניהול מערכת וגיבויים</p>
      </div>

      <div className="flex-1 overflow-auto px-8 pb-8 space-y-6 max-w-2xl">

        {/* Backup config warning */}
        {status?.warning === "missing_env" && (
          <div className="border border-amber-200 bg-amber-50 rounded-lg px-5 py-4 text-sm text-amber-800">
            ⚠ משתני סביבה לגיבוי חסרים — הגיבוי האוטומטי אינו פעיל.
            יש להגדיר <code className="font-mono bg-amber-100 px-1 rounded">GOOGLE_SERVICE_ACCOUNT_KEY</code> ו-<code className="font-mono bg-amber-100 px-1 rounded">BACKUP_FOLDER_ID</code> ב-Vercel.
          </div>
        )}
        {status?.warning === "invalid_key" && (
          <div className="border border-amber-200 bg-amber-50 rounded-lg px-5 py-4 text-sm text-amber-800">
            ⚠ אימות חשבון הגיבוי נכשל — יש לבדוק את תקינות <code className="font-mono bg-amber-100 px-1 rounded">GOOGLE_SERVICE_ACCOUNT_KEY</code> ב-Vercel.
          </div>
        )}

        {/* Backup status card */}
        <section className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-5 py-3">
            <h2 className="text-sm font-semibold text-gray-700">מצב גיבויים</h2>
          </div>

          {loading ? (
            <div className="px-5 py-8 text-sm text-gray-400 text-center">טוען...</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {/* Last backup status */}
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

              {/* Last successful backup */}
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

              {/* Error message if last failed */}
              {status?.lastStatus === "FAILED" && status.lastError && (
                <div className="px-5 py-3 flex items-start justify-between gap-4">
                  <span className="text-sm text-gray-600 shrink-0">שגיאה</span>
                  <span className="text-sm text-red-600 text-left font-mono break-all">{status.lastError}</span>
                </div>
              )}

              {/* Total count */}
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
              title={status?.warning !== null ? "יש להגדיר את משתני הסביבה תחילה" : undefined}
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
          {status?.warning !== null && !loading && (
            <div className="px-5 pb-4">
              <p className="text-xs text-gray-400">
                הגיבוי הידני אינו זמין עד שמשתני הסביבה יוגדרו.
              </p>
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
