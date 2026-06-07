import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { dumpDatabase, uploadToDrive, buildFilename, getBackupWarning } from "@/lib/backup"

export const maxDuration = 300 // 5 minutes — Vercel Pro limit


export async function GET(req: NextRequest) {
  // Verify this is a legitimate Vercel cron request
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (getBackupWarning() !== null) {
    return NextResponse.json({ error: "Backup env vars not configured" }, { status: 500 })
  }

  const filename = buildFilename()

  try {
    const sql = await dumpDatabase()
    const { fileSize } = await uploadToDrive(sql, filename, "daily")

    await prisma.backupLog.create({
      data: { type: "AUTO", status: "SUCCESS", filePath: filename, fileSize },
    })

    return NextResponse.json({ ok: true, filename, fileSize })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    await prisma.backupLog.create({
      data: { type: "AUTO", status: "FAILED", filePath: filename, errorMsg },
    })
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
