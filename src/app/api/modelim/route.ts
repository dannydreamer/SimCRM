import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Manual order first — managers push the models they use most to the top.
  // Name is only the tie-break for rows that share an index.
  const models = await prisma.simulationModel.findMany({
    orderBy: [{ orderIndex: "asc" }, { name: "asc" }],
    include: {
      // Same rule as the topic count: cancelled scenarios and scenarios of cancelled
      // workshops never ran, so they do not count.
      _count: {
        select: { scenarios: { where: { cancelled: false, workshop: { cancelled: false } } } },
      },
    },
  })

  return NextResponse.json(
    models.map((m) => ({
      id:            m.id,
      name:          m.name,
      active:        m.active,
      scenarioCount: m._count.scenarios,
      createdAt:     m.createdAt.toISOString(),
    }))
  )
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!session.user.roles.includes("MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: "שם מודל הוא שדה חובה" }, { status: 400 })

  const existing = await prisma.simulationModel.findFirst({ where: { name: { equals: name.trim(), mode: "insensitive" } } })
  if (existing) return NextResponse.json({ error: "מודל בשם זה כבר קיים" }, { status: 409 })

  // A new model lands at the bottom of the manual order, not in the middle of it
  const last = await prisma.simulationModel.aggregate({ _max: { orderIndex: true } })

  const model = await prisma.simulationModel.create({
    data: { name: name.trim(), orderIndex: (last._max.orderIndex ?? 0) + 1 },
  })
  return NextResponse.json({ id: model.id, name: model.name, active: model.active, scenarioCount: 0, createdAt: model.createdAt.toISOString() }, { status: 201 })
}
