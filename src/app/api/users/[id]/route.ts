import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hash } from "bcryptjs"
import { NextResponse } from "next/server"
import { Role } from "@prisma/client"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user.roles.includes("MANAGER" as Role)) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { name, email, active, roles, newPassword } = body as {
    name?: string
    email?: string
    active?: boolean
    roles?: string[]
    newPassword?: string
  }

  // Prevent deactivating yourself
  if (id === session.user.id && active === false) {
    return NextResponse.json({ error: "לא ניתן להשבית את המשתמש הנוכחי" }, { status: 400 })
  }

  // Check email uniqueness if changing email
  if (email) {
    const existing = await prisma.person.findFirst({
      where: { email: email.trim().toLowerCase(), NOT: { id } },
    })
    if (existing) {
      return NextResponse.json({ error: "כתובת אימייל כבר קיימת במערכת" }, { status: 400 })
    }
  }

  const updateData: Record<string, unknown> = {}
  if (name !== undefined) updateData.name = name.trim()
  if (email !== undefined) updateData.email = email.trim().toLowerCase()
  if (active !== undefined) updateData.active = active
  if (newPassword) {
    updateData.passwordHash = await hash(newPassword, 12)
    updateData.mustChangePassword = true
  }

  const user = await prisma.person.update({
    where: { id },
    data: {
      ...updateData,
      ...(roles !== undefined && {
        roles: {
          deleteMany: {},
          create: roles.map((role) => ({ role: role as Role })),
        },
      }),
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
