import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { Role } from "@prisma/client"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const facilitators = await prisma.person.findMany({
    where: {
      active: true,
      roles: { some: { role: Role.FACILITATOR } },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(facilitators)
}
