"use client"

import { createContext, useContext } from "react"

interface UserContextValue {
  id: string
  name: string
  email: string
  roles: string[]
}

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({ user, children }: { user: UserContextValue; children: React.ReactNode }) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>
}

export function useUser() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error("useUser must be used within UserProvider")
  return ctx
}
