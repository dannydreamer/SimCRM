import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const topics = await prisma.topic.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { scenarios: true } } },
  })

  return NextResponse.json(
    topics.map((t) => ({
      id:             t.id,
      name:           t.name,
      active:         t.active,
      scenarioCount:  t._count.scenarios,
      createdAt:      t.createdAt.toISOString(),
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
  if (!name?.trim()) return NextResponse.json({ error: "שם נושא הוא שדה חובה" }, { status: 400 })

  const existing = await prisma.topic.findFirst({ where: { name: { equals: name.trim() } } })
  if (existing) return NextResponse.json({ error: "נושא בשם זה כבר קיים" }, { status: 409 })

  const topic = await prisma.topic.create({ data: { name: name.trim() } })
  return NextResponse.json({ id: topic.id, name: topic.name, active: topic.active, scenarioCount: 0, createdAt: topic.createdAt.toISOString() }, { status: 201 })
}
