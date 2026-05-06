import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/AppShell"
import { UserProvider } from "./user-context"

const VERSION = "0.1.0"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  return (
    <UserProvider user={session.user}>
      <AppShell user={session.user} version={VERSION}>
        {children}
      </AppShell>
    </UserProvider>
  )
}
