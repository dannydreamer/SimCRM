"use client"

import { useSyncExternalStore } from "react"
import { greetingFor } from "@/lib/greeting"

// Re-checked once a minute so an open tab rolls from morning to afternoon.
// The server snapshot is null: the server's clock and the viewer's may sit
// either side of an hour, so the greeting appears only after hydration.
const subscribe = (cb: () => void) => {
  const t = setInterval(cb, 60_000)
  return () => clearInterval(t)
}
const getSnapshot = () => {
  const g = greetingFor(new Date())
  return `${g.text}|${g.emoji}`
}
const getServerSnapshot = () => null

/** "בוקר טוב, דנה ☀️" in place of the bare name in the header. §6.9 */
export function Greeting({ name }: { name: string }) {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  if (!snap) return <span className="font-medium truncate">{name}</span>
  const [text, emoji] = snap.split("|")
  const first = name.trim().split(/\s+/)[0]
  return (
    <span className="font-medium truncate" title={name}>
      {text}, {first} <span aria-hidden>{emoji}</span>
    </span>
  )
}
