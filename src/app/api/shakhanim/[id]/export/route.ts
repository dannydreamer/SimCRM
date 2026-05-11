import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const RAG_LABEL: Record<string, string> = { GREEN: "ירוק", YELLOW: "צהוב", RED: "אדום" }

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const canExport =
    session.user.roles.includes("MANAGER") ||
    session.user.roles.includes("FEEDBACK_DOCUMENTER")
  if (!canExport) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  const actor = await prisma.actor.findUnique({
    where: { id },
    include: {
      feedbacks: {
        orderBy: { enteredAt: "desc" },
        include: {
          workshop: {
            include: {
              participantGroup: {
                include: { organization: { select: { name: true } } },
              },
            },
          },
          room:      { include: { facilitator: { select: { name: true } } } },
          enteredBy: { select: { name: true } },
        },
      },
    },
  })

  if (!actor) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const header = [
    "תאריך", "ארגון", "קבוצה", "מתחקר/ת", "הוזן ע\"י",
    "התכוננות", "הערות התכוננות",
    "שחקן כסימולטור", "הערות סימולטור",
    "שיקוף", "הערות שיקוף",
    "התנהלות מקצועית", "הערות מקצועית",
  ]

  const rows = actor.feedbacks.map((f) => [
    new Date(f.enteredAt).toLocaleDateString("he-IL"),
    f.workshop.participantGroup.organization.name,
    f.workshop.participantGroup.name,
    f.room.facilitator?.name ?? "",
    f.enteredBy.name,
    RAG_LABEL[f.aspect1PrepColor],         f.aspect1PrepText         ?? "",
    RAG_LABEL[f.aspect2SimColor],          f.aspect2SimText          ?? "",
    RAG_LABEL[f.aspect3ReflectionColor],   f.aspect3ReflectionText   ?? "",
    RAG_LABEL[f.aspect4ProfessionalColor], f.aspect4ProfessionalText ?? "",
  ])

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n")

  const filename = `feedback_${actor.name.replace(/\s+/g, "_")}.csv`

  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
