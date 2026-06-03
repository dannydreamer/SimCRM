import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const canSeeFeedback =
    session.user.roles.includes("MANAGER") ||
    session.user.roles.includes("FEEDBACK_DOCUMENTER")

  const actor = await prisma.actor.findUnique({
    where: { id },
    include: {
      ...(canSeeFeedback && {
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
            room: {
              include: { facilitator: { select: { name: true } } },
            },
            enteredBy: { select: { name: true } },
          },
        },
        developmentLogs: {
          orderBy: { date: "asc" },
          include: { enteredBy: { select: { name: true } } },
        },
      }),
      castings: {
        select: { workshop: { select: { date: true } } },
        orderBy: { workshop: { date: "desc" } },
      },
    },
  })

  if (!actor) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // lastDate = most recent PAST workshop date (not future, not feedback date)
  const today = new Date(); today.setHours(23, 59, 59, 999)
  const pastCastings = actor.castings.filter((c) => new Date(c.workshop.date) <= today)
  const lastDate = pastCastings[0]?.workshop.date?.toISOString() ?? null
  const workshopCount = new Set(actor.castings.map((c) => c.workshop)).size

  return NextResponse.json({
    id:           actor.id,
    name:         actor.name,
    gender:       actor.gender,
    phone:        actor.phone,
    email:        actor.email,
    languages:    actor.languages,
    specialties:  actor.specialties,
    canDirect:    actor.canDirect,
    workshopCount,
    lastDate,
    feedbacks: canSeeFeedback
      ? (actor.feedbacks ?? []).map((f) => ({
          id:       f.id,
          date:     f.enteredAt.toISOString(),
          orgName:  f.workshop.participantGroup.organization.name,
          workshopId: f.workshopId,
          facilitatorName: f.room.facilitator?.name ?? null,
          enteredByName:   f.enteredBy.name,
          aspect1Color: f.aspect1PrepColor,         aspect1Text: f.aspect1PrepText,
          aspect2Color: f.aspect2SimColor,          aspect2Text: f.aspect2SimText,
          aspect3Color: f.aspect3ReflectionColor,   aspect3Text: f.aspect3ReflectionText,
          aspect4Color: f.aspect4ProfessionalColor, aspect4Text: f.aspect4ProfessionalText,
        }))
      : [],
    devLogs: canSeeFeedback
      ? (actor.developmentLogs ?? []).map((l) => ({
          id:           l.id,
          date:         l.date.toISOString(),
          note:         l.note,
          enteredByName: l.enteredBy.name,
        }))
      : [],
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!session.user.roles.includes("MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const { name, gender, phone, email, languages, specialties, canDirect } = await req.json()

  if (name !== undefined && !name.trim())
    return NextResponse.json({ error: "שם לא יכול להיות ריק" }, { status: 400 })

  const actor = await prisma.actor.update({
    where: { id },
    data: {
      ...(name        !== undefined ? { name:        name.trim()        } : {}),
      ...(gender      !== undefined ? { gender                          } : {}),
      ...(phone       !== undefined ? { phone:       phone?.trim()  || null } : {}),
      ...(email       !== undefined ? { email:       email?.trim()  || null } : {}),
      ...(languages   !== undefined ? { languages:   languages?.trim()  || null } : {}),
      ...(specialties !== undefined ? { specialties: specialties?.trim() || null } : {}),
      ...(canDirect   !== undefined ? { canDirect: Boolean(canDirect)   } : {}),
    },
  })

  return NextResponse.json(actor)
}
