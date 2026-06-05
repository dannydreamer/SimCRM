import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { dumpDatabase, uploadToDrive, pruneOldDailyBackups, buildFilename, getBackupWarning } from "@/lib/backup"

export const maxDuration = 300 // 5 minutes — Vercel Pro limit

const MIN_FILE_SIZE = 10 * 1024 // 10 KB

export async function GET(req: NextRequest) {
  // Verify this is a legitimate Vercel cron request
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check backup env vars before attempting
  if (getBackupWarning() !== null) {
    return NextResponse.json({ error: "Backup env vars not configured" }, { status: 500 })
  }

  const filename = buildFilename()

  try {
    const sql = await dumpDatabase()
    const { fileSize } = await uploadToDrive(sql, filename, "daily")

    // Verify file isn't suspiciously small
    if (fileSize < MIN_FILE_SIZE) {
      await prisma.backupLog.create({
        data: {
          type: "AUTO",
          status: "FAILED",
          filePath: filename,
          fileSize,
          errorMsg: `גיבוי חשוד כקטן מדי: ${fileSize} bytes (מינימום ${MIN_FILE_SIZE})`,
        },
      })
      return NextResponse.json({ error: "Backup file too small" }, { status: 500 })
    }

    // Prune old daily backups (keep last 30)
    await pruneOldDailyBackups()

    await prisma.backupLog.create({
      data: {
        type: "AUTO",
        status: "SUCCESS",
        filePath: filename,
        fileSize,
      },
    })

    return NextResponse.json({ ok: true, filename, fileSize })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)

    await prisma.backupLog.create({
      data: {
        type: "AUTO",
        status: "FAILED",
        filePath: filename,
        errorMsg,
      },
    })

    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
