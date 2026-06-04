import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!session.user.roles.includes("MANAGER"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const weeksParam = req.nextUrl.searchParams.get("weeks")
  const isAll = weeksParam === "all"

  // Window: today (start of day UTC) → today + N weeks, or unbounded for "all"
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const dateFilter: { gte: Date; lte?: Date } = { gte: today }
  if (!isAll) {
    const weeks = Math.min(Math.max(Number(weeksParam) || 2, 1), 4)
    const windowEnd = new Date(today)
    windowEnd.setUTCDate(today.getUTCDate() + weeks * 7)
    windowEnd.setUTCHours(23, 59, 59, 999)
    dateFilter.lte = windowEnd
  }

  const facilitators = await prisma.person.findMany({
    where: {
      active: true,
      roles: { some: { role: "FACILITATOR" } },
    },
    orderBy: { name: "asc" },
    include: {
      roomsFacilitated: {
        where: {
          cancelled: false,
          workshop: {
            cancelled: false,
            date: dateFilter,
          },
        },
        select: {
          id: true,
          roomNumber: true,
          workshop: {
            select: {
              id: true,
              date: true,
              participantGroup: {
                select: {
                  name: true,
                  organization: { select: { name: true } },
                },
              },
            },
          },
        },
      },
      workshopsAuthored: {
        where: {
          cancelled: false,
          date: dateFilter,
        },
        select: {
          id: true,
          date: true,
          participantGroup: {
            select: {
              name: true,
              organization: { select: { name: true } },
            },
          },
        },
      },
    },
  })

  return NextResponse.json(
    facilitators.map((p) => {
      // Merge rooms + authored workshops into one list, deduped by workshop id
      const wsMap = new Map<string, {
        id: string
        date: string
        groupName: string
        orgName: string
        rooms: number[]
        asAuthor: boolean
      }>()

      for (const room of p.roomsFacilitated) {
        const ws = room.workshop
        if (!wsMap.has(ws.id)) {
          wsMap.set(ws.id, {
            id: ws.id,
            date: ws.date.toISOString(),
            groupName: ws.participantGroup.name,
            orgName: ws.participantGroup.organization.name,
            rooms: [],
            asAuthor: false,
          })
        }
        wsMap.get(ws.id)!.rooms.push(room.roomNumber)
      }

      for (const ws of p.workshopsAuthored) {
        if (!wsMap.has(ws.id)) {
          wsMap.set(ws.id, {
            id: ws.id,
            date: ws.date.toISOString(),
            groupName: ws.participantGroup.name,
            orgName: ws.participantGroup.organization.name,
            rooms: [],
            asAuthor: false,
          })
        }
        wsMap.get(ws.id)!.asAuthor = true
      }

      const workshops = Array.from(wsMap.values()).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )

      return {
        id:          p.id,
        name:        p.name,
        roomCount:   p.roomsFacilitated.length,
        authorCount: p.workshopsAuthored.length,
        workshops,
      }
    })
  )
}
