import { PrismaClient, Role } from "@prisma/client"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import { hash } from "bcryptjs"
import path from "path"

const dbPath = path.resolve(process.cwd(), "dev.db")
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("Seeding database...")

  const TEMP_PASSWORD = "Temp1234!"
  const passwordHash = await hash(TEMP_PASSWORD, 12)

  const users: { name: string; email: string; roles: Role[]; mustChangePassword: boolean }[] = [
    {
      name: "רונית כהן",
      email: "ronit@simcenter.co.il",
      roles: [Role.MANAGER],
      mustChangePassword: false, // Manager can login immediately with a known password
    },
    {
      name: "מיכל לוי",
      email: "michal@simcenter.co.il",
      roles: [Role.TECH],
      mustChangePassword: true,
    },
    {
      name: "דנה אברהם",
      email: "dana@simcenter.co.il",
      roles: [Role.CASTER],
      mustChangePassword: true,
    },
    {
      name: "יעל שפירא",
      email: "yael@simcenter.co.il",
      roles: [Role.FEEDBACK_DOCUMENTER],
      mustChangePassword: true,
    },
    {
      name: "אמיר גולן",
      email: "amir@simcenter.co.il",
      roles: [Role.FACILITATOR],
      mustChangePassword: true,
    },
    {
      name: "שרה ברק",
      email: "sara@simcenter.co.il",
      roles: [Role.FACILITATOR],
      mustChangePassword: true,
    },
  ]

  for (const user of users) {
    const { roles, ...data } = user
    const person = await prisma.person.upsert({
      where: { email: data.email },
      update: {},
      create: {
        ...data,
        passwordHash,
        roles: {
          create: roles.map((role) => ({ role })),
        },
      },
    })
    console.log(`  ✓ ${person.name} (${data.email})`)
  }

  // Seed topics
  const topics = [
    "שיחה מורכבת",
    "ניהול כיתה",
    "הצבת גבולות",
    "קונפליקט",
    "תקשורת בין-אישית",
    "מנהיגות",
  ]

  for (const name of topics) {
    await prisma.topic.upsert({
      where: { id: name }, // use name as temp key; will use actual UUID in production
      update: {},
      create: { name },
    }).catch(async () => {
      // If the above fails (no unique on name), just create
      const exists = await prisma.topic.findFirst({ where: { name } })
      if (!exists) await prisma.topic.create({ data: { name } })
    })
  }

  console.log(`  ✓ ${topics.length} topics seeded`)
  console.log("\nSeed complete.")
  console.log(`\nManager login: ronit@simcenter.co.il / ${TEMP_PASSWORD}`)
  console.log(`All other users: <email> / ${TEMP_PASSWORD} (forced change on first login)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
