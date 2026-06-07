import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { dumpDatabase, uploadToDrive, buildFilename, getBackupWarning, getDriveConnectionStatus } from "@/lib/backup"

export const maxDuration = 300

const MIN_FILE_SIZE = 10 * 1024 // 10 KB

// ─── GET — backup + Drive status ─────────────────────────────────────────────

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!session.user.roles.includes("MANAGER"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const [lastSuccess, lastLog, totalCount, driveStatus] = await Promise.all([
    prisma.backupLog.findFirst({ where: { status: "SUCCESS" }, orderBy: { createdAt: "desc" } }),
    prisma.backupLog.findFirst({ orderBy: { createdAt: "desc" } }),
    prisma.backupLog.count(),
    getDriveConnectionStatus(),
  ])

  return NextResponse.json({
    lastSuccess: lastSuccess
      ? { date: lastSuccess.createdAt.toISOString(), fileSize: lastSuccess.fileSize, type: lastSuccess.type }
      : null,
    lastStatus: lastLog?.status ?? null,
    lastError:  lastLog?.status === "FAILED" ? lastLog.errorMsg : null,
    lastDate:   lastLog?.createdAt.toISOString() ?? null,
    totalCount,
    envWarning:     getBackupWarning(),
    driveConnected: driveStatus.connected,
    driveFolderId:  driveStatus.driveFolderId,
  })
}

// ─── POST — manual backup ─────────────────────────────────────────────────────

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!session.user.roles.includes("MANAGER"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (getBackupWarning() !== null)
    return NextResponse.json({ error: "Backup env vars not configured" }, { status: 400 })

  const { connected } = await getDriveConnectionStatus()
  if (!connected)
    return NextResponse.json({ error: "Google Drive not connected" }, { status: 400 })

  const filename = buildFilename()

  try {
    const sql = await dumpDatabase()
    const { fileSize } = await uploadToDrive(sql, filename, "manual")

    if (fileSize < MIN_FILE_SIZE) {
      await prisma.backupLog.create({
        data: { type: "MANUAL", status: "FAILED", filePath: filename, fileSize,
          errorMsg: `גיבוי חשוד כקטן מדי: ${fileSize} bytes` },
      })
      return NextResponse.json({ error: "Backup file too small" }, { status: 500 })
    }

    await prisma.backupLog.create({
      data: { type: "MANUAL", status: "SUCCESS", filePath: filename, fileSize },
    })
    return NextResponse.json({ ok: true, filename, fileSize })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    await prisma.backupLog.create({
      data: { type: "MANUAL", status: "FAILED", filePath: filename, errorMsg },
    })
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
