import { Client } from "pg"
import { google } from "googleapis"
import { Readable } from "stream"

// ─── Table dump order (respects FK dependencies) ─────────────────────────────

const TABLE_ORDER = [
  "Person", "PersonRole", "Organization", "ParticipantGroup",
  "Workshop", "Room", "Topic", "Scenario", "Actor", "Casting",
  "ActorWorkshopAvailability", "WorkshopConfirmedActor", "CastingChangeLog",
  "Feedback", "ActorDevelopmentLog", "AnnualGoal", "BackupLog",
]

// ─── SQL value escaping ───────────────────────────────────────────────────────

function escapeSqlValue(val: unknown): string {
  if (val === null || val === undefined) return "NULL"
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE"
  if (typeof val === "number") return String(val)
  if (val instanceof Date) return `'${val.toISOString()}'`
  // String — escape single quotes by doubling them
  return `'${String(val).replace(/'/g, "''")}'`
}

// ─── Database dump ────────────────────────────────────────────────────────────

export async function dumpDatabase(): Promise<string> {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL
  const client = new Client({ connectionString })
  await client.connect()

  try {
    const now = new Date().toISOString()
    let sql = `-- SimCRM Database Backup\n-- Generated: ${now}\n-- Format: INSERT statements (restore after applying migrations)\n\n`
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

// ─── Google Drive helpers ─────────────────────────────────────────────────────

function getDriveClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!)
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  })
  return google.drive({ version: "v3", auth })
}

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

// ─── Upload ───────────────────────────────────────────────────────────────────

export async function uploadToDrive(
  content: string,
  filename: string,
  subfolder: "daily" | "manual"
): Promise<{ fileId: string; fileSize: number }> {
  const drive = getDriveClient()
  const parentId = process.env.BACKUP_FOLDER_ID!
  const subfolderId = await getOrCreateSubfolder(drive, parentId, subfolder)

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [subfolderId],
    },
    media: {
      mimeType: "text/plain",
      body: Readable.from([content]),
    },
    fields: "id,size",
  })

  return {
    fileId: res.data.id!,
    fileSize: parseInt(res.data.size ?? "0", 10),
  }
}

// ─── Retention: delete daily backups older than 30 days ──────────────────────

export async function pruneOldDailyBackups(): Promise<void> {
  const drive = getDriveClient()
  const parentId = process.env.BACKUP_FOLDER_ID!
  const dailyFolderId = await getOrCreateSubfolder(drive, parentId, "daily")

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const res = await drive.files.list({
    q: `'${dailyFolderId}' in parents and createdTime < '${cutoff}' and trashed=false`,
    fields: "files(id)",
  })
  for (const file of res.data.files ?? []) {
    await drive.files.delete({ fileId: file.id! })
  }
}

// ─── Filename generator ───────────────────────────────────────────────────────

export function buildFilename(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  const date = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`
  const time = `${pad(now.getUTCHours())}-${pad(now.getUTCMinutes())}`
  return `simcrm_backup_${date}_${time}.sql`
}

// ─── Env / credentials check ──────────────────────────────────────────────────

export type BackupWarning = "missing_env" | "invalid_key" | null

export function getBackupWarning(): BackupWarning {
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  const folderId = process.env.BACKUP_FOLDER_ID

  if (!key || !folderId) return "missing_env"

  try {
    const parsed = JSON.parse(key)
    if (!parsed.client_email || !parsed.private_key) return "invalid_key"
    return null
  } catch {
    return "invalid_key"
  }
}
