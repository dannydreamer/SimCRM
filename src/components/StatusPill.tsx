const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  NEW:       { label: "סדנה חדשה",          className: "bg-gray-100 text-gray-500" },
  SPECIFIED: { label: "בוצע איתור צרכים",   className: "bg-navy-light text-navy" },
  READY:     { label: "מוכן",               className: "bg-rag-green text-brand-green-dark" },
  CLOSING:   { label: "בתהליך סגירה",       className: "bg-rag-amber text-rag-amber-text" },
  CLOSED:    { label: "סגור",               className: "bg-gray-200 text-gray-600" },
  CANCELLED: { label: "בוטל",               className: "bg-red-100 text-red-600" },
}

export function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, className: "bg-gray-100 text-gray-500" }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

export { STATUS_CONFIG }
