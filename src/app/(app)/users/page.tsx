"use client"

import { useEffect, useState } from "react"
import { ROLE_LABELS, LOGIN_ROLES } from "@/lib/roles"

interface UserRecord {
  id: string
  name: string
  email: string
  active: boolean
  mustChangePassword: boolean
  roles: string[]
}

type FormMode = "create" | "edit"

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  roles: [] as string[],
  newPassword: "",
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [formMode, setFormMode] = useState<FormMode | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [deactivateConfirm, setDeactivateConfirm] = useState<string | null>(null)
  const [showPasswordReset, setShowPasswordReset] = useState(false)

  async function fetchUsers() {
    setLoading(true)
    const res = await fetch("/api/users")
    if (res.ok) setUsers(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  function openCreate() {
    setForm({ ...EMPTY_FORM })
    setEditingId(null)
    setFormMode("create")
    setError("")
    setShowPasswordReset(false)
  }

  function openEdit(user: UserRecord) {
    setForm({ name: user.name, email: user.email, password: "", roles: [...user.roles], newPassword: "" })
    setEditingId(user.id)
    setFormMode("edit")
    setError("")
    setShowPasswordReset(false)
  }

  function closeForm() {
    setFormMode(null)
    setEditingId(null)
    setError("")
    setShowPasswordReset(false)
  }

  function toggleRole(role: string) {
    setForm((f) => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter((r) => r !== role) : [...f.roles, role],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!form.name.trim() || !form.email.trim()) { setError("שם ואימייל הם שדות חובה"); return }
    if (formMode === "create" && !form.password.trim()) { setError("סיסמה זמנית היא שדה חובה"); return }
    if (!form.roles.length) { setError("יש לבחור תפקיד אחד לפחות"); return }
    setSaving(true)

    const url = formMode === "create" ? "/api/users" : `/api/users/${editingId}`
    const method = formMode === "create" ? "POST" : "PATCH"
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      email: form.email.trim(),
      roles: form.roles,
    }
    if (formMode === "create") body.password = form.password.trim()
    if (formMode === "edit" && showPasswordReset && form.newPassword.trim()) {
      body.newPassword = form.newPassword.trim()
    }

    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? "שגיאה בשמירה")
    } else {
      await fetchUsers()
      closeForm()
    }
    setSaving(false)
  }

  async function toggleActive(user: UserRecord) {
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !user.active }),
    })
    if (res.ok) {
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, active: !u.active } : u))
    }
    setDeactivateConfirm(null)
  }

  const activeUsers = users.filter((u) => u.active)
  const inactiveUsers = users.filter((u) => !u.active)

  return (
    <div className="p-8 max-w-5xl">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ניהול משתמשים</h1>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} משתמשים במערכת</p>
        </div>
        {formMode === null && (
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-[#2C4B9A] text-white text-sm font-medium rounded hover:bg-[#243d80] transition-colors"
          >
            + הוספת משתמש
          </button>
        )}
      </div>

      {/* Create / Edit form */}
      {formMode !== null && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 border border-gray-200 rounded-lg p-6 bg-gray-50"
        >
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            {formMode === "create" ? "משתמש חדש" : "עריכת משתמש"}
          </h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">שם מלא *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2C4B9A]/30"
                placeholder="שם מלא"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">אימייל *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2C4B9A]/30"
                placeholder="user@simcenter.co.il"
                dir="ltr"
                required
              />
            </div>
          </div>

          {formMode === "create" && (
            <div className="mb-4">
              <label className="block text-sm text-gray-700 mb-1">סיסמה זמנית *</label>
              <input
                type="text"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2C4B9A]/30"
                placeholder="המשתמש יתבקש להחליף בהתחברות הראשונה"
                dir="ltr"
                required
              />
            </div>
          )}

          {formMode === "edit" && (
            <div className="mb-4">
              {!showPasswordReset ? (
                <button
                  type="button"
                  onClick={() => setShowPasswordReset(true)}
                  className="text-sm text-[#2C4B9A] hover:underline"
                >
                  איפוס סיסמה
                </button>
              ) : (
                <div>
                  <label className="block text-sm text-gray-700 mb-1">סיסמה זמנית חדשה</label>
                  <input
                    type="text"
                    value={form.newPassword}
                    onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2C4B9A]/30"
                    placeholder="המשתמש יתבקש להחליף בהתחברות הבאה"
                    dir="ltr"
                  />
                </div>
              )}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm text-gray-700 mb-2">תפקידים *</label>
            <div className="flex flex-wrap gap-3">
              {LOGIN_ROLES.map((role) => (
                <label key={role} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.roles.includes(role)}
                    onChange={() => toggleRole(role)}
                    className="accent-[#2C4B9A]"
                  />
                  <span className="text-sm text-gray-700">{ROLE_LABELS[role]}</span>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 mb-3">{error}</p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-[#2C4B9A] text-white text-sm font-medium rounded hover:bg-[#243d80] disabled:opacity-50 transition-colors"
            >
              {saving ? "שומר..." : "שמירה"}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="text-sm text-gray-500 hover:text-gray-800"
            >
              ביטול
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">טוען...</p>
      ) : (
        <>
          {/* Active users table */}
          <UserTable
            users={activeUsers}
            onEdit={openEdit}
            deactivateConfirm={deactivateConfirm}
            setDeactivateConfirm={setDeactivateConfirm}
            onToggleActive={toggleActive}
          />

          {/* Inactive users */}
          {inactiveUsers.length > 0 && (
            <div className="mt-8">
              <h2 className="text-sm font-medium text-gray-500 mb-3">משתמשים לא פעילים ({inactiveUsers.length})</h2>
              <UserTable
                users={inactiveUsers}
                onEdit={openEdit}
                deactivateConfirm={deactivateConfirm}
                setDeactivateConfirm={setDeactivateConfirm}
                onToggleActive={toggleActive}
                dimmed
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function UserTable({
  users,
  onEdit,
  deactivateConfirm,
  setDeactivateConfirm,
  onToggleActive,
  dimmed = false,
}: {
  users: UserRecord[]
  onEdit: (u: UserRecord) => void
  deactivateConfirm: string | null
  setDeactivateConfirm: (id: string | null) => void
  onToggleActive: (u: UserRecord) => void
  dimmed?: boolean
}) {
  if (!users.length) return null

  return (
    <div className={`border border-gray-200 rounded-lg overflow-hidden ${dimmed ? "opacity-60" : ""}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-right">
            <th className="px-4 py-3 font-medium">שם מלא</th>
            <th className="px-4 py-3 font-medium">אימייל</th>
            <th className="px-4 py-3 font-medium">תפקידים</th>
            <th className="px-4 py-3 font-medium">סטטוס</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">{user.name}</td>
              <td className="px-4 py-3 text-gray-500" dir="ltr">{user.email}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {user.roles.map((role) => (
                    <span
                      key={role}
                      className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#EEF2FF] text-[#2C4B9A]"
                    >
                      {ROLE_LABELS[role] ?? role}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3">
                {user.active ? (
                  <span className="text-xs text-green-700 font-medium">
                    {user.mustChangePassword ? "ממתין להחלפת סיסמה" : "פעיל"}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">לא פעיל</span>
                )}
              </td>
              <td className="px-4 py-3">
                {deactivateConfirm === user.id ? (
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">
                      {user.active ? "להשבית?" : "להפעיל?"}
                    </span>
                    <button
                      onClick={() => onToggleActive(user)}
                      className="text-xs text-red-600 hover:underline font-medium"
                    >
                      כן
                    </button>
                    <button
                      onClick={() => setDeactivateConfirm(null)}
                      className="text-xs text-gray-500 hover:underline"
                    >
                      לא
                    </button>
                  </span>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onEdit(user)}
                      className="text-xs text-[#2C4B9A] hover:underline"
                    >
                      עריכה
                    </button>
                    <button
                      onClick={() => setDeactivateConfirm(user.id)}
                      className="text-xs text-gray-400 hover:text-gray-700 hover:underline"
                    >
                      {user.active ? "השבתה" : "הפעלה"}
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
