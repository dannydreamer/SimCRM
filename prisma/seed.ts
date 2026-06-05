import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient, Role } from "@prisma/client"
import { hash } from "bcryptjs"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("Seeding database...")

  const TEMP_PASSWORD = "Temp1234!"
  const passwordHash = await hash(TEMP_PASSWORD, 12)

  const users: { name: string; email: string; role: Role; mustChangePassword: boolean }[] = [
    { name: "רונית כהן",   email: "ronit@simcenter.co.il",    role: Role.MANAGER,              mustChangePassword: false },
    { name: "מיכל לוי",   email: "michal@simcenter.co.il",   role: Role.TECH,                 mustChangePassword: true  },
    { name: "דנה אברהם",  email: "dana@simcenter.co.il",     role: Role.CASTER,               mustChangePassword: true  },
    { name: "יעל שפירא",  email: "yael@simcenter.co.il",     role: Role.FEEDBACK_DOCUMENTER,  mustChangePassword: true  },
    { name: "אמיר גולן",  email: "amir@simcenter.co.il",     role: Role.FACILITATOR,          mustChangePassword: true  },
  ]

  for (const { role, ...data } of users) {
    const person = await prisma.person.upsert({
      where:  { email: data.email },
      update: {},
      create: {
        ...data,
        passwordHash,
        roles: { create: [{ role }] },
      },
    })
    console.log(`  ✓ ${person.name} (${data.email}) — ${role}`)
  }

  console.log("\nSeed complete.")
  console.log(`Manager login:   ronit@simcenter.co.il / ${TEMP_PASSWORD}`)
  console.log(`All other users: <email> / ${TEMP_PASSWORD} (forced password change on first login)`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
