import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { checkAndAdvanceStatus } from "@/lib/workshop-status"

// Hard delete of a single feedback record. Manager only — the Feedback
// Documenter may enter, edit and export feedback but never delete it.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!session.user.roles.includes("MANAGER"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  const feedback = await prisma.feedback.findUnique({
    where: { id },
    select: { id: true, workshopId: true },
  })
  if (!feedback) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.feedback.delete({ where: { id: feedback.id } })

  // Removing a record can make the workshop's feedback incomplete — regress
  // CLOSED → CLOSING. Explicit call: nothing else recomputes status here.
  await checkAndAdvanceStatus(feedback.workshopId)

  return NextResponse.json({ ok: true })
}
