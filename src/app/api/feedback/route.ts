import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

function allowed(roles: string[]) {
  return roles.includes("MANAGER") || roles.includes("FEEDBACK_DOCUMENTER")
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!allowed(session.user.roles))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const workshopId = req.nextUrl.searchParams.get("workshopId")
  if (!workshopId) return NextResponse.json({ error: "workshopId required" }, { status: 400 })

  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    include: {
      participantGroup: {
        include: { organization: { select: { name: true } } },
      },
      rooms: {
        where: { cancelled: false },
        orderBy: { roomNumber: "asc" },
        include: {
          facilitator: { select: { name: true } },
          castings: {
            where: { isDirector: false },
            include: { actor: { select: { id: true, name: true } } },
          },
        },
      },
      feedbacks: {
        select: {
          id: true, actorId: true, roomId: true,
          aspect1PrepColor: true,       aspect1PrepText: true,
          aspect2SimColor: true,        aspect2SimText: true,
          aspect3ReflectionColor: true, aspect3ReflectionText: true,
          aspect4ProfessionalColor: true, aspect4ProfessionalText: true,
        },
      },
    },
  })

  if (!workshop) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const fbMap = new Map(workshop.feedbacks.map((f) => [`${f.roomId}:${f.actorId}`, f]))

  return NextResponse.json({
    id:        workshop.id,
    date:      workshop.date.toISOString(),
    groupName: workshop.participantGroup.name,
    orgName:   workshop.participantGroup.organization.name,
    rooms: workshop.rooms.map((room) => {
      // Deduplicate actors per room — actor may appear in multiple scenarios
      const actorMap = new Map<string, { id: string; name: string }>()
      room.castings.forEach((c) => actorMap.set(c.actorId, c.actor))

      return {
        id:              room.id,
        roomNumber:      room.roomNumber,
        facilitatorName: room.facilitator?.name ?? null,
        actors: Array.from(actorMap.values()).map((actor) => {
          const fb = fbMap.get(`${room.id}:${actor.id}`)
          return {
            actorId:   actor.id,
            actorName: actor.name,
            feedbackId:   fb?.id ?? null,
            aspect1Color: fb?.aspect1PrepColor          ?? "GREEN",
            aspect1Text:  fb?.aspect1PrepText           ?? "",
            aspect2Color: fb?.aspect2SimColor           ?? "GREEN",
            aspect2Text:  fb?.aspect2SimText            ?? "",
            aspect3Color: fb?.aspect3ReflectionColor    ?? "GREEN",
            aspect3Text:  fb?.aspect3ReflectionText     ?? "",
            aspect4Color: fb?.aspect4ProfessionalColor  ?? "GREEN",
            aspect4Text:  fb?.aspect4ProfessionalText   ?? "",
          }
        }),
      }
    }),
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!allowed(session.user.roles))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const {
    workshopId, roomId, actorId,
    aspect1Color = "GREEN", aspect1Text,
    aspect2Color = "GREEN", aspect2Text,
    aspect3Color = "GREEN", aspect3Text,
    aspect4Color = "GREEN", aspect4Text,
  } = await req.json()

  if (!workshopId || !roomId || !actorId)
    return NextResponse.json({ error: "workshopId, roomId, actorId required" }, { status: 400 })

  const updateData = {
    aspect1PrepColor:         aspect1Color,
    aspect1PrepText:          aspect1Text?.trim()  || null,
    aspect2SimColor:          aspect2Color,
    aspect2SimText:           aspect2Text?.trim()  || null,
    aspect3ReflectionColor:   aspect3Color,
    aspect3ReflectionText:    aspect3Text?.trim()  || null,
    aspect4ProfessionalColor: aspect4Color,
    aspect4ProfessionalText:  aspect4Text?.trim()  || null,
    enteredById:              session.user.id,
    enteredAt:                new Date(),
  }

  const existing = await prisma.feedback.findFirst({
    where: { workshopId, roomId, actorId },
    select: { id: true },
  })

  const result = existing
    ? await prisma.feedback.update({
        where: { id: existing.id },
        data:  updateData,
        select: { id: true },
      })
    : await prisma.feedback.create({
        data:   { workshopId, roomId, actorId, ...updateData },
        select: { id: true },
      })

  return NextResponse.json({ id: result.id })
}
