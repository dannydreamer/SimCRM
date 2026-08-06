import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const models = await prisma.simulationModel.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { scenarios: true } } },
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

  const model = await prisma.simulationModel.create({ data: { name: name.trim() } })
  return NextResponse.json({ id: model.id, name: model.name, active: model.active, scenarioCount: 0, createdAt: model.createdAt.toISOString() }, { status: 201 })
}
