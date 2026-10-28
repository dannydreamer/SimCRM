// Who may use the facilitator-deck generator — spec §14 F-06, "Access".
//
// The pilot is one account. Every /api/matzgot route checks this on the server;
// the /matzgot page answers 404 to anyone else and is not in the nav, so the
// feature is invisible rather than merely hidden. Widening the pilot means
// changing this check, not the routes.

export const DECK_PILOT_EMAILS = ["daniel.prag@gmail.com"]

export function isDeckPilot(user: { email?: string | null } | null | undefined): boolean {
  const email = user?.email?.trim().toLowerCase()
  return !!email && DECK_PILOT_EMAILS.includes(email)
}

/** A shared deck may be downloaded by any Tech (a Senior Tech holds TECH by implication, §5.4). */
export function canDownloadSharedDeck(roles: string[]): boolean {
  return roles.includes("TECH")
}
