import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { ShiyuchTakzivi } from "@prisma/client"

const TAKZIVI_ORDER: ShiyuchTakzivi[] = [
  "OVDEI_HORAA",
  "MANCHI",
  "IRIYAT_YERUSHALAIM_TASHLUM",
  "CHUTZNIIOT_TASHLUM",
]

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!session.user.roles.includes("MANAGER"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const year = Number(req.nextUrl.searchParams.get("year")) || new Date().getFullYear()

  const yearStart = new Date(`${year}-01-01T00:00:00.000Z`)
  const yearEnd   = new Date(`${year}-12-31T23:59:59.999Z`)
  const today     = new Date()

  // Fetch all allocations for this year
  const goals = await prisma.annualGoal.findMany({ where: { year } })
  const goalMap = new Map(goals.map((g) => [g.shiyuchTakzivi, g.allocation]))

  // Fetch all non-cancelled workshops in the year with their active rooms and org shiyuchTakzivi
  const workshops = await prisma.workshop.findMany({
    where: {
      cancelled: false,
      date: { gte: yearStart, lte: yearEnd },
    },
    select: {
      date: true,
      participantGroup: {
        select: {
          organization: { select: { shiyuchTakzivi: true } },
        },
      },
      rooms: {
        where: { cancelled: false },
        select: { id: true },
      },
    },
  })

  // Tally room counts by shiyuchTakzivi × past/future
  const utilized = new Map<string, number>()
  const planned  = new Map<string, number>()

  for (const tv of TAKZIVI_ORDER) {
    utilized.set(tv, 0)
    planned.set(tv, 0)
  }

  for (const w of workshops) {
    const tv = w.participantGroup.organization.shiyuchTakzivi
    const roomCount = w.rooms.length
    if (new Date(w.date) < today) {
      utilized.set(tv, (utilized.get(tv) ?? 0) + roomCount)
    } else {
      planned.set(tv, (planned.get(tv) ?? 0) + roomCount)
    }
  }

  return NextResponse.json(
    TAKZIVI_ORDER.map((tv) => ({
      shiyuchTakzivi: tv,
      allocation:     goalMap.get(tv) ?? 0,
      utilized:       utilized.get(tv) ?? 0,
      planned:        planned.get(tv)  ?? 0,
    }))
  )
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!session.user.roles.includes("MANAGER"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { year, shiyuchTakzivi, allocation } = await req.json()

  if (!year || !shiyuchTakzivi || allocation === undefined)
    return NextResponse.json({ error: "year, shiyuchTakzivi, allocation required" }, { status: 400 })

  const result = await prisma.annualGoal.upsert({
    where:  { year_shiyuchTakzivi: { year: Number(year), shiyuchTakzivi } },
    update: { allocation: Number(allocation) },
    create: { year: Number(year), shiyuchTakzivi, allocation: Number(allocation) },
  })

  return NextResponse.json({ allocation: result.allocation })
}
