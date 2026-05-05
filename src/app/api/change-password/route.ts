import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { compare, hash } from "bcryptjs"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ message: "לא מורשה" }, { status: 401 })
  }

  const { currentPassword, newPassword } = await req.json()

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ message: "שדות חסרים" }, { status: 400 })
  }

  if (newPassword.length < 8) {
    return NextResponse.json(
      { message: "הסיסמה חייבת להכיל לפחות 8 תווים" },
      { status: 400 }
    )
  }

  const person = await prisma.person.findUnique({
    where: { id: session.user.id },
  })

  if (!person) {
    return NextResponse.json({ message: "משתמש לא נמצא" }, { status: 404 })
  }

  const valid = await compare(currentPassword, person.passwordHash)
  if (!valid) {
    return NextResponse.json({ message: "הסיסמה הנוכחית שגויה" }, { status: 400 })
  }

  const passwordHash = await hash(newPassword, 12)

  await prisma.person.update({
    where: { id: person.id },
    data: { passwordHash, mustChangePassword: false },
  })

  return NextResponse.json({ ok: true })
}
