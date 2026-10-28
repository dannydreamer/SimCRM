import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { canDownloadSharedDeck } from "@/lib/deck/access"
import { sharedDeck, toMeta } from "@/lib/deck/files"

// The deck shared with the Techs for one workshop, if any — read by the
// tucked-away link on Workshop Detail. Everyone else gets null, so the link
// stays absent rather than failing. §14 F-06.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const workshopId = req.nextUrl.searchParams.get("workshopId")
  if (!workshopId || !canDownloadSharedDeck(session.user.roles))
    return NextResponse.json({ deck: null })
  const deck = await sharedDeck(workshopId)
  return NextResponse.json({ deck: deck ? toMeta(deck) : null })
}
