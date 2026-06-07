import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { exchangeCodeForTokens } from "@/lib/backup"

export async function GET(req: NextRequest) {
  const code  = req.nextUrl.searchParams.get("code")
  const error = req.nextUrl.searchParams.get("error")
  const base  = process.env.NEXTAUTH_URL ?? req.nextUrl.origin

  if (error || !code) {
    return NextResponse.redirect(`${base}/settings?drive=error`)
  }

  try {
    const tokens = await exchangeCodeForTokens(code)

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(`${base}/settings?drive=error`)
    }

    await prisma.appSettings.upsert({
      where:  { id: 1 },
      update: {
        googleAccessToken:  tokens.access_token,
        googleRefreshToken: tokens.refresh_token,
        googleTokenExpiry:  tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
      create: {
        id:                 1,
        googleAccessToken:  tokens.access_token,
        googleRefreshToken: tokens.refresh_token,
        googleTokenExpiry:  tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
    })

    return NextResponse.redirect(`${base}/settings?drive=connected`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[drive/callback] token exchange failed:", msg)
    return NextResponse.redirect(`${base}/settings?drive=error&reason=${encodeURIComponent(msg)}`)
  }
}
