import { getServerSession } from "next-auth"
import { notFound } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { CAN_GENERATE_DECKS, hasAny } from "@/lib/roles"
import { DeckStudio } from "./DeckStudio"

// The facilitator-deck screen — spec §14 F-06. Managers and Techs; reached
// from the rooms card on Workshop Detail, which passes ?workshop=. Not in the
// nav. Everyone else gets the ordinary 404.
export default async function MatzgotPage({ searchParams }: { searchParams: Promise<{ workshop?: string }> }) {
  const session = await getServerSession(authOptions)
  if (!hasAny(session?.user?.roles ?? [], CAN_GENERATE_DECKS)) notFound()
  const { workshop } = await searchParams
  return <DeckStudio key={workshop ?? ""} workshopId={workshop ?? null} />
}
