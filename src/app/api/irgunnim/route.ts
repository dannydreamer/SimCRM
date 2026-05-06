import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const q         = searchParams.get("q")?.trim() ?? ""
  const pedagogi  = searchParams.get("pedagogi") ?? ""
  const takzivi   = searchParams.get("takzivi") ?? ""
  const sort      = searchParams.get("sort") ?? "lastWorkshop"

  const orgs = await prisma.organization.findMany({
    where: {
      ...(q ? { OR: [
        { name: { contains: q } },
        { participantGroups: { some: { name: { contains: q } } } },
      ]} : {}),
      ...(pedagogi ? { shiyuchPedagogi: pedagogi as never } : {}),
      ...(takzivi  ? { shiyuchTakzivi:  takzivi  as never } : {}),
    },
    include: {
      participantGroups: {
        include: {
          workshops: {
            select: { id: true, date: true },
            orderBy: { date: "desc" },
          },
        },
      },
    },
  })

  const rows = orgs.map((org) => {
    const allWorkshops = org.participantGroups.flatMap((g) => g.workshops)
    const workshopCount = allWorkshops.length
    const lastWorkshopDate = allWorkshops.length
      ? allWorkshops.reduce((a, b) => (a.date > b.date ? a : b)).date
      : null

    return {
      id: org.id,
      name: org.name,
      city: org.city,
      shiyuchPedagogi: org.shiyuchPedagogi,
      shiyuchTakzivi: org.shiyuchTakzivi,
      pocName: org.pocName,
      workshopCount,
      lastWorkshopDate: lastWorkshopDate?.toISOString() ?? null,
      groups: org.participantGroups.map((g) => ({ id: g.id, name: g.name })),
    }
  })

  rows.sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name, "he")
    if (sort === "workshopCount") return b.workshopCount - a.workshopCount
    // lastWorkshop — most recent first, orgs with no workshops last
    const aDate = a.lastWorkshopDate ? new Date(a.lastWorkshopDate).getTime() : 0
    const bDate = b.lastWorkshopDate ? new Date(b.lastWorkshopDate).getTime() : 0
    return bDate - aDate
  })

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!session.user.roles.includes("MANAGER") && !session.user.roles.includes("TECH")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { name, city, shiyuchPedagogi, shiyuchTakzivi, pocName, pocPhone, pocEmail, notes } = body

  if (!name?.trim())            return NextResponse.json({ error: "שם ארגון הוא שדה חובה" },  { status: 400 })
  if (!city?.trim())            return NextResponse.json({ error: "עיר היא שדה חובה" },         { status: 400 })
  if (!shiyuchPedagogi)         return NextResponse.json({ error: "שיוך פדגוגי הוא שדה חובה" }, { status: 400 })
  if (!shiyuchTakzivi)          return NextResponse.json({ error: "שיוך תקציבי הוא שדה חובה" }, { status: 400 })

  const org = await prisma.organization.create({
    data: {
      name: name.trim(),
      city: city.trim(),
      shiyuchPedagogi,
      shiyuchTakzivi,
      pocName:  pocName?.trim()  || null,
      pocPhone: pocPhone?.trim() || null,
      pocEmail: pocEmail?.trim() || null,
      notes:    notes?.trim()    || null,
    },
  })

  return NextResponse.json(org, { status: 201 })
}
