import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getGoogleAuthUrl, getBackupWarning } from "@/lib/backup"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!session.user.roles.includes("MANAGER"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (getBackupWarning() === "missing_env")
    return NextResponse.json({ error: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set" }, { status: 500 })

  const url = getGoogleAuthUrl()
  return NextResponse.redirect(url)
}
