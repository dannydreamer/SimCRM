import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/AppShell"
import { UserProvider } from "./user-context"
import { getBackupWarning, maybeAutoBackup } from "@/lib/backup"

const VERSION = "0.1.0"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  // Show backup warning banner to Managers if env vars are missing/invalid
  const isManager = session.user.roles.includes("MANAGER")
  const backupWarning = isManager ? getBackupWarning() : null
  if (isManager) void maybeAutoBackup()

  return (
    <UserProvider user={session.user}>
      <AppShell user={session.user} version={VERSION} backupWarning={backupWarning}>
        {children}
      </AppShell>
    </UserProvider>
  )
}
