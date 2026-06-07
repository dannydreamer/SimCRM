"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { NAV_ITEMS, ROLE_LABELS } from "@/lib/roles"

interface AppShellProps {
  user: {
    name: string
    email: string
    roles: string[]
  }
  version: string
  backupWarning?: "missing_env" | null
  children: React.ReactNode
}

export function AppShell({ user, version, backupWarning, children }: AppShellProps) {
  const pathname = usePathname()

  const visibleNav = NAV_ITEMS.filter((item) =>
    item.roles.some((r) => user.roles.includes(r))
  )

  const roleLabels = user.roles
    .map((r) => ROLE_LABELS[r] ?? r)
    .join(", ")

  return (
    <div className="min-h-screen flex flex-col bg-white" dir="rtl">
      {/* Header */}
      <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 shrink-0">
        {/* Right: logo + system name */}
        <div className="flex items-center gap-3 flex-1">
          <Image
            src="/logo.png"
            alt="כיתקטיקה"
            width={36}
            height={36}
            className="object-contain"
          />
          <span className="text-sm font-semibold text-gray-500 tracking-wide">
            מערכת ניהול
          </span>
        </div>

        {/* Left: user info + logout */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <span className="font-medium">{user.name}</span>
            {roleLabels && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-navy-light text-navy">
                {roleLabels}
              </span>
            )}
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
          >
            יציאה
          </button>
        </div>
      </header>

      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 px-6 flex items-center gap-1 h-10 shrink-0">
        {visibleNav.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                active
                  ? "bg-navy-light text-navy"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Backup warning banner — Manager only, not dismissible */}
      {backupWarning === "missing_env" && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 text-sm text-amber-800 shrink-0">
          ⚠ משתני הסביבה לגיבוי חסרים — הגיבוי האוטומטי אינו פעיל. יש להגדיר{" "}
          <code className="font-mono bg-amber-100 px-1 rounded text-xs">GOOGLE_CLIENT_ID</code>{" "}
          ו-<code className="font-mono bg-amber-100 px-1 rounded text-xs">GOOGLE_CLIENT_SECRET</code> ב-Vercel.
        </div>
      )}

      {/* Page content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>

      {/* Footer */}
      <footer className="shrink-0 px-6 py-2 flex justify-start">
        <span className="text-xs text-gray-400">v{version}</span>
      </footer>
    </div>
  )
}
