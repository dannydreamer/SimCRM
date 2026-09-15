"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { findDuplicateOrgs, type OrgSearchable } from "@/lib/org-search"

interface Props {
  /** The name being typed. */
  name: string
  /** The organization being renamed, so it does not match itself. */
  excludeId?: string
}

/**
 * Warns, while the name is still being typed, that an organization of that name
 * is already on file. Advisory only — nothing here blocks the save; two schools
 * really can share a name in two cities. The server repeats the check and asks
 * for one confirmation before creating an exact match.
 *
 * Renders nothing when the name is new, which is the usual case.
 */
export default function DuplicateOrgWarning({ name, excludeId }: Props) {
  const [orgs, setOrgs] = useState<OrgSearchable[]>([])

  useEffect(() => {
    let live = true
    fetch("/api/irgunnim")
      .then((r) => r.json())
      .then((data) => { if (live && Array.isArray(data)) setOrgs(data) })
      .catch(() => {})
    return () => { live = false }
  }, [])

  const dups = useMemo(
    () => findDuplicateOrgs(name, orgs, excludeId),
    [name, orgs, excludeId]
  )

  if (dups.length === 0) return null
  const hasExact = dups.some((d) => d.kind === "exact")

  return (
    <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2">
      <p className="text-sm font-medium text-amber-800">
        {hasExact ? "ארגון בשם זה כבר קיים במערכת" : "קיים ארגון בשם דומה"}
      </p>
      <ul className="mt-1 space-y-0.5">
        {dups.map(({ org }) => (
          <li key={org.id} className="text-sm text-amber-700">
            <Link
              href={`/irgunnim/${org.id}`}
              target="_blank"
              className="underline hover:text-amber-900"
            >
              {org.name}
            </Link>
            {" · "}{org.city}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-amber-700">
        אם זה אותו ארגון — עדיף להוסיף לו קבוצה במקום לפתוח ארגון נוסף.
      </p>
    </div>
  )
}
