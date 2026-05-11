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

  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      participantGroups: {
        include: {
          workshops: {
            include: {
              rooms: {
                where: { cancelled: false },
                include: {
                  facilitator: { select: { name: true } },
                },
              },
            },
            orderBy: { date: "desc" },
          },
        },
        orderBy: { name: "asc" },
      },
    },
  })

  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const allWorkshops = org.participantGroups.flatMap((g) => g.workshops)
  const totalRoomsDone    = allWorkshops
    .filter((w) => new Date(w.date) < new Date())
    .reduce((sum, w) => sum + w.rooms.length, 0)
  const totalRoomsPlanned = allWorkshops
    .filter((w) => new Date(w.date) >= new Date())
    .reduce((sum, w) => sum + w.rooms.length, 0)

  return NextResponse.json({
    id: org.id,
    name: org.name,
    city: org.city,
    shiyuchPedagogi: org.shiyuchPedagogi,
    shiyuchTakzivi: org.shiyuchTakzivi,
    pocName:  org.pocName,
    pocPhone: org.pocPhone,
    pocEmail: org.pocEmail,
    notes:    org.notes,
    totalRoomsDone,
    totalRoomsPlanned,
    groups: org.participantGroups.map((g) => ({
      id:   g.id,
      name: g.name,
      workshopCount: g.workshops.length,
      lastWorkshopDate: g.workshops[0]?.date.toISOString() ?? null,
      workshops: g.workshops.map((w) => ({
        id:         w.id,
        date:       w.date.toISOString(),
        status:     w.status,
        cancelled:  w.cancelled,
        roomCount:  w.rooms.length,
        facilitators: [...new Set(
          w.rooms.map((r) => r.facilitator?.name).filter(Boolean)
        )],
      })),
    })),
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
  const body = await req.json()
  const { name, city, shiyuchPedagogi, shiyuchTakzivi, pocName, pocPhone, pocEmail, notes } = body

  if (name !== undefined && !name.trim())
    return NextResponse.json({ error: "שם ארגון לא יכול להיות ריק" }, { status: 400 })

  const org = await prisma.organization.update({
    where: { id },
    data: {
      ...(name            !== undefined ? { name:            name.trim()   } : {}),
      ...(city            !== undefined ? { city:            city.trim()   } : {}),
      ...(shiyuchPedagogi !== undefined ? { shiyuchPedagogi              } : {}),
      ...(shiyuchTakzivi  !== undefined ? { shiyuchTakzivi               } : {}),
      ...(pocName         !== undefined ? { pocName:  pocName?.trim()  || null } : {}),
      ...(pocPhone        !== undefined ? { pocPhone: pocPhone?.trim() || null } : {}),
      ...(pocEmail        !== undefined ? { pocEmail: pocEmail?.trim() || null } : {}),
      ...(notes           !== undefined ? { notes:    notes?.trim()    || null } : {}),
    },
  })

  return NextResponse.json(org)
}
