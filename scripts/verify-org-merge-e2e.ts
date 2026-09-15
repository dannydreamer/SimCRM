// End-to-end check of deleting an organization into another one, against a real
// database.
//
//   npx tsx --env-file=.env scripts/verify-org-merge-e2e.ts
//
// `npm run check:orgmerge` covers the fold rules as pure functions. This covers
// what they are for: that the history actually arrives, that the annual report
// does not move when it should not, and that it does move when it should. It
// calls `mergeOrganizationInto` — the same function the DELETE route calls — so
// it is testing the shipped path rather than a re-implementation of it.
//
// Everything it creates is torn down at the end, including on failure.

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import { mergeOrganizationInto, MergeError } from "../src/lib/org-merge-tx"
import { getPivotRows, buildAnnualGrid, sumCategories } from "../src/lib/pivot-data"

// ─── Refuse to touch anything but the test project ───────────────────────────
//
// This script writes and deletes. The production Supabase ref is
// uremusqbcnnfwuafirhz; the test one is dcnisxtwszzomimmzdar (spec §2.1.1).
const url = process.env.DATABASE_URL ?? ""
if (!url) { console.error("DATABASE_URL is not set — run with --env-file=.env"); process.exit(1) }
if (!url.includes("dcnisxtwszzomimmzdar")) {
  console.error("Refusing to run: DATABASE_URL is not the sim_crm_testing project.")
  process.exit(1)
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a !== e) { failures++; console.log(`FAIL ${name}\n  expected ${e}\n  actual   ${a}`) }
  else console.log(`ok   ${name}`)
}

const TAG  = `e2e-merge-${Date.now()}`
const YEAR = 2031          // far enough out that no real row shares the window
const past   = new Date(`${YEAR}-01-05T00:00:00.000Z`)
const future = new Date(`${YEAR}-11-20T00:00:00.000Z`)

async function makeOrg(name: string, takzivi: "OVDEI_HORAA" | "MANCHI", over = {}) {
  return prisma.organization.create({
    data: {
      name: `${TAG} ${name}`, city: "חולון",
      shiyuchPedagogi: "YESODI", shiyuchTakzivi: takzivi, ...over,
    },
  })
}

async function makeGroup(orgId: string, name: string) {
  return prisma.participantGroup.create({ data: { organizationId: orgId, name } })
}

/** A workshop with `rooms` active rooms, so countedRooms() has something to count. */
async function makeWorkshop(groupId: string, date: Date, rooms: number) {
  const w = await prisma.workshop.create({
    data: {
      participantGroupId: groupId, date,
      startTime: "09:00", endTime: "12:00", numRooms: rooms,
      status: "SPECIFIED",
    },
  })
  for (let i = 1; i <= rooms; i++) {
    await prisma.room.create({ data: { workshopId: w.id, roomNumber: i } })
  }
  return w
}

async function cleanup() {
  const orgs = await prisma.organization.findMany({
    where: { name: { startsWith: TAG } },
    include: { participantGroups: { include: { workshops: true } } },
  })
  for (const o of orgs) {
    for (const g of o.participantGroups) {
      await prisma.room.deleteMany({ where: { workshopId: { in: g.workshops.map((w) => w.id) } } })
      await prisma.workshop.deleteMany({ where: { participantGroupId: g.id } })
      await prisma.participantGroup.delete({ where: { id: g.id } })
    }
    await prisma.organization.delete({ where: { id: o.id } })
  }
}

