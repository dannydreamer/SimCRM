import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const workshops = await prisma.workshop.findMany({
    orderBy: { date: "asc" },
    include: {
      participantGroup: {
        include: { organization: { select: { id: true, name: true } } },
      },
      author: { select: { name: true } },
    },
  })

  return NextResponse.json(
    workshops.map((w) => ({
      id:          w.id,
      date:        w.date.toISOString(),
      startTime:   w.startTime,
      endTime:     w.endTime,
      numRooms:    w.numRooms,
      status:      w.status,
      tentative:   w.tentative,
      cancelled:   w.cancelled,
      groupName:   w.participantGroup.name,
      orgId:       w.participantGroup.organization.id,
      orgName:     w.participantGroup.organization.name,
      authorName:  w.author?.name ?? null,
    }))
  )
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!session.user.roles.includes("MANAGER")) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 })
  }

  const {
    organizationId,
    groupId,
    groupName,
    date,
    startTime,
    endTime,
    numRooms,
    locationType,
    locationName,
    authorId,
    directorRequested,
    tentative,
    notes,
  } = await req.json()

  if (!organizationId)           return NextResponse.json({ error: "יש לבחור ארגון" }, { status: 400 })
  if (!groupId && !groupName?.trim()) return NextResponse.json({ error: "יש להזין שם קבוצה" }, { status: 400 })
  if (!date)                     return NextResponse.json({ error: "יש לבחור תאריך" }, { status: 400 })
  if (!startTime)                return NextResponse.json({ error: "יש להזין שעת התחלה" }, { status: 400 })
  if (!endTime)                  return NextResponse.json({ error: "יש להזין שעת סיום" }, { status: 400 })
  if (!numRooms || numRooms < 1) return NextResponse.json({ error: "יש להזין מספר חדרים" }, { status: 400 })

  let participantGroupId: string
  if (groupId) {
    participantGroupId = groupId
  } else {
    const trimmed = groupName.trim()
    const existing = await prisma.participantGroup.findMany({ where: { organizationId } })
    const match = existing.find((g) => g.name.trim().toLowerCase() === trimmed.toLowerCase())
    if (match) {
      participantGroupId = match.id
    } else {
      const newGroup = await prisma.participantGroup.create({ data: { organizationId, name: trimmed } })
      participantGroupId = newGroup.id
    }
  }

  const workshop = await prisma.workshop.create({
    data: {
      participantGroupId,
      date:               new Date(date),
      startTime,
      endTime,
      numRooms:           Number(numRooms),
      locationType:       locationType ?? "CENTER",
      locationName:       locationName?.trim() || null,
      authorId:           authorId || null,
      directorRequested:  Boolean(directorRequested),
      tentative:          Boolean(tentative),
      notes:              notes?.trim() || null,
      createdById:        session.user.id,
    },
  })

  return NextResponse.json({ id: workshop.id }, { status: 201 })
}
