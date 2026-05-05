import { Role } from "@prisma/client"
import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name: string
      email: string
      roles: Role[]
      mustChangePassword: boolean
    }
  }

  interface User {
    id: string
    name: string
    email: string
    roles: Role[]
    mustChangePassword: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    roles: Role[]
    mustChangePassword: boolean
  }
}
