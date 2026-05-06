import Link from "next/link"

export default function UnauthorizedPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-white" dir="rtl">
      <div className="text-center">
        <p className="text-5xl font-bold text-gray-200 mb-4">403</p>
        <h1 className="text-xl font-semibold text-gray-700 mb-2">אין הרשאה לדף זה</h1>
        <p className="text-sm text-gray-400 mb-6">התפקיד שלך אינו מורשה לגשת לכתובת זו.</p>
        <Link
          href="/sadnaot"
          className="text-sm text-[#2C4B9A] hover:underline"
        >
          חזרה לסדנאות
        </Link>
      </div>
    </main>
  )
}
