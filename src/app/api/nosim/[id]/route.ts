import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

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
  const { name, active } = await req.json()

  if (name !== undefined && !name.trim())
    return NextResponse.json({ error: "שם נושא לא יכול להיות ריק" }, { status: 400 })

  if (name !== undefined) {
    const conflict = await prisma.topic.findFirst({
      where: { name: { equals: name.trim(), mode: "insensitive" }, id: { not: id } },
    })
    if (conflict) return NextResponse.json({ error: "נושא בשם זה כבר קיים" }, { status: 409 })
  }

  const topic = await prisma.topic.update({
    where: { id },
    data: {
      ...(name   !== undefined ? { name: name.trim() } : {}),
      ...(active !== undefined ? { active }             : {}),
    },
  })

  return NextResponse.json({ id: topic.id, name: topic.name, active: topic.active })
}
