import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { CAN_MANAGE_ORGS, CAN_DELETE_ORG, hasAny } from "@/lib/roles"
import { findDuplicateOrgs } from "@/lib/org-search"
import { mergeOrganizationInto, MergeError } from "@/lib/org-merge-tx"

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

  const now = new Date()
  // Cancelled workshops keep their rooms, so they are dropped here or a
  // cancelled-only organization would report rooms "done".
  const liveWorkshops = org.participantGroups
    .flatMap((g) => g.workshops)
    .filter((w) => !w.cancelled)
  const totalRoomsDone    = liveWorkshops
    .filter((w) => w.date < now)
    .reduce((sum, w) => sum + w.rooms.length, 0)
  const totalRoomsPlanned = liveWorkshops
    .filter((w) => w.date >= now)
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
      workshopCount: g.workshops.filter((w) => !w.cancelled).length,
      lastWorkshopDate: g.workshops.find(
        (w) => !w.cancelled && w.date <= now
      )?.date.toISOString() ?? null,
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
  if (!hasAny(session.user.roles, CAN_MANAGE_ORGS)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { name, city, shiyuchPedagogi, shiyuchTakzivi, pocName, pocPhone, pocEmail, notes } = body

  if (name !== undefined && !name.trim())
    return NextResponse.json({ error: "שם ארגון לא יכול להיות ריק" }, { status: 400 })

  // Renaming onto an existing name is warned about exactly as creating one is,
  // and goes through on the resend with allowDuplicate. See POST /api/irgunnim.
  if (name !== undefined && body.allowDuplicate !== true) {
    const all  = await prisma.organization.findMany({ select: { id: true, name: true, city: true } })
    const dups = findDuplicateOrgs(name, all, id).filter((d) => d.kind === "exact")
    if (dups.length > 0) {
      return NextResponse.json({
        error: `ארגון בשם זה כבר קיים במערכת (${dups[0].org.city}). לבדוק שאין כאן כפילות לפני השמירה.`,
        duplicates: dups.map((d) => ({ ...d.org, kind: d.kind })),
      }, { status: 409 })
    }
  }

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

// Selects an organization with enough of its groups to plan a merge: every
// group, and each group's workshops reduced to whether they were cancelled.
// `workshops.length` is the whole history, which is what decides the receiving
// group; the non-cancelled subset is what the dialog quotes back to the user.
const withGroups = {
  participantGroups: {
    select: {
      id: true,
      name: true,
      workshops: { select: { cancelled: true } },
    },
  },
} as const

/**
 * Deleting an organization.
 *
 * An organization with no groups is simply removed. One that has groups holds
 * history that cannot be discarded — past workshops, their rooms, casting and
 * feedback all hang off its groups — so it can only be deleted by naming the
 * organization that inherits them, `mergeIntoId`. Without one the request comes
 * back 409 with the counts, and the client re-sends it with a destination,
 * exactly as the duplicate-name warning above works.
 *
 * Nothing but ParticipantGroup.organizationId points at an organization, so the
 * whole history — past workshops and future ones alike — moves with the groups.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasAny(session.user.roles, CAN_DELETE_ORG)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const mergeIntoId: string | undefined = body?.mergeIntoId ?? undefined

  const source = await prisma.organization.findUnique({
    where: { id },
    include: withGroups,
  })
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const groups = source.participantGroups
  const liveWorkshops = groups.reduce(
    (n, g) => n + g.workshops.filter((w) => !w.cancelled).length, 0
  )

  // The empty case: nothing to inherit, so it just goes.
  if (groups.length === 0) {
    await prisma.organization.delete({ where: { id } })
    return NextResponse.json({ deleted: true, merged: false })
  }

  if (!mergeIntoId) {
    return NextResponse.json({
      error: `לארגון «${source.name}» יש היסטוריה שאי אפשר למחוק. יש לבחור ארגון שיקבל אותה.`,
      needsMergeTarget: true,
      groupCount:    groups.length,
      workshopCount: liveWorkshops,
      groupNames:    groups.map((g) => g.name),
    }, { status: 409 })
  }

  if (mergeIntoId === id) {
    return NextResponse.json(
      { error: "אי אפשר להעביר ארגון אל עצמו." }, { status: 409 })
  }

  try {
    const result = await mergeOrganizationInto(
      id, mergeIntoId, session.user.name?.trim() || "משתמש לא ידוע"
    )
    return NextResponse.json({ deleted: true, merged: true, ...result })
  } catch (e) {
    if (e instanceof MergeError) {
      return e.reason === "target-missing"
        ? NextResponse.json({ error: "הארגון המקבל לא נמצא." }, { status: 404 })
        : NextResponse.json({ error: "הארגון כבר נמחק." }, { status: 404 })
    }
    throw e
  }
}
