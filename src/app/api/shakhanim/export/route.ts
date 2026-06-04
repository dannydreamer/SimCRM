import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const RAG_LABEL: Record<string, string> = {
  GREEN:  "עומד בסטנדרט",
  YELLOW: "בעייתי",
  RED:    "חמור",
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const canExport =
    session.user.roles.includes("MANAGER") ||
    session.user.roles.includes("FEEDBACK_DOCUMENTER")
  if (!canExport) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const actors = await prisma.actor.findMany({
    orderBy: { name: "asc" },
    include: {
      feedbacks: {
        orderBy: { workshop: { date: "desc" } },
        include: {
          workshop: {
            include: {
              participantGroup: {
                include: { organization: { select: { name: true } } },
              },
            },
          },
          room: { include: { facilitator: { select: { name: true } } } },
        },
      },
    },
  })

  const header = [
    "שם שחקן/ית", "תאריך", "ארגון", "קבוצה", "מתחקר/ת", "תפקיד",
    "התכוננות - דירוג",       "התכוננות - הערות",
    "שחקן כסימולטור - דירוג", "שחקן כסימולטור - הערות",
    "שיקוף - דירוג",           "שיקוף - הערות",
    "התנהלות מקצועית - דירוג", "התנהלות מקצועית - הערות",
  ]

  const rows: string[][] = []

  for (const actor of actors) {
    for (const f of actor.feedbacks) {
      const d = new Date(f.workshop.date)
      const dateStr = `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`
      const isDirector = f.roomId === null
      rows.push([
        actor.name,
        dateStr,
        f.workshop.participantGroup.organization.name,
        f.workshop.participantGroup.name,
        f.room?.facilitator?.name ?? "",
        isDirector ? "במאי/ת" : "שחקן/ית",
        RAG_LABEL[f.aspect1PrepColor]         ?? f.aspect1PrepColor,         f.aspect1PrepText         ?? "",
        RAG_LABEL[f.aspect2SimColor]          ?? f.aspect2SimColor,          f.aspect2SimText          ?? "",
        RAG_LABEL[f.aspect3ReflectionColor]   ?? f.aspect3ReflectionColor,   f.aspect3ReflectionText   ?? "",
        RAG_LABEL[f.aspect4ProfessionalColor] ?? f.aspect4ProfessionalColor, f.aspect4ProfessionalText ?? "",
      ])
    }
  }

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n")

  const filename = "feedback_all_actors.csv"

  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}
