import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireTemplateManager } from "@/lib/deck/route-helpers"
import { currentTemplates, templateTokens, toMeta } from "@/lib/deck/files"
import { EXPECTED_TOKENS, KNOWN_TOKENS } from "@/lib/deck/pptx"

// The templates section of /settings: every active facilitator, with their
// template and what it holds. Manager only. §14 F-06.
export async function GET() {
  const { error } = await requireTemplateManager()
  if (error) return error

  // FACILITATOR is never implied by another role, so filtering on the stored
  // role is exact here (§5.4).
  const people = await prisma.person.findMany({
    where: { active: true, roles: { some: { role: "FACILITATOR" } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  })
  const templates = await currentTemplates(people.map((p) => p.id))

  const out = []
  for (const p of people) {
    const t = templates.get(p.id)
    const tokens = t ? await templateTokens(t) : []
    out.push({
      id: p.id,
      name: p.name,
      template: t ? {
        ...toMeta(t),
        tokens,
        missing: EXPECTED_TOKENS.filter((x) => !tokens.includes(x)),
        unknown: tokens.filter((x) => !(KNOWN_TOKENS as readonly string[]).includes(x)),
      } : null,
    })
  }
  return NextResponse.json({ facilitators: out })
}
