import { Client } from "pg"
import { google } from "googleapis"
import { Readable } from "stream"
import { prisma } from "@/lib/prisma"

// ─── Table dump order (respects FK dependencies) ─────────────────────────────

const TABLE_ORDER = [
  "Person", "PersonRole", "Organization", "ParticipantGroup",
  "Workshop", "Room", "Topic", "Scenario", "Actor", "Casting",
  "ActorWorkshopAvailability", "WorkshopConfirmedActor", "CastingChangeLog",
  "Feedback", "ActorDevelopmentLog", "AnnualGoal", "AppSettings", "BackupLog",
]

// ─── SQL value escaping ───────────────────────────────────────────────────────

function escapeSqlValue(val: unknown): string {
  if (val === null || val === undefined) return "NULL"
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE"
  if (typeof val === "number") return String(val)
  if (val instanceof Date) return `'${val.toISOString()}'`
  return `'${String(val).replace(/'/g, "''")}'`
}

// ─── Database dump ────────────────────────────────────────────────────────────

export async function dumpDatabase(): Promise<string> {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL
  const client = new Client({ connectionString })
  await client.connect()

  try {
    const now = new Date().toISOString()
    let sql = `-- SimCRM Database Backup\n-- Generated: ${now}\n-- Restore: apply migrations first, then run this file\n\n`
    sql += `SET session_replication_role = replica; -- disable FK checks during restore\n\n`

    for (const table of TABLE_ORDER) {
      const { rows } = await client.query(`SELECT * FROM "${table}"`)
      if (rows.length === 0) continue

      sql += `-- ${table} (${rows.length} rows)\n`
      for (const row of rows) {
        const cols = Object.keys(row).map((c) => `"${c}"`).join(", ")
        const vals = Object.values(row).map((v) => escapeSqlValue(v)).join(", ")
        sql += `INSERT INTO "${table}" (${cols}) VALUES (${vals}) ON CONFLICT DO NOTHING;\n`
      }
      sql += "\n"
    }

    sql += `SET session_replication_role = DEFAULT;\n`
    return sql
  } finally {
    await client.end()
  }
}

// ─── OAuth2 client ────────────────────────────────────────────────────────────

function buildOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/google-drive/callback`
  )
}

export function getGoogleAuthUrl(): string {
  const client = buildOAuth2Client()
  return client.generateAuthUrl({
    access_type: "offline",
    scope: "https://www.googleapis.com/auth/drive.file",
    prompt: "consent", // always return refresh_token
  })
}

export async function exchangeCodeForTokens(code: string) {
  const client = buildOAuth2Client()
  const { tokens } = await client.getToken(code)
  return tokens
}

// ─── Drive client (uses stored OAuth tokens) ──────────────────────────────────

async function getDriveClient() {
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } })
  if (!settings?.googleAccessToken || !settings.googleRefreshToken) {
    throw new Error("Google Drive not connected — complete OAuth setup in Settings")
  }

  const oauth2Client = buildOAuth2Client()
  oauth2Client.setCredentials({
    access_token:  settings.googleAccessToken,
    refresh_token: settings.googleRefreshToken,
    expiry_date:   settings.googleTokenExpiry?.getTime(),
  })

  // Proactively refresh if token expires within the next 2 minutes
  const expiry = settings.googleTokenExpiry?.getTime() ?? 0
  if (expiry < Date.now() + 2 * 60 * 1000) {
    const { credentials } = await oauth2Client.refreshAccessToken()
    await prisma.appSettings.update({
      where: { id: 1 },
      data: {
        googleAccessToken:  credentials.access_token   ?? settings.googleAccessToken,
        googleTokenExpiry:  credentials.expiry_date    ? new Date(credentials.expiry_date) : null,
        ...(credentials.refresh_token && { googleRefreshToken: credentials.refresh_token }),
      },
    })
    oauth2Client.setCredentials(credentials)
  }

  return google.drive({ version: "v3", auth: oauth2Client })
}

// ─── Folder helpers ───────────────────────────────────────────────────────────

async function getOrCreateSubfolder(
  drive: ReturnType<typeof google.drive>,
  parentId: string,
  name: string
): Promise<string> {
  const res = await drive.files.list({
    q: `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id)",
  })
  if (res.data.files?.length) return res.data.files[0].id!

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
  })
  return created.data.id!
}

// Ensure the root SimCRM Files folder exists; create and save it if not.
async function getRootFolderId(drive: ReturnType<typeof google.drive>): Promise<string> {
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } })

  if (settings?.driveFolderId) return settings.driveFolderId

  // Create the root folder
  const created = await drive.files.create({
    requestBody: { name: "SimCRM Files", mimeType: "application/vnd.google-apps.folder" },
    fields: "id",
  })
  const folderId = created.data.id!

  await prisma.appSettings.upsert({
    where:  { id: 1 },
    update: { driveFolderId: folderId },
    create: { id: 1, driveFolderId: folderId },
  })

  return folderId
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export async function uploadToDrive(
  content: string,
  filename: string,
  subfolder: "daily" | "manual"
): Promise<{ fileId: string; fileSize: number }> {
  const drive = await getDriveClient()
  const rootId = await getRootFolderId(drive)
  const subfolderId = await getOrCreateSubfolder(drive, rootId, subfolder)

  const res = await drive.files.create({
    requestBody: { name: filename, parents: [subfolderId] },
    media: { mimeType: "text/plain", body: Readable.from([content]) },
    fields: "id,size",
  })

  return {
    fileId:   res.data.id!,
    fileSize: parseInt(res.data.size ?? "0", 10),
  }
}

// ─── Filename ─────────────────────────────────────────────────────────────────

export function buildFilename(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  const date = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`
  const time = `${pad(now.getUTCHours())}-${pad(now.getUTCMinutes())}`
  return `simcrm_backup_${date}_${time}.sql`
}

// ─── Env / connection check ───────────────────────────────────────────────────

export type BackupWarning = "missing_env" | null

export function getBackupWarning(): BackupWarning {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return "missing_env"
  }
  return null
}

// Drive connection status — requires DB, used only on Settings page
export async function getDriveConnectionStatus(): Promise<{
  connected: boolean
  driveFolderId: string | null
}> {
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } })
  return {
    connected:     !!(settings?.googleAccessToken && settings.googleRefreshToken),
    driveFolderId: settings?.driveFolderId ?? null,
  }
}
