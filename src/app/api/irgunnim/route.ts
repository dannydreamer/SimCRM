import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { CAN_MANAGE_ORGS, hasAny } from "@/lib/roles"
import { findDuplicateOrgs, orgSearchKey, sortOrgs } from "@/lib/org-search"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const q         = searchParams.get("q")?.trim() ?? ""
  const pedagogi  = searchParams.get("pedagogi") ?? ""
  const takzivi   = searchParams.get("takzivi") ?? ""
  const sort      = searchParams.get("sort") ?? "name"

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
            where: { cancelled: false },
            select: { id: true, date: true },
            orderBy: { date: "desc" },
          },
        },
      },
    },
  })

  // Duplicate names are looked for across *every* organization, not just the
  // filtered page — otherwise the badge would vanish the moment a search hid the
  // other copy, which is exactly when it is needed. Only exact matches earn a
  // badge; the softer `contains` tier is for the forms, where a person is there
  // to judge it.
  const all = await prisma.organization.findMany({ select: { id: true, name: true } })
  const nameCounts = new Map<string, number>()
  for (const o of all) {
    const key = orgSearchKey(o.name)
    if (key) nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1)
  }
  const duplicateIds = new Set(
    all.filter((o) => (nameCounts.get(orgSearchKey(o.name)) ?? 0) > 1).map((o) => o.id)
  )

  const mapped = orgs.map((org) => {
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
      duplicateName: duplicateIds.has(org.id),
      workshopCount,
      lastWorkshopDate: lastWorkshopDate?.toISOString() ?? null,
      groups: org.participantGroups
        .map((g) => ({ id: g.id, name: g.name }))
        .sort((a, b) => a.name.localeCompare(b.name, "he")),
    }
  })

  // Alphabetical first, so that it is both the default order and — since sort is
  // stable — the tie-break under the other two orderings.
  const rows = sortOrgs(mapped)
  if (sort === "workshopCount") {
    rows.sort((a, b) => b.workshopCount - a.workshopCount)
  } else if (sort !== "name") {
    // lastWorkshop — most recent first, orgs with no workshops last
    rows.sort((a, b) => {
      const aDate = a.lastWorkshopDate ? new Date(a.lastWorkshopDate).getTime() : 0
      const bDate = b.lastWorkshopDate ? new Date(b.lastWorkshopDate).getTime() : 0
      return bDate - aDate
    })
  }

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasAny(session.user.roles, CAN_MANAGE_ORGS)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { name, city, shiyuchPedagogi, shiyuchTakzivi, pocName, pocPhone, pocEmail, notes } = body

  if (!name?.trim())            return NextResponse.json({ error: "שם ארגון הוא שדה חובה" },  { status: 400 })
  if (!city?.trim())            return NextResponse.json({ error: "עיר היא שדה חובה" },         { status: 400 })
  if (!shiyuchPedagogi)         return NextResponse.json({ error: "שיוך פדגוגי הוא שדה חובה" }, { status: 400 })
  if (!shiyuchTakzivi)          return NextResponse.json({ error: "שיוך תקציבי הוא שדה חובה" }, { status: 400 })

  // A name already on file is refused once, with the matches, and accepted on the
  // second try — the form resends with allowDuplicate after the user confirms.
  if (body.allowDuplicate !== true) {
    const all  = await prisma.organization.findMany({ select: { id: true, name: true, city: true } })
    const dups = findDuplicateOrgs(name, all).filter((d) => d.kind === "exact")
    if (dups.length > 0) {
      return NextResponse.json({
        error: `ארגון בשם זה כבר קיים במערכת (${dups[0].org.city}). לבדוק שאין כאן כפילות לפני היצירה.`,
        duplicates: dups.map((d) => ({ ...d.org, kind: d.kind })),
      }, { status: 409 })
    }
  }

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
