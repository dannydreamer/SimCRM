/**
 * One-time pre-rollout DB reset.
 * Deletes ALL operational data, then creates a single MANAGER+TECH admin account.
 * AppSettings (Google Drive / OAuth tokens) are preserved.
 */
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import { hash } from "bcryptjs"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("⚠️  Starting pre-rollout DB reset...")

  // ── 1. Delete leaf data first (respect FK constraints) ─────────────────────
  const devLogs = await prisma.actorDevelopmentLog.deleteMany()
  console.log(`  ✓ Deleted ${devLogs.count} actor development logs`)

  const feedbacks = await prisma.feedback.deleteMany()
  console.log(`  ✓ Deleted ${feedbacks.count} feedbacks`)

  const changeLogs = await prisma.castingChangeLog.deleteMany()
  console.log(`  ✓ Deleted ${changeLogs.count} casting change logs`)

  const castings = await prisma.casting.deleteMany()
  console.log(`  ✓ Deleted ${castings.count} castings`)

  const confirmed = await prisma.workshopConfirmedActor.deleteMany()
  console.log(`  ✓ Deleted ${confirmed.count} confirmed actors`)

  const avail = await prisma.actorWorkshopAvailability.deleteMany()
  console.log(`  ✓ Deleted ${avail.count} actor availabilities`)

  const rooms = await prisma.room.deleteMany()
  console.log(`  ✓ Deleted ${rooms.count} rooms`)

  const scenarios = await prisma.scenario.deleteMany()
  console.log(`  ✓ Deleted ${scenarios.count} scenarios`)

  const workshops = await prisma.workshop.deleteMany()
  console.log(`  ✓ Deleted ${workshops.count} workshops`)

  const actors = await prisma.actor.deleteMany()
  console.log(`  ✓ Deleted ${actors.count} actors`)

  const groups = await prisma.participantGroup.deleteMany()
  console.log(`  ✓ Deleted ${groups.count} participant groups`)

  const orgs = await prisma.organization.deleteMany()
  console.log(`  ✓ Deleted ${orgs.count} organizations`)

  const topics = await prisma.topic.deleteMany()
  console.log(`  ✓ Deleted ${topics.count} topics`)

  const goals = await prisma.annualGoal.deleteMany()
  console.log(`  ✓ Deleted ${goals.count} annual goals`)

  const backupLogs = await prisma.backupLog.deleteMany()
  console.log(`  ✓ Deleted ${backupLogs.count} backup logs`)

  // ── 2. Delete all non-admin persons and their roles ────────────────────────
  const ADMIN_EMAIL = "daniel.prag@gmail.com"

  await prisma.personRole.deleteMany({ where: { person: { email: { not: ADMIN_EMAIL } } } })
  const persons = await prisma.person.deleteMany({ where: { email: { not: ADMIN_EMAIL } } })
  console.log(`  ✓ Deleted ${persons.count} person accounts`)

  // ── 3. Upsert admin account ────────────────────────────────────────────────
  const TEMP_PASSWORD = "12345678"
  const passwordHash = await hash(TEMP_PASSWORD, 12)

  const admin = await prisma.person.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      passwordHash,
      mustChangePassword: true,
      active: true,
    },
    create: {
      name: "Daniel Prag",
      email: ADMIN_EMAIL,
      passwordHash,
      mustChangePassword: true,
      active: true,
    },
  })

  // Ensure MANAGER and TECH roles exist (upsert-safe)
  for (const role of ["MANAGER", "TECH"] as const) {
    await prisma.personRole.upsert({
      where: { personId_role: { personId: admin.id, role } },
      update: {},
      create: { personId: admin.id, role },
    })
  }

  console.log(`\n✅ Reset complete.`)
  console.log(`   Admin: ${ADMIN_EMAIL} / ${TEMP_PASSWORD}  (must change password on first login)`)
  console.log(`   Roles: MANAGER + TECH`)
  console.log(`   AppSettings preserved (Google Drive tokens untouched).`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
