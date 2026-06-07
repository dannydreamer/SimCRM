import { prisma } from "@/lib/prisma"
import { compare } from "bcryptjs"
import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

const SESSION_MAX_AGE = parseInt(process.env.SESSION_MAX_AGE ?? "2592000", 10)

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
  jwt: { maxAge: SESSION_MAX_AGE },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const person = await prisma.person.findUnique({
          where: { email: credentials.email.toLowerCase() },
          include: { roles: true },
        })

        if (!person || !person.active) return null

        const passwordMatch = await compare(credentials.password, person.passwordHash)
        if (!passwordMatch) return null

        return {
          id: person.id,
          name: person.name,
          email: person.email,
          roles: person.roles.map((r) => r.role),
          mustChangePassword: person.mustChangePassword,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.roles = user.roles
        token.mustChangePassword = user.mustChangePassword
      }
      // Allow updating mustChangePassword in session after password change
      if (trigger === "update" && session?.mustChangePassword === false) {
        token.mustChangePassword = false
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id
      session.user.roles = token.roles
      session.user.mustChangePassword = token.mustChangePassword
      return session
    },
  },
}
