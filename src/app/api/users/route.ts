import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hash } from "bcryptjs"
import { NextResponse } from "next/server"
import { Role } from "@prisma/client"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || !session.user.roles.includes("MANAGER" as Role)) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 })
  }

  const users = await prisma.person.findMany({
    include: { roles: { select: { role: true } } },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      active: u.active,
      mustChangePassword: u.mustChangePassword,
      roles: u.roles.map((r) => r.role),
    }))
  )
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user.roles.includes("MANAGER" as Role)) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 })
  }

  const body = await req.json()
  const { name, email, password, roles } = body as {
    name: string
    email: string
    password: string
    roles: string[]
  }

  if (!name?.trim() || !email?.trim() || !password?.trim() || !roles?.length) {
    return NextResponse.json({ error: "שדות חובה חסרים" }, { status: 400 })
  }

  const existing = await prisma.person.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: "כתובת אימייל כבר קיימת במערכת" }, { status: 400 })
  }

  const passwordHash = await hash(password, 12)

  const user = await prisma.person.create({
    data: {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      mustChangePassword: true,
      roles: {
        create: roles.map((role) => ({ role: role as Role })),
      },
    },
    include: { roles: { select: { role: true } } },
  })

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    active: user.active,
    mustChangePassword: user.mustChangePassword,
    roles: user.roles.map((r) => r.role),
  })
}
