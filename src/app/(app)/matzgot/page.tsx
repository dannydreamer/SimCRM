import { getServerSession } from "next-auth"
import { notFound } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { isDeckPilot } from "@/lib/deck/access"
import { DeckStudio } from "./DeckStudio"

// The facilitator-deck generator — spec §14 F-06. Pilot only: anyone else gets
// the ordinary 404, and the page is not in the nav.
export default async function MatzgotPage() {
  const session = await getServerSession(authOptions)
  if (!isDeckPilot(session?.user)) notFound()
  return <DeckStudio />
}
