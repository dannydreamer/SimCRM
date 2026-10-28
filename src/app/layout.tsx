import type { Metadata } from "next"
import { Heebo } from "next/font/google"
import { Providers } from "./providers"
import { appearanceInitScript } from "@/lib/appearance"
import "./globals.css"

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "600", "700"],
})

export const metadata: Metadata = {
  title: "מערכת ניהול | כיתקטיקה",
  description: "מערכת ניהול פנימית למרכז סימולציה",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // suppressHydrationWarning: the init script sets data-theme before React
    // hydrates, so the attribute legitimately differs from the server's.
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceInitScript() }} />
      </head>
      <body className="min-h-full flex flex-col bg-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
