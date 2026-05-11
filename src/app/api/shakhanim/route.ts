import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

function ragMode(colors: string[]): string {
  if (!colors.length) return "NONE"
  const counts: Record<string, number> = { GREEN: 0, YELLOW: 0, RED: 0 }
  colors.forEach((c) => { counts[c] = (counts[c] ?? 0) + 1 })
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const actors = await prisma.actor.findMany({
    orderBy: { name: "asc" },
    include: {
      feedbacks: {
        select: {
          aspect1PrepColor:         true,
          aspect2SimColor:          true,
          aspect3ReflectionColor:   true,
          aspect4ProfessionalColor: true,
          enteredAt:                true,
          workshop: { select: { date: true } },
        },
      },
      castings: {
        select: { workshop: { select: { date: true } } },
        orderBy: { workshop: { date: "desc" } },
        take: 1,
      },
    },
  })

  return NextResponse.json(
    actors.map((a) => {
      const lastDate =
        a.castings[0]?.workshop.date?.toISOString() ??
        a.feedbacks.sort((x, y) => new Date(y.enteredAt).getTime() - new Date(x.enteredAt).getTime())[0]?.enteredAt?.toISOString() ??
        null

      const ragSummary = {
        aspect1: ragMode(a.feedbacks.map((f) => f.aspect1PrepColor)),
        aspect2: ragMode(a.feedbacks.map((f) => f.aspect2SimColor)),
        aspect3: ragMode(a.feedbacks.map((f) => f.aspect3ReflectionColor)),
        aspect4: ragMode(a.feedbacks.map((f) => f.aspect4ProfessionalColor)),
      }

      return {
        id:           a.id,
        name:         a.name,
        gender:       a.gender,
        phone:        a.phone,
        email:        a.email,
        languages:    a.languages,
        specialties:  a.specialties,
        canDirect:    a.canDirect,
        workshopCount: a.castings.length,
        lastDate,
        feedbackCount: a.feedbacks.length,
        ragSummary,
      }
    })
  )
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!session.user.roles.includes("MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { name, gender, phone, email, languages, specialties, canDirect } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: "שם הוא שדה חובה" },   { status: 400 })
  if (!gender)       return NextResponse.json({ error: "מגדר הוא שדה חובה" }, { status: 400 })

  const actor = await prisma.actor.create({
    data: {
      name:        name.trim(),
      gender,
      phone:       phone?.trim()       || null,
      email:       email?.trim()       || null,
      languages:   languages?.trim()   || null,
      specialties: specialties?.trim() || null,
      canDirect:   Boolean(canDirect),
    },
  })

  return NextResponse.json(actor, { status: 201 })
}
