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
    return NextResponse.json({ error: "שם מודל לא יכול להיות ריק" }, { status: 400 })

  if (name !== undefined) {
    const conflict = await prisma.simulationModel.findFirst({
      where: { name: { equals: name.trim(), mode: "insensitive" }, id: { not: id } },
    })
    if (conflict) return NextResponse.json({ error: "מודל בשם זה כבר קיים" }, { status: 409 })
  }

  const model = await prisma.simulationModel.update({
    where: { id },
    data: {
      ...(name   !== undefined ? { name: name.trim() } : {}),
      ...(active !== undefined ? { active }            : {}),
    },
  })

  return NextResponse.json({ id: model.id, name: model.name, active: model.active })
}
