// The text a deck is made from, saved per workshop — spec §14 F-06, "Enter once".
//
// Pure functions only, shared by the routes, the screen and check:deck:
// reading the saved JSON back safely, which fields a set of templates asks
// for, and which of those are empty before a deck is generated.

import type { ScheduleRow } from "./docx"

export type ScenarioText = {
  scenarioId: string
  title: string
  /** One paragraph per line. */
  body: string
  fileName: string | null
}

export type DeckContent = {
  /** As the cover should read; "" = the CRM's name. */
  organization: string
  group: string
  schedule: ScheduleRow[]
  scheduleFileName: string | null
  scenarios: ScenarioText[]
}

export const EMPTY_CONTENT: DeckContent = {
  organization: "", group: "", schedule: [], scheduleFileName: null, scenarios: [],
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "")

/** Anything from the browser or the database, made safe and bounded. */
export function cleanContent(raw: unknown): DeckContent {
  const r = (raw ?? {}) as Record<string, unknown>
  const schedule = (Array.isArray(r.schedule) ? r.schedule : []).slice(0, 40).map((row) => ({
    activity: str((row as ScheduleRow)?.activity, 300),
    time: str((row as ScheduleRow)?.time, 50),
  }))
  const seen = new Set<string>()
  const scenarios: ScenarioText[] = []
  for (const s of (Array.isArray(r.scenarios) ? r.scenarios : []).slice(0, 30)) {
    const id = str((s as ScenarioText)?.scenarioId, 100)
    if (!id || seen.has(id)) continue
    seen.add(id)
    scenarios.push({
      scenarioId: id,
      title: str((s as ScenarioText)?.title, 300),
      body: str((s as ScenarioText)?.body, 20000),
      fileName: str((s as ScenarioText)?.fileName, 300) || null,
    })
  }
  return {
    organization: str(r.organization, 200),
    group: str(r.group, 200),
    schedule,
    scheduleFileName: str(r.scheduleFileName, 300) || null,
    scenarios,
  }
}

/** The stored row back as content. */
export function fromRow(row: {
  organization: string; groupName: string; schedule: string; scheduleFileName: string | null; scenarios: string
}): DeckContent {
  const parse = (s: string) => { try { return JSON.parse(s) } catch { return [] } }
  return cleanContent({
    organization: row.organization,
    group: row.groupName,
    schedule: parse(row.schedule),
    scheduleFileName: row.scheduleFileName,
    scenarios: parse(row.scenarios),
  })
}

/** Content as stored. */
export function toRow(c: DeckContent) {
  return {
    organization: c.organization,
    groupName: c.group,
    schedule: JSON.stringify(c.schedule),
    scheduleFileName: c.scheduleFileName,
    scenarios: JSON.stringify(c.scenarios),
  }
}

/** The schedule rows worth a table row: either cell filled. */
export function scheduleRows(c: DeckContent): ScheduleRow[] {
  return c.schedule
    .map((r) => ({ activity: r.activity.trim(), time: r.time.trim() }))
    .filter((r) => r.activity || r.time)
}

/** The saved text for each active CRM scenario, in CRM order; blank where none was saved. */
export function scenarioTexts(c: DeckContent, scenarioIds: string[]): ScenarioText[] {
  return scenarioIds.map((id) =>
    c.scenarios.find((s) => s.scenarioId === id) ?? { scenarioId: id, title: "", body: "", fileName: null })
}

// ─── Which fields the screen shows ───────────────────────────────────────────

export type DeckFields = { cover: boolean; schedule: boolean; scenarios: boolean }

/**
 * A field shows when any template in play uses it — the union, so one
 * facilitator's richer template does not hide a field from the others' view.
 */
export function fieldsFor(templates: string[][]): DeckFields {
  const all = new Set(templates.flat())
  return {
    cover: all.has("organization") || all.has("group"),
    schedule: all.has("row.activity") || all.has("row.time"),
    scenarios: all.has("scenario.title") || all.has("scenario.body"),
  }
}

/**
 * The fields a template uses that are empty — said before generating, never
 * blocking: any placeholder may be empty, but an empty one is usually a file
 * nobody uploaded. The cover falls back to the CRM's names, so is never empty.
 */
export function emptyFields(c: DeckContent, scenarioIds: string[], tokens: string[]): string[] {
  const has = (t: string) => tokens.includes(t)
  const out: string[] = []
  if ((has("row.activity") || has("row.time")) && scheduleRows(c).length === 0) out.push("לוח הזמנים")
  scenarioTexts(c, scenarioIds).forEach((s, i) => {
    if (has("scenario.title") && !s.title.trim()) out.push(`שם תרחיש ${i + 1}`)
    if (has("scenario.body") && !s.body.trim()) out.push(`תקציר תרחיש ${i + 1}`)
  })
  return out
}
