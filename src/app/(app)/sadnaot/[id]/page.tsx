"use client"

import Link from "next/link"
import { useParams } from "next/navigation"

export default function WorkshopDetailStub() {
  const { id } = useParams<{ id: string }>()
  return (
    <div className="flex flex-col h-full">
      <div className="px-8 pt-5 pb-2 text-sm text-gray-400">
        <Link href="/sadnaot" className="hover:text-gray-700">סדנאות</Link>
        {" / "}
        <span className="text-gray-700">פרטי סדנה</span>
      </div>
      <div className="px-8 pt-6">
        <p className="text-sm text-gray-400">פרטי הסדנה יבנו בסשן 8. מזהה: {id}</p>
      </div>
    </div>
  )
}