async function main() {
  console.log("\n── an organization nobody has used ───────────────────────────────")

  const empty = await makeOrg("ריק", "OVDEI_HORAA")
  await prisma.organization.delete({ where: { id: empty.id } })
  check("an organization with no groups deletes outright",
    await prisma.organization.findUnique({ where: { id: empty.id } }), null)

  console.log("\n── the ordinary merge ────────────────────────────────────────────")

  // Same school entered twice. The survivor has מורים; the duplicate has מורים
  // too (it must fold) and יועצות (it must move).
  const keep = await makeOrg("אורט", "OVDEI_HORAA", { pocName: "רונית" })
  const dupe = await makeOrg("בי\"ס אורט", "OVDEI_HORAA", {
    pocPhone: "050-1234567", notes: "נפתח בטעות",
  })

  const keepTeachers = await makeGroup(keep.id, "מורים")
  const dupeTeachers = await makeGroup(dupe.id, "מורים")
  const dupeCounsel  = await makeGroup(dupe.id, "יועצות")

  await makeWorkshop(keepTeachers.id, past, 3)
  const movedPast   = await makeWorkshop(dupeTeachers.id, past, 2)
  const movedFuture = await makeWorkshop(dupeCounsel.id, future, 4)

  const gridBefore  = buildAnnualGrid(await getPivotRows(YEAR))
  const totalBefore = sumCategories(gridBefore.totals)

  const result = await mergeOrganizationInto(dupe.id, keep.id, "דניאל")

  check("one group folded, one moved", [result.foldedGroups, result.movedGroups], [1, 1])
  check("the duplicate organization is gone",
    await prisma.organization.findUnique({ where: { id: dupe.id } }), null)

  const after = await prisma.organization.findUnique({
    where: { id: keep.id },
    include: { participantGroups: { include: { workshops: true } } },
  })
  const groupNames = after!.participantGroups.map((g) => g.name).sort()
  check("the survivor holds both groups and no duplicate of מורים",
    groupNames, ["יועצות", "מורים"])

  const teachers = after!.participantGroups.find((g) => g.name === "מורים")!
  check("the folded group's workshops landed in the surviving group of that name",
    teachers.id, keepTeachers.id)
  check("מורים now carries both workshops", teachers.workshops.length, 2)
  check("the folded group itself is deleted",
    await prisma.participantGroup.findUnique({ where: { id: dupeTeachers.id } }), null)

  console.log("\n── past and future both arrive ───────────────────────────────────")

  const pastNow = await prisma.workshop.findUnique({
    where: { id: movedPast.id },
    include: { participantGroup: { include: { organization: true } }, rooms: true },
  })
  check("a past workshop resolves to the survivor",
    pastNow!.participantGroup.organization.id, keep.id)
  check("and keeps its rooms", pastNow!.rooms.length, 2)

  const futureNow = await prisma.workshop.findUnique({
    where: { id: movedFuture.id },
    include: { participantGroup: { include: { organization: true } } },
  })
  check("a future workshop resolves to the survivor",
    futureNow!.participantGroup.organization.id, keep.id)

  console.log("\n── what the survivor inherited ───────────────────────────────────")

  check("a point of contact only the duplicate had is carried over",
    after!.pocPhone, "050-1234567")
  check("a point of contact the survivor already had is untouched",
    after!.pocName, "רונית")
  check("the merge left a trace in the notes",
    after!.notes?.includes("נמחק וההיסטוריה שלו הועברה לכאן"), true)
  check("the deleted organization's own notes came with it",
    after!.notes?.includes("נפתח בטעות"), true)

  console.log("\n── the annual report ─────────────────────────────────────────────")

  const rowsAfter  = await getPivotRows(YEAR)
  const gridAfter  = buildAnnualGrid(rowsAfter)

  // The invariant. Rows are per-workshop and a merge creates and destroys none,
  // so a moved total means the merge lost or duplicated history.
  check("the grand total is unchanged by the merge",
    sumCategories(gridAfter.totals), totalBefore)
  check("the category mix is unchanged too, when both agreed on שיוך תקציבי",
    gridAfter.totals, gridBefore.totals)

  const labels = new Set(
    rowsAfter.filter((r) => r.groupName.includes(TAG)).map((r) => r.groupName.split(" - ")[0])
  )
  check("the school now appears under one name, not two", [...labels], [`${TAG} אורט`])

  console.log("\n── when the two copies disagreed on שיוך תקציבי ──────────────────")

  // The mis-categorisation this whole feature exists to fix: the same school
  // counting against two different budget lines.
  const keepB = await makeOrg("מקיף", "OVDEI_HORAA")
  const dupeB = await makeOrg("מקיף ב", "MANCHI")
  await makeWorkshop((await makeGroup(keepB.id, "מורים")).id, past, 1)
  await makeWorkshop((await makeGroup(dupeB.id, "מנהלים")).id, past, 5)

  const bBefore = buildAnnualGrid(await getPivotRows(YEAR)).totals
  await mergeOrganizationInto(dupeB.id, keepB.id, "דניאל")
  const bAfter  = buildAnnualGrid(await getPivotRows(YEAR)).totals

  check("the grand total still does not move",
    sumCategories(bAfter), sumCategories(bBefore))
  check("the 5 rooms leave the survivor's old category",
    bAfter.MANCHI, bBefore.MANCHI - 5)
  check("and are counted under the survivor's category instead",
    bAfter.OVDEI_HORAA, bBefore.OVDEI_HORAA + 5)

  console.log("\n── refusals ──────────────────────────────────────────────────────")

  const reasonOf = async (fn: () => Promise<unknown>) => {
    try { await fn(); return "no error" }
    catch (e) { return e instanceof MergeError ? e.reason : `wrong error: ${e}` }
  }
  check("an organization cannot be merged into itself",
    await reasonOf(() => mergeOrganizationInto(keep.id, keep.id, "דניאל")), "same-org")
  check("a missing destination is refused",
    await reasonOf(() => mergeOrganizationInto(keep.id, "no-such-org", "דניאל")), "target-missing")
  check("the refused merges changed nothing",
    (await prisma.organization.findUnique({
      where: { id: keep.id }, include: { participantGroups: true },
    }))!.participantGroups.length, 2)
}

main()
  .catch((e) => { failures++; console.error("\nUNEXPECTED ERROR\n", e) })
  .finally(async () => {
    await cleanup()
    console.log(
      failures === 0
        ? "\nAll organization-merge end-to-end checks passed. Test data removed.\n"
        : `\n${failures} check(s) FAILED. Test data removed.\n`
    )
    await prisma.$disconnect()
    process.exit(failures === 0 ? 0 : 1)
  })
