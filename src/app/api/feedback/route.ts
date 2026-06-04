import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { checkAndAdvanceStatus } from "@/lib/workshop-status"

function allowed(roles: string[]) {
  return roles.includes("MANAGER") || roles.includes("FEEDBACK_DOCUMENTER")
}

// Consistent key for fbMap: null roomId (director) uses literal "null"
function fbKey(roomId: string | null, actorId: string) {
  return `${roomId}:${actorId}`
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
      // Director casting — at most one per workshop, no roomId
      castings: {
        where: { isDirector: true },
        include: { actor: { select: { id: true, name: true } } },
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

  const fbMap = new Map(workshop.feedbacks.map((f) => [fbKey(f.roomId, f.actorId), f]))

  function actorFeedback(roomId: string | null, actorId: string, actorName: string) {
    const fb = fbMap.get(fbKey(roomId, actorId))
    return {
      actorId,
      actorName,
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
  }

  // Director (null roomId)
  const directorCasting = workshop.castings[0] ?? null
  const director = directorCasting
    ? actorFeedback(null, directorCasting.actor.id, directorCasting.actor.name)
    : null

  return NextResponse.json({
    id:        workshop.id,
    date:      workshop.date.toISOString(),
    groupName: workshop.participantGroup.name,
    orgName:   workshop.participantGroup.organization.name,
    director,
    rooms: workshop.rooms.map((room) => {
      // Deduplicate actors per room — actor may appear in multiple scenarios
      const actorMap = new Map<string, { id: string; name: string }>()
      room.castings.forEach((c) => actorMap.set(c.actorId, c.actor))

      return {
        id:              room.id,
        roomNumber:      room.roomNumber,
        facilitatorName: room.facilitator?.name ?? null,
        actors: Array.from(actorMap.values()).map((actor) =>
          actorFeedback(room.id, actor.id, actor.name)
        ),
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
    workshopId, roomId = null, actorId,
    aspect1Color = "GREEN", aspect1Text,
    aspect2Color = "GREEN", aspect2Text,
    aspect3Color = "GREEN", aspect3Text,
    aspect4Color = "GREEN", aspect4Text,
  } = await req.json()

  if (!workshopId || !actorId)
    return NextResponse.json({ error: "workshopId, actorId required" }, { status: 400 })

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
    where: {
      workshopId,
      actorId,
      // Prisma 7 requires { equals: null } to match NULL on a nullable field
      roomId: roomId != null ? roomId : { equals: null },
    },
    select: { id: true },
  })

  const result = existing
    ? await prisma.feedback.update({
        where: { id: existing.id },
        data:  updateData,
        select: { id: true },
      })
    : await prisma.feedback.create({
        data:   { workshopId, roomId: roomId ?? null, actorId, ...updateData },
        select: { id: true },
      })

  // Re-evaluate workshop status — editing feedback can advance CLOSING→CLOSED
  // or revert CLOSED→CLOSING if a record is cleared of all text
  await checkAndAdvanceStatus(workshopId)

  return NextResponse.json({ id: result.id })
}
