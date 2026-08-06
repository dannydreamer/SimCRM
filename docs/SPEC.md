# SimCenter CRM (SimCRM) — Consolidated Product Specification

**Version 2.0 | August 2026**
**Status: As-built + forward-looking. This is the single source of truth.**

---

## 0. About This Document

### 0.1 Purpose

This document consolidates every prior specification, design session, and implementation decision for the SimCenter CRM into one authoritative spec. It replaces all earlier documents and is the baseline for future versions.

### 0.2 Sources merged into this document

| Source | Date | What it contributed |
|---|---|---|
| `SimCenter_CRM_Spec.docx` (v1.0–1.3) | April 2026 | Original full product spec — data model, status flow, permissions, build sessions, rollout phasing |
| `simcenter_crm_design_spec.md` (v0.1) | May 2026 | UI/UX design spec — brand, layout, screen-by-screen visual design, corrections to the original |
| `docs/decisions.md` | May 2026 | Pre-build decisions log — 15 resolved ambiguities. Found in the repo; see §0.6 |
| Claude.ai conversation #1 | ~Aug 2026 | Pre-launch checklist and rollout advice (now Appendix A) |
| Claude.ai conversation #2 | ~Aug 2026 | Full backup system specification |
| Claude Code session "SimCRM" | to Aug 2026 | Sessions 18–19, rollout, and post-rollout changes |
| *Future Features* loose notes | Aug 2026 | V2 roadmap — now §14, which replaces that file |
| **Source code** — `dannydreamer/SimCRM` | Aug 2026 | **Ground truth.** 168 commits, Prisma schema, business logic |

### 0.3 Precedence rule

Where sources conflict, this document resolves the conflict inline and states the resolution. **Where this document describes behaviour marked `[code]`, the source code is authoritative** — it reflects what is actually running in production.

### 0.4 Verification legend

Every substantive claim in this document carries a marker:

- **`[code]`** — Verified directly against the source code. This is what the system actually does.
- **`[spec]`** — Specified in a prior document and not contradicted by code, but not independently verified. Treat as intent.
- **`[gap]`** — Specified but **not** implemented, or implemented differently than specified. Flagged for decision.
- **`[?]`** — Uncertain or unrecoverable. Needs the user's confirmation.

### 0.5 Known limitation of this consolidation

The Claude Code sessions that built **Sessions 1–17** are no longer recoverable — their transcripts were cleaned up from local history.

To compensate, this document was reconstructed from the **source code and git history**, which is a more reliable record of what was built than any transcript would have been. However, *reasons* for decisions made in those lost sessions are not recoverable — only outcomes. Sections reconstructed this way are marked `[code]`.

---

### 0.6 Decisions that were later reversed

`docs/decisions.md` (May 2026) resolved 15 ambiguities before the build. Most were implemented and are folded into the body of this document. **Three were not**, and are recorded here so they are not mistaken for current behaviour:

| Decision (May 2026) | What actually happened |
|---|---|
| **"Facilitator role — no system login."** Facilitators exist only for assignment; no Facilitator-facing screens. | **Reversed.** Facilitators *can* log in. `LOGIN_ROLES` includes FACILITATOR, and they have nav access to סדנאות (own workshops only) and לוח שנה. `[code]` |
| **"Org Detail shows a flat chronological list of workshops — no grouping by participant group."** | **Reversed.** The org detail page has a **קבוצות משתתפות** section with one expandable card per group, each listing that group's workshops. `[code]` |
| **"חד׳ column shows the count of active (non-cancelled) rooms, not the `num_rooms` estimate."** | **Not implemented.** See §13 item 1. `[gap]` |

Its stack and backup sections (items 13–15: SQLite, Railway/Render, 2 AM backup, 30-day retention) are superseded by §2 and §9 of this document.

---

## 1. System Overview

SimCenter CRM ("SimCRM") is an internal web application for the כיתקטיקה simulation center. It replaces a fragmented set of Google Sheets, WhatsApp groups, and paper records.

It manages the full lifecycle of a simulation workshop: initial booking of a client group → needs assessment and scenario specification → actor casting → facilitator assignment → the workshop itself → post-workshop feedback and closure.

- **Users:** ~6 internal staff. Not public-facing. `[spec]`
- **Language:** 100% Hebrew UI, RTL throughout, no exceptions. `[code]`
- **Status:** Live in production since ~August 2026. `[code]`

### 1.1 Core user roles

| Role | Hebrew | Primary responsibility |
|---|---|---|
| Manager | מנהלת | Full system access. Books workshops, assigns facilitators, oversees all operations. |
| Tech | מפעילה טכנית | Enters workshop data, runs needs assessment, tracks checklists, marks PPT and letters received, sends to casting. |
| Caster | מלהקת | Confirms actor attendance and assigns actors/directors to scenarios. Manages actor pool. |
| Feedback Documenter | מתעד/ת פידבק | Enters post-workshop actor feedback. Maintains actor development log. |
| Facilitator | מתחקר/ת | Runs workshops. Authors scenarios. Sends PPT and summary letter. Minimal CRM access. |
| Actor | שחקן/ית | Performs in simulations. **Not a system user** — no login. |

A person may hold multiple roles simultaneously. `[code]` — `PersonRole` is a many-to-many join.

---

## 2. Technology & Deployment (As Built)

> ⚠ **This section supersedes Section 10 of the original spec entirely.** The original specified SQLite and Railway/Render/Hetzner hosting. Neither was used.

| Concern | As built | Original spec said |
|---|---|---|
| Framework | Next.js 16.2.4 (App Router), React 19.2.4 | Node.js + Express + React/Vite |
| Database | **PostgreSQL via Supabase** | SQLite or PostgreSQL |
| ORM | Prisma 7.8 with `@prisma/adapter-pg` | Prisma |
| Auth | NextAuth 4.24 + bcryptjs | JWT + bcrypt |
| Hosting | **Vercel** (Pro — needed for Cron + 300s functions) | Railway / Render / Hetzner VPS |
| Repo | `github.com/dannydreamer/SimCRM` | — |
| Styling | Tailwind CSS | Tailwind + Shadcn/ui |

`[code]` — all rows verified against `package.json`, `prisma/schema.prisma`, `vercel.json`.

### 2.1 Branching model

`main` (production, auto-deploys via Vercel) ← `develop` ← `session-N-*` feature branches. `[code]`

### 2.1.1 Environments — what runs where

| | Runs the code | Holds the data |
|---|---|---|
| **Production** — `main` | Vercel, Production environment | Supabase project `sim-crm` |
| **Preview** — any other branch | Vercel, Preview environment | Supabase project `sim_crm_testing` |

Vercel and Supabase are separate services doing separate jobs: Vercel executes the app, Supabase stores everything that persists. The only link between them is `DATABASE_URL`.

**Vercel scopes environment variables by environment, not by branch.** One `DATABASE_URL` under Preview therefore serves *every* preview deployment from *every* branch. It is a one-time setup, not a per-branch chore. `[code]`

> Until August 2026 there was **no separate test database** — Preview and Production both pointed at the live Supabase project, so any preview deployment read and wrote real data. `sim_crm_testing` was created to end that. Never point Preview back at production.

**Supabase's own GitHub integration is not used.** There is no `supabase/` directory in this repo; schema is owned by Prisma migrations. Do not connect test projects to GitHub — it would compete with Prisma for control of the schema. `[code]`

### 2.1.2 Release procedure — migrations are never automatic

**Nothing applies migrations on your behalf.** The Vercel build command is `prisma generate && next build` (see `package.json`) — there is no `migrate` step. Deploying code therefore **never** changes the database. This is deliberate: it stops a code deploy from silently reshaping live data. It also means the migration is a conscious act, against each database separately. `[code]`

The failure mode this prevents, and the one it creates, are both worth naming: code deployed against a database that hasn't been migrated will error on exactly the pages using the new field, while the rest of the app looks fine.

**Order of operations for a change that includes a migration:**

1. Apply the migration to `sim_crm_testing`, push the branch, test on the preview URL.
2. When satisfied, apply the migration to **production**.
3. *Then* merge to `main` and let it deploy.

Step 2 precedes step 3 for **additive** migrations — a new table, or a new nullable column. Production's currently-running code does not know the new field exists and is unaffected, so there is no anxious window. A **destructive** migration (dropping or renaming a column) inverts this and needs a deploy-first, migrate-after sequence with a compatibility window; none has been needed to date.

`prisma migrate deploy` is idempotent — it compares `prisma/migrations/` against the `_prisma_migrations` table and applies only what is missing. Running it twice is a no-op. It is always safe to run when unsure which state a database is in.

**Rebuilding the test database.** Migrations only move forward, so a test database used across several branches can accumulate columns from branches since abandoned — harmless in isolation, but two branches with conflicting schema changes can leave it matching neither. The remedy is to rebuild rather than repair: `prisma migrate reset` against the test database, then restore the latest Google Drive backup (§9). Do this as routine hygiene when starting a new feature, not only when something looks wrong — it also refreshes the test data from production.

> ⚠ `prisma migrate reset` erases everything in the database it is pointed at. Keep the production connection string off local machines; the only `.env` on a developer machine should hold `sim_crm_testing`.

### 2.2 Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase Postgres connection string (transaction pooler, port 6543) — runtime |
| `DIRECT_URL` | Supabase direct/session connection (port 5432) — **migrations only.** Set in both Vercel environments; also required in a local `.env` to run `prisma migrate deploy` |
| `NEXTAUTH_SECRET` | NextAuth session signing |
| `NEXTAUTH_URL` | Deployment URL |
| `GOOGLE_CLIENT_ID` | Google Drive OAuth (backup) |
| `GOOGLE_CLIENT_SECRET` | Google Drive OAuth (backup) |
| `CRON_SECRET` | Auto-managed by Vercel; authenticates the nightly cron request |

`[code]`

> ⚠ **Known operational constraint:** the Supabase transaction pooler rejects Prisma's prepared statements for DDL. Schema migrations that add enum values cannot be applied via `prisma migrate deploy` from a local machine — they must be applied as direct SQL and then recorded manually in `_prisma_migrations`. `[code]` — this was hit and worked around when adding the `ZOOM` location type.

### 2.3 Security

- HTTPS only. `[spec]`
- Passwords stored bcrypt-hashed, never plaintext. Minimum 8 characters, no complexity rules. `[code]`
- Sessions expire after 8 hours of inactivity or on browser close. `[spec]`

---

## 3. Data Model

> Authoritative source: `prisma/schema.prisma`. All of Section 3 is `[code]`.

### 3.1 Enums

| Enum | Values |
|---|---|
| `Role` | MANAGER, TECH, CASTER, FEEDBACK_DOCUMENTER, FACILITATOR |
| `ShiyuchPedagogi` | GIL_HARACH, YESODI, TICHON, CHINUCH_MEYUCHAD, SHAFACH, MOVILEI_TECHUM, IRIYAT_YERUSHALAIM, MANCHI, ACHER |
| `ShiyuchTakzivi` | OVDEI_HORAA, MANCHI, IRIYAT_YERUSHALAIM_TASHLUM, CHUTZNIIOT_TASHLUM |
| `WorkshopStatus` | NEW, SPECIFIED, READY, CLOSING, CLOSED, CANCELLED |
| `LocationType` | CENTER, EXTERNAL, **ZOOM** |
| `RagColor` | GREEN, YELLOW, RED |
| `Gender` | MALE, FEMALE |
| `BackupType` | AUTO, MANUAL |
| `BackupStatus` | RUNNING, SUCCESS, FAILED |

**Hebrew labels** (`src/lib/shiyuch.ts`, `src/lib/roles.ts`):

- שיוך פדגוגי: גיל הרך · בי"ס יסודי · חטיבות ותיכונים · חינוך מיוחד · שפ"ח · מובילי תחום מדריכות ומפקחים · עיריית ירושלים · מנח"י · אחר
- שיוך תקציבי: עובדי הוראה · מנח"י · עיריית ירושלים בתשלום · סדנאות חיצוניות בתשלום
- Statuses: סדנה חדשה · בוצע איתור צרכים · מוכן · בתהליך סגירה · סגור · בוטל

### 3.2 Person / PersonRole

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | String | |
| email | String @unique | Login identifier |
| passwordHash | String | bcrypt |
| mustChangePassword | Boolean | Default **true** — forces password change on first login |
| active | Boolean | Soft delete |
| createdAt | DateTime | |

`PersonRole` is a separate table: `(personId, role)` unique. A person can hold any combination of roles.

### 3.3 Organization

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | String | |
| city | String | Required |
| **shiyuchPedagogi** | ShiyuchPedagogi | **Mandatory** |
| **shiyuchTakzivi** | ShiyuchTakzivi | **Mandatory** |
| pocName / pocPhone / pocEmail | String? | Point of contact |
| notes | String? | Free text |
| createdAt | DateTime | |

> **Resolved conflict:** The original spec (§2.1) had a single `shiyuch` field with 9 values. The v1.2 changelog split it into two mandatory fields. **The split is correct and is what was built.**

### 3.4 ParticipantGroup

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| organizationId | FK → Organization | |
| name | String | e.g. מורים, יועצות, מנהלים |
| notes | String? | |

Multiple groups with the same name under one organization are permitted — no deduplication warning.

### 3.5 Workshop

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| participantGroupId | FK | |
| date | DateTime | |
| startTime / endTime | String | "HH:MM" |
| numRooms | Int | Estimate at creation, editable later |
| locationType | LocationType | CENTER / EXTERNAL / ZOOM |
| locationName | String? | Address if EXTERNAL, **meeting link if ZOOM** |
| authorId | FK → Person? | Scenario author (Facilitator role) |
| directorRequested | Boolean | Default false |
| directorNotes | String? | |
| status | WorkshopStatus | Default NEW |
| cancelled | Boolean | Default false |
| tentative | Boolean | Shows `?` badge |
| postponedWarning | Boolean | Set when date changes after casting/slotting |
| **roomCancelledWarning** | Boolean | Caster alert flag |
| **roomAddedWarning** | Boolean | Caster alert flag |
| feedbackFormAdded | Boolean | משוב משתתפים — Tech confirms the Google Form string was added |
| **castingMaleNeeded** | Int? | Total male actors required (set by Tech at send-to-casting) |
| **castingFemaleNeeded** | Int? | Total female actors required |
| **castingNotes** | String? | Tech's free-text brief to the Caster |
| **castingSentAt** | DateTime? | Timestamp of send-to-casting. Null = not yet sent |
| notes | String? | |
| createdAt / createdById | | |

Bolded fields are **not in either prior spec** — they were added during implementation.

### 3.6 Room

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workshopId | FK | |
| **roomNumber** | Int | **Integer, not a text label.** Unique per workshop |
| facilitatorId | FK → Person? | |
| pptReceived | Boolean | |
| facilitatorTentative | Boolean | Shows `?` next to facilitator name |
| cancelled | Boolean | Soft cancel |
| letterReceived | Boolean | |

> **Changed from spec:** the original specified `room_label` as free text ("Room 1", "Blue Room"). Implementation uses an integer `roomNumber` with a `@@unique([workshopId, roomNumber])` constraint. `[code]`

### 3.7 Scenario

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workshopId | FK | |
| name | String? | **Retained in the schema but no longer settable or displayed in the UI.** The name is never known at specification time — it only exists once the scenario is written — so every field was left blank in practice. Kept for the planned Scenario Library (F-03), which will populate it from uploaded scenario documents. Existing values still render in the change-log labels. |
| topicId | FK → Topic | **Required** |
| **modelId** | FK? → SimulationModel | **Nullable** — מודל סימולציה. Not required to create or write a scenario; becomes a hard precondition at שלח לליהוק (§7.2) |
| actorRequirements | String? | Free text brief for the Caster |
| **maleActorsNeeded** | Int | Default 0 — per-scenario slot count |
| **femaleActorsNeeded** | Int | Default 0 — per-scenario slot count |
| written | Boolean | |
| cancelled | Boolean | Soft cancel |
| **orderIndex** | Int | Display ordering |

> **Note:** `author_id` on Scenario (in the original spec) was **not** implemented — authorship is tracked at the Workshop level only. `[gap]`

### 3.8 Actor

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | String | |
| **gender** | Gender | **Mandatory** — drives the gendered casting pool |
| phone / email / languages | String? | |
| specialties | String? | Free text |
| canDirect | Boolean | Eligible for director slot |
| createdAt | DateTime | |

> `lastActive` is **not** a stored column — it is derived from Casting records at query time. `[code]`

### 3.9 Casting

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workshopId | FK | |
| scenarioId | FK? | Null for director records |
| roomId | FK? | Null for director records |
| actorId | FK → Actor | |
| isDirector | Boolean | |
| **slotGender** | String? | "MALE" / "FEMALE" / null for director |
| **slotIndex** | Int | Position within the gendered slot group |

A Casting record links an actor to a specific scenario **in a specific room**. Director records carry `scenarioId = null, roomId = null, isDirector = true`.

**Uniqueness rule:** the same actor may not be assigned twice to the same *scenario + room* combination, but **may** appear across multiple scenarios and rooms — that is intentional and expected (actor reuse). `[code]`

### 3.10 ActorWorkshopAvailability

| Field | Type | Notes |
|---|---|---|
| actorId + workshopId | unique | |
| available | Boolean | Default false |

The Caster's per-workshop availability scratch pad. Marking an actor available does **not** assign them — it makes them selectable in Step 1.

### 3.11 WorkshopConfirmedActor — *Step 1 of casting*

| Field | Type | Notes |
|---|---|---|
| workshopId | FK | Cascade delete |
| actorId | FK | |
| gender | String | "MALE" / "FEMALE" |
| slotIndex | Int | 0-based within gender |

Unique on `(workshopId, gender, slotIndex)`.

> **This model does not exist in either prior spec.** It implements the two-stage casting flow described in §7. `[code]`

### 3.12 CastingChangeLog

| Field | Type | Notes |
|---|---|---|
| workshopId | FK | |
| changeType | String | SENT, RESENT, SCENARIO_REQ, SCENARIO_CANCELLED, ROOM_CANCELLED, ROOM_ADDED, COUNTS_CHANGED, MODEL_CHANGED, DATE_CHANGED |
| detail | String | Hebrew description, e.g. "תרחיש 2 בוטל" |
| dismissed | Boolean | |
| createdAt | DateTime | |

Drives the Caster's change-alert banners. Hebrew labels:

| Type | Label |
|---|---|
| SENT | נשלח לליהוק |
| RESENT | עדכון ושליחה חוזרת לליהוק |
| SCENARIO_REQ | דרישות שחקנים עודכנו |
| SCENARIO_CANCELLED | תרחיש בוטל |
| ROOM_CANCELLED | חדר בוטל |
| ROOM_ADDED | חדר נוסף לסדנה |
| COUNTS_CHANGED | מספרים כמותיים עודכנו |
| MODEL_CHANGED | מודל סימולציה עודכן |
| DATE_CHANGED | הסדנה נדחתה |

`MODEL_CHANGED` is written **only** when a scenario's `modelId` changes on a workshop where `castingSentAt` is already set. Before casting is sent, setting the model is ordinary Tech workflow and writes nothing.

Dismissal is tracked **per user in localStorage** (key `simcrm:dismissed-logs`) in addition to the DB flag. `[code]`

### 3.13 Feedback

| Field | Type | Notes |
|---|---|---|
| actorId | FK | |
| workshopId | FK | |
| **roomId** | FK? | **Nullable — null for director feedback** |
| aspect1PrepColor / Text | RagColor / String? | התכוננות לסדנה |
| aspect2SimColor / Text | RagColor / String? | השחקן כסימולטור |
| aspect3ReflectionColor / Text | RagColor / String? | שיקוף |
| aspect4ProfessionalColor / Text | RagColor / String? | התנהלות מקצועית |
| enteredById | FK → Person | |
| enteredAt | DateTime | |

Feedback is scoped to **Actor × Workshop × Room**, so two facilitators who worked with the same actor give independent feedback.

### 3.14 Remaining models

- **Topic** — `id, name, active, createdAt`. Soft-delete via `active`.
- **SimulationModel** — `id, name, active, createdAt`. Mirrors Topic exactly, including soft-delete via `active`. Backs `Scenario.modelId`; managed from רשימות מערכת (§8.10). Seeded with six values: קלאסי · 2*7 · כיסא חם · סימולציה בראש אחר · אייכה · סימולציה בתנועה. Historical scenarios were **not** backfilled — their `modelId` stays null.
- **ActorDevelopmentLog** — `actorId, date, note, enteredById, createdAt`.
- **AnnualGoal** — `year, shiyuchTakzivi, allocation`. Unique on `(year, shiyuchTakzivi)`.
- **AppSettings** — singleton (`id = 1`): `driveFolderId`, `googleAccessToken`, `googleRefreshToken`, `googleTokenExpiry`.
- **BackupLog** — `type, status, filePath, fileSize, errorMsg, createdAt`.

---

## 4. Workshop Status & Workflow Logic

> Authoritative source: `src/lib/workshop-status.ts`. All of Section 4 is `[code]` unless marked otherwise.

### 4.1 The six statuses

| Status | Hebrew | Set by |
|---|---|---|
| NEW | סדנה חדשה | Manager, at creation |
| SPECIFIED | בוצע איתור צרכים | Tech, manual declaration |
| READY | מוכן | **System only** |
| CLOSING | בתהליך סגירה | **System only** |
| CLOSED | סגור | **System only** |
| CANCELLED | בוטל | Manager, manual |

**READY, CLOSING, and CLOSED are system-triggered exclusively.** No user action sets them directly.

### 4.2 Transition rules

```
NEW ──(Tech marks needs assessment)──▶ SPECIFIED
                                          │
        ┌─────────────────────────────────┤
        │                                 │
   (date passes)                  (3 conditions met)
        │                                 │
        ▼                                 ▼
     CLOSING ◀───(date passes)───────── READY
        │                                 │
        │                    (any condition unmet, before date)
        │                                 │
        │                                 ▼
        │                            SPECIFIED
        │
  (all letters ✓ AND feedback complete)
        │
        ▼
      CLOSED ──(letter unchecked OR feedback incomplete)──▶ CLOSING
```

### 4.3 The three READY conditions

A workshop advances SPECIFIED → READY only when **all three** hold:

1. **All active (non-cancelled) rooms have `pptReceived = true`** — and there is at least one room.
2. **Casting is fully complete** — `castingSentAt` is set, and filled slots equal total slots, where
   `total = (Σ per-scenario male+female needed across active scenarios) × (number of active rooms) + (1 if directorRequested)`
3. **`feedbackFormAdded = true`** — the משוב משתתפים checkbox.

> **Resolved conflict:** the original spec (§3.1 stage 5) said READY = "casting complete AND all rooms have PPT ✓" — two conditions. The design spec added the משוב עודכן blocker as a third. **The three-condition version is correct and is what runs.**

### 4.4 Critical rules

**NEW never auto-advances.** A workshop still in סדנה חדשה after its date has passed stays there. Instead the workshop table shows a red inline badge under the status pill:

> ⚠ תאריך עבר ולא בוצע איתור צרכים

This is deliberate — it surfaces forgotten workshops rather than silently pushing them through the flow.

**SPECIFIED always advances to CLOSING once the date passes**, regardless of checklist completeness. Incomplete PPT, incomplete casting, or missing anything else does **not** block it. Incomplete items remain visible as warnings.

The date check is:
```ts
if (wDateStart < todayStart || now >= wEndDateTime) → CLOSING
```
A workshop dated in the past transitions immediately. A workshop dated *today* waits for its end time. `[code]`

**READY can regress to SPECIFIED** if any of the three conditions becomes unmet before the date passes — e.g. an actor is removed from Step 1 casting, or a scenario is un-written (which auto-unchecks PPT on all active rooms).

**CLOSED can regress to CLOSING** if a letter is unchecked or feedback becomes incomplete.

### 4.5 Feedback completeness

A feedback record counts as complete only when **at least one aspect has free text**. A record left at default green with no text does not count. `[code]` — this is what gates CLOSING → CLOSED.

Expected feedback = one record per `(roomId, actorId)` for every active casting, **including the director** (whose `roomId` is null).

### 4.6 PPT prerequisites

`pptReceived` can only be checked when the room has a facilitator assigned **and** all scenarios are written — **except** when the workshop is in CLOSING, where both restrictions are lifted so late data entry is possible. `[code]`

Un-writing a scenario auto-unchecks `pptReceived` on all active rooms in that workshop. `[code]`

### 4.7 Cancellation & postponement

- A workshop may be cancelled at **any** status, **including CLOSING and CLOSED**. `[code]` — this was added post-rollout for the real case of a group cancelling at the last moment and needing to be excluded from statistics.
- Cancelled workshops remain in the system, shown with strikethrough, and are accessible read-only to all roles.
- Changing the date after casting or slotting sets `postponedWarning`, showing an amber banner: **⚠ התאריך שונה — יש לאמת זמינות שחקנים ומתחקרים**. A `DATE_CHANGED` entry is written to the casting change log so the Caster is alerted.
- Rooms and scenarios use **soft cancellation** — crossed out, never deleted, excluded from all checklists and casting requirements. Manager only.

---

## 5. Permissions

> Source: `src/lib/roles.ts` for navigation; individual API route guards for actions. `[code]`

### 5.1 Navigation visibility

| Nav item | Path | Visible to |
|---|---|---|
| סדנאות | `/sadnaot` | Manager, Tech, Feedback Doc, Facilitator |
| ארגונים | `/irgunnim` | Manager, Tech |
| לוח שנה | `/luach` | **All roles** |
| ליהוק | `/lihukim` | Manager, Caster |
| שחקנים | `/shakhanim` | Manager, Tech, Caster, Feedback Doc |
| עומס מתחקרים | `/omas` | Manager |
| רשימות מערכת | `/nosim` | Manager, Tech |
| יעדי סדנאות | `/yaadot` | Manager |
| ניהול משתמשים | `/users` | Manager |
| הגדרות | `/settings` | Manager |

> **Changed from spec:** the Caster does **not** see סדנאות in navigation — she works from the ליהוק landing page. The calendar is open to **all** roles (the original spec said Manager only; the design spec said Manager + Tech).

### 5.2 Action permissions

| Action | Manager | Tech | Caster | Feedback Doc | Facilitator |
|---|---|---|---|---|---|
| Organizations — view | ✓ | ✓ | — | — | — |
| Organizations — create/edit | ✓ | ✓ | — | — | — |
| Workshops — view | ✓ | ✓ | via ליהוק | ✓ | Own only |
| Workshops — **create** | ✓ | — | — | — | — |
| Workshops — edit | ✓ | ✓ | — | — | — |
| Workshops — cancel | ✓ | — | — | — | — |
| Rooms — assign facilitator | ✓ | — | — | — | — |
| Rooms — mark PPT / letter | ✓ | ✓ | — | — | — |
| Scenarios — create/edit | ✓ | ✓ | — | — | — |
| Scenarios — mark written | ✓ | ✓ | — | — | — |
| **Send to casting** | ✓ | ✓ | — | — | — |
| Casting — view | ✓ | — | ✓ | — | — |
| Casting — availability, Step 1, Step 2 | ✓ | — | ✓ | — | — |
| Actors — view | ✓ | ✓ | ✓ | ✓ | — |
| Actors — **create** | ✓ | ✓ | ✓ | — | — |
| Actors — **edit** | ✓ | ✓ | ✓ | — | — |
| Actor feedback history & dev log — view | ✓ | — | — | ✓ | — |
| Feedback — enter/edit | ✓ | — | — | ✓ | — |
| Feedback — export | ✓ | — | — | ✓ | — |
| Dev log — write | ✓ | — | — | ✓ | — |
| Topics — view | ✓ | ✓ | — | — | — |
| Topics — edit | ✓ | — | — | — | — |
| Simulation models — view | ✓ | ✓ | — | — | — |
| Simulation models — edit | ✓ | — | — | — | — |
| Scenario simulation model — set/change | ✓ | ✓ | — | — | — |
| Soft-cancel room/scenario | ✓ | — | — | — | — |
| Facilitator Load, Goals, Users, Settings | ✓ | — | — | — | — |

### 5.3 Post-rollout permission changes `[code]`

Three changes were made after go-live, in this order:

1. **Manager granted full casting access** (`c7eb4f3`) — previously Manager could view casting but not assign. The original spec made assignment Caster-exclusive. **That restriction was removed** — Manager now has full availability, Step 1, and Step 2 access.
2. **Tech granted "add actor"** (`427fb3d`).
3. **Tech granted "edit actor"** (`b223f7f`) — basic profile fields only.

> ⚠ **Confirmed boundary:** Tech has **no access to feedback or development logs anywhere** — not viewing, not entering. The actor-edit permission covers profile fields (name, gender, phone, specialties, canDirect) only. `[code]`

---

## 6. Design System

> Source: `simcenter_crm_design_spec.md`, corroborated by the implemented Tailwind theme. `[spec]` unless noted.

### 6.1 Brand

- Product: כיתקטיקה simulation center internal CRM
- Palette:
  - Navy `#2C4B9A` · Teal `#0B8390` · Green `#31AA59` · Mint `#86C9BB` · Blush `#F9CFCC`
- **Dominant background: white (`#FFFFFF`)**
- No decorative brand motifs. Brand present through colour and logo only.
- Feel: clean, calm, functional. This is a work tool, not a showcase.

### 6.2 Language & layout

- **100% Hebrew.** Every label, button, placeholder, error, and tooltip.
- **RTL throughout.** Built RTL-first — not LTR flipped with `direction: rtl`.
- Date format: **DD.MM.YY** (e.g. `7.5.26`). `[code]`
- Negative numbers must render as `-9`, not `9-` — apply `dir="ltr"` on numeric cells. `[code]`

### 6.3 Typography

Heebo or Rubik (Google Fonts). Body 14px · table cells 13–14px · section headers 16px semi-bold · page titles 20–22px bold.

### 6.4 Status colours

| Status | Colour | Treatment |
|---|---|---|
| סדנה חדשה | Gray | Muted pill |
| בוצע איתור צרכים | Navy `#2C4B9A` | Colored pill |
| מוכן | Green `#31AA59` | Colored pill |
| בתהליך סגירה | Amber | Colored pill |
| סגור | Dark gray | Muted pill |
| בוטל | Red + row strikethrough | Muted pill |

### 6.5 RAG colours (feedback)

| Value | Label | Background |
|---|---|---|
| GREEN | תקין | `#D4EDDA` |
| YELLOW | במעקב | `#FFF3CD` |
| RED | חמור | `#F8D7DA` |

> **Changed from spec:** the original labels were ירוק / צהוב / אדום ("טוב / לשיפור / בעיה"). Implementation uses **תקין / במעקב / חמור**, displayed in the order **RED → YELLOW → GREEN**. `[code]`

> **Changed from spec:** the original spec was emphatic that the selected colour becomes the **background of the entire text block**. Implementation applies the colour as a **border colour on the textarea** instead — a background tint proved to hurt readability. `[code]`

### 6.6 Interaction defaults

- Clicking a workshop row → Workshop Detail.
- Clicking an org name **anywhere** → Org Detail.
- Clicking a warning badge → Workshop Detail, scrolled to the relevant section.
- No modal-heavy flows — prefer inline editing and dedicated pages.
- Warning badges are informational, never blocking, never modal triggers.

### 6.7 Global chrome `[code]`

- **Header** (56px, white, bottom border): right side = logo + "מערכת ניהול"; left side = user name + role pill(s) + "יציאה" logout.
- **Nav**: horizontal row below header, role-filtered, active item highlighted.
- **Footer**: version number, small gray text.
- **Backup warning banner**: amber, non-dismissible, Manager only, shown when backup env vars are missing.

---

## 7. Casting — Two-Stage Flow

> **This is the single largest divergence from both prior specs.** Neither described this flow. Source: `src/app/(app)/lihukim/[id]/page.tsx`, `send-to-casting/route.ts`. All `[code]`.

### 7.1 Why it changed

The original three-panel design (requirements → pool → assignment grid) assumed the Caster assigns actors directly to scenario/room slots. In practice the Caster must first secure *physical attendance commitments* from a pool of freelancers, and only then decide who plays what. The implemented flow separates these two concerns.

### 7.2 Tech's handoff — שלח לליהוק

Before the Caster can work, Tech (or Manager) sends the workshop to casting.

**Preconditions:**
- Workshop status must be at least SPECIFIED (not NEW, not CANCELLED) — else: *"יש לבצע איתור צרכים לפני שליחה לליהוק"*
- At least one active scenario must have non-empty `actorRequirements` — else: *"יש להזין דרישות שחקנים לפחות לתרחיש אחד"*
- **Every** active (non-cancelled) scenario must have `modelId` set — else: *"יש לבחור מודל סימולציה לכל התרחישים הפעילים"*
- `castingMaleNeeded` and `castingFemaleNeeded` must both be supplied.

All preconditions are re-checked on **every** call — first send and re-send alike. `modelId` remains freely editable after casting has been sent; it is not locked.

**On send:**
- Sets `castingMaleNeeded`, `castingFemaleNeeded`, `castingNotes`, `castingSentAt`.
- Writes a `SENT` (or `RESENT` if already sent) change-log entry.
- **On re-send with reduced counts:** confirmed actors whose `slotIndex >= newCount` are deleted, and their Step 2 assignments are cleared, keeping Step 1 consistent.
- Triggers a status re-evaluation.

### 7.3 Page layout — four sections, in order

The casting page renders in this sequence (`7ff3bfa` fixed the ordering):

**1. 📋 דרישות הסדנה (עיון)** — read-only requirements panel, **expanded by default** (it was collapsed until August 2026; the Caster needs it on every visit). Per-scenario line reads `תרחיש N · <נושא> · מודל: <מודל>` followed by slot counts, then the requirements text. Shows a `🎬 דרוש/ה במאי/ת` pill when a director is requested.

> Topic and model render as plain text in one line, not as coloured pills — the model is the same class of information as the topic and should not be styled as though it were different.

**2. זמינות — availability.** Full actor list with a per-workshop availability toggle. Marking an actor available makes them *selectable* in Step 1; it does not commit them.

**3. שלב 1 — אישור הגעה פיזית.** The Caster fills exactly `castingMaleNeeded` male slots and `castingFemaleNeeded` female slots from available actors, plus the director slot if requested.
- The director slot lives in **Step 1**, not Step 2 (`28ca642`).
- The director picker draws from the **full available pool**, and **excludes actors already confirmed in Step 1** (`14b8fe8`).
- `step1Complete` requires targets set, all gendered slots filled, and the director resolved.

**4. שלב 2 — שיבוץ לתרחישים.** Disabled and dimmed until Step 1 is complete (*"יש להשלים את שלב 1 לפני שיבוץ לתרחישים"*). Dropdowns draw **only from Step 1 confirmed actors**. Slots are organised per scenario × room, gendered per `maleActorsNeeded` / `femaleActorsNeeded`.

`castingComplete = step1Complete && step2Complete`

### 7.4 Edge cases

- **All scenarios cancelled after casting was sent:** Step 2 shows *"אין תרחישים פעילים"* in gray rather than `X/0` in amber, and `step2Complete` returns **false** — 0/0 is explicitly not complete.
- **Some scenarios cancelled:** Step 2 slots update to reflect only active scenarios; ליהוק reverts to incomplete until the remaining slots are filled.
- Castings for cancelled scenarios are excluded from the filled count so orphaned slots don't inflate progress.
- The same actor may not appear twice in the same scenario + room, but may appear across different scenarios and rooms.

### 7.5 Live and reversible

No draft state, no confirmation step. Changes save immediately. Removing an actor reverts casting status, and — because that can regress READY → SPECIFIED — the client calls `router.refresh()` to invalidate the Next.js router cache so the workshop table doesn't show stale data. `[code]`

### 7.6 Caster change alerts

Banners on the ליהוק landing and detail pages, driven by `CastingChangeLog` (see §3.12). Amber for informational, red for cancellations. Dismissal is per-user via localStorage plus the DB flag.

---

## 8. Screens

### 8.1 Login — `/login`

Email + password. No self-service registration; accounts are Manager-created. No "forgot password" in v1 — users contact the Manager. Generic error on failure ("incorrect email or password") without revealing which field was wrong. On first login with a temporary password, forced redirect to `/change-password` before any other screen. `[code]`

### 8.2 Workshop Table — `/sadnaot`

Primary landing page for Manager, Tech, Feedback Documenter, and Facilitator.

**View filter — three pills, one active:** `עתידיות + פתוחות` (default) · `עברו ונסגרו` · `הכל`

**Columns as built** (right to left): `[code]`

| # | Header | Notes |
|---|---|---|
| 1 | תאריך | DD.MM.YY, sortable |
| 2 | ארגון — קבוצה | Sortable. Org name is a clickable link. Tentative `?` badge inline |
| 3 | חד׳ | Room count |
| 4 | סטטוס | Colored pill, sortable |
| 5 | ליהוק | X/Y |
| 6 | שובצו מתחקרים | X/Y |
| 7 | תרחישים | Written state |
| 8 | משוב משתתפים | ✓ / ✗ |
| 9 | מצגות | X/Y |
| 10 | מכתבים | X/Y |
| 11 | הזנת פידבק | ✓ / ✗ |

> **Resolved conflict — important.** The original spec and the design spec each specified a *different* column list, and **the built table matches neither**. Notably there is **no כותבת (author) column** and **no separate איתור צרכים column** — needs-assessment state is conveyed by the status pill itself. The list above is what exists and is authoritative.

**Badges:** `⏳ ממתין לליהוק` · `⏳ פידבק חסר` · `⚠ תאריך עבר ולא בוצע איתור צרכים` (red, under the status pill).

Cancelled workshops: strikethrough, dimmed, collapsed at the bottom, visible only under `הכל`. Sort and filter controls added in session 18. `[code]`

### 8.3 New Workshop — `/sadnaot/new`

**Manager only** — Tech cannot create workshops despite holding workshop edit rights.

Fields: organization (dropdown + inline "ארגון חדש?" link) · participant group (free text, creates the group on save) · date* · start time* · end time* · מספר חדרים משוער* · location type (מרכז / חיצוני / **זום**) · author (Facilitator-role dropdown) · tentative toggle · director-requested toggle · notes.

- **חיצוני** reveals an address field; **זום** reveals an optional meeting-link field. Switching type clears the previous value. `[code]`
- Saves with status `סדנה חדשה` and navigates to Workshop Detail.
- A live preview panel mirrors the form as it is filled. `[spec]`

### 8.4 Workshop Detail — `/sadnaot/[id]`

Two-column layout: right (~65%) content sections, left (~35%) checklist sidebar.

> **Resolved conflict:** the original spec explicitly said *"No sidebar panel for background details."* The design spec overrode this with a two-column layout. **The two-column layout is what was built.**

**Right column:**
- **תרחישים** — columns: נושא · **מודל סימולציה** · דרישות שחקנים (with per-scenario male/female counts) · נכתב · actions. Actor requirements are **required** when adding a scenario (`7b59553`). An author must be set before scenarios can be added (`b628323`).
  - **No scenario-name column or field**, on the table, the add form or the row edit form. See §3.7 — the name is unknown at specification time, so it was always empty.
  - The **מודל סימולציה** selector is editable by Manager and Tech under the existing "Scenarios — create/edit" permission, and saves on change independently of the row's edit form. Empty state is a neutral placeholder — *"מודל טרם נבחר"*, not an error. It is enforced only at שלח לליהוק (§7.2), never at the card level, and never locked.
- **חדרים ושיבוץ מתחקרים** — one card per room: room number, facilitator (or red *"לא שובצ/ה"*), `?` badge if tentative, ✓ מצגת, ✓ מכתב, soft-cancel link. PPT checkbox disabled until facilitator assigned **and** all scenarios written (lifted in CLOSING).
- **ליהוק** — casting progress and collapsible actor names.
- **משוב משתתפים** — the auto-generated Google Form string with a copy button and the confirmation checkbox.

**Left sidebar:** רשימת תיוג split into **ידני** (real checkboxes) and **אוטומטי** (status lines, no checkboxes) · הערות · פרטי רקע · a full-width **"הזנת פידבק לסדנה זו"** button.

**Editability:** all top-level fields editable by Manager before CLOSING; frozen after. Cancellation remains available at every status.

**Auto-generated Google Form string:**
`[date] - [group name] - [org שיוך פדגוגי] - [topic1, topic2, ...]`
Example: `6.5.2026 - מתנדבים באים לטוב - מנח"י - שיחה מורכבת`
The third element is the org's **שיוך פדגוגי**, not the org name. `[spec]` — corrected in v1.3 changelog.

### 8.5 Casting — `/lihukim` and `/lihukim/[id]`

See §7. The landing page lists workshops pending casting with change-alert banners and a room-cancellation warning badge.

### 8.6 Calendar — `/luach`

Open to **all roles**. Views: שבוע / שבועיים / חודש (default חודש). Prev/next navigation with a "היום" button; the anchor date persists in localStorage. `[code]`

Each block shows org — group, room count, and facilitator first names (*"לא שובץ"* in red if unassigned), with a left border in the status colour. Cancelled blocks have distinct styling. Clicking a block opens Workshop Detail. Clicking an empty day cell opens the new-workshop form with the date pre-filled. `[spec]`

> A timezone date-offset bug was fixed in `96568d9`; arrow directions were corrected for RTL in `56d0597`. `[code]`

### 8.7 Actors — `/shakhanim`, `/shakhanim/[id]`, `/shakhanim/new`

**List:** name search, gender filter, sortable columns. Gender and specialties columns are **hidden on mobile** (`48ca0ea`). The language filter was **removed** in session 18 (`ec88539`). `[code]`

**Profile:** two-initial avatar, name, contact details, languages, specialties, canDirect, last-active date. Feedback history table with a **תפקיד** column (distinguishing room feedback from director feedback) and per-aspect RAG dots, expandable to reveal free text. Development log below. CSV export button.

Feedback history and the development log render **only for Manager and Feedback Documenter** — Tech and Caster do not see these sections at all.

> **Deliberately excluded:** the design spec's left-column "סיכום היבטים" aggregate RAG bars. The per-feedback dots above are the intended level of detail — **no statistical aggregation over an actor's feedback is to be built.** See §12.

### 8.8 Feedback Entry — `/feedback`

Accessed from the Workshop Detail sidebar button, or from an actor profile. Enabled for workshops in CLOSING and CLOSED. `[code]`

Sequential dependent selection: **סדנה** → **מתחקר/ת** → **שחקן**. The room is always presented as the **facilitator's name**, never the room label — the room is an implementation detail.

Four aspect cards, in fixed order, each with a three-button RAG selector (חמור / במעקב / תקין) and a free-text area whose **border** reflects the selection:

1. **התכוננות לסדנה** — האם קרא/ה את התרחיש? שלח/ה שאלות מוקדמות? ציין/ה פרטי תלבושת חסרים מספיק זמן מראש? הגיע/ה לאימון מוכן?
2. **השחקן כסימולטור** — האם הגיב/ה באמינות? קידם/ה את המתאמן לעבר נקודות התחקיר? נצמד לרפליקות? ידע מתי לרכך ומתי לאתגר?
3. **שיקוף** — עמד/ה במסגרת הזמן? דיבר/ה מתוך הדמות בלבד? ניסח/ה חוויה רגשית? נמנע/ה מהמלצות?
4. **התנהלות מקצועית** — הגיע/ה בזמן? תלבושת מלאה? זמין/ה לאורך הסדנה? נשאר/ה עד שחרור רשמי?

> **Changed from spec:** the subtitles above are the implemented wording — shorter than the original spec's. The original also specified 5-minute and 48-hour specifics that were trimmed. `[code]`

**Director feedback** is supported: a director record carries `roomId = null` and appears in the flow alongside room-based actors. `[code]`

A feedback card counts as complete only when at least one aspect has text.

### 8.9 Organizations — `/irgunnim`, `/irgunnim/[id]`, `/irgunnim/new`

**List:** search, שיוך פדגוגי filter, שיוך תקציבי filter, sort. Org cards show name, both שיוך pills, POC + city, workshop count, last workshop date, and clickable group pills. No AI-generated notes. `[spec]`

**Detail:** breadcrumb, both שיוך pills, edit button, "+ סדנה חדשה", details row (POC / city / both שיוך), plain notes field, total rooms summary, and one expandable section per participant group listing that group's workshops.

> Workshop counts and last-workshop-date **exclude cancelled and future workshops** (`0746270`). `[code]`

**New Organization:** name*, city*, both שיוך fields* (mandatory), POC name/phone/email, notes. Reachable inline from the new-workshop form without losing entered data.

### 8.10 System Lists — `/nosim`

Titled **רשימות מערכת**. Two managed-list sections on one page, both following the same pattern: **נושאים** and **מודלי סימולציה**.

Manager edits; Tech views — Tech needs read access because both lists feed the scenario dropdowns. Add, rename inline, deactivate. **No hard delete.** Deactivated values stay on historical records but disappear from new dropdowns. Each value shows its scenario count. `[code]`

> The route stays `/nosim` — it predates the second section. `[code]`

### 8.11 Facilitator Load — `/omas`

Manager only. Four time-window pills: שבוע / 2 שבועות / 3 שבועות / 4 שבועות.

Columns: מתחקר/ת | **תחקור** | **כתיבת תרחישים** | סה"כ | expand toggle. `[code]` — column names were renamed in `7b4ae2c`.

**No colour coding** — plain black numbers only. The original spec's Green/Yellow/Red thresholds were explicitly removed. Sorted by total descending; only active facilitators shown. Expanding a row lists that facilitator's workshops in the period, each clickable.

### 8.12 Goals — `/yaadot`

Manager only. Tracks annual **room** allocation against actual usage, by שיוך תקציבי.

Year selector starts at **2026–2028**, with a `+` button that adds the next year behind a confirmation (`87d2724`). `[code]`

Four fixed rows (one per שיוך תקציבי) plus a totals row. Columns: שיוך תקציבי | פירוט | הקצאה שנתית | נוצלו | עתידי | סה"כ | נותרו.

- **נוצלו** — rooms from workshops with past dates, for orgs in this category, in the selected year.
- **עתידי** — rooms dated today or later.
- **נותרו** — הקצאה שנתית − סה"כ. Red when negative, rendered `-9` not `9-`.
- Counts are of **rooms**, not workshops.
- Editing הקצאה שנתית requires an explicit confirmation flow; a pen icon on the column header is always visible (`79d8677`, `c2580d3`). All years default to 0.

> **Resolved conflict:** the original spec said to display `—` when allocation is 0. The design spec said display `0` and show the real negative number. **The design spec's version is correct.**

### 8.13 Users — `/users`

Manager only. Table of all users: name, email, roles, active status. New-user form with name, email, roles (multi-select), temporary password. Row click to edit, deactivate, or reset password. Deactivated users shown dimmed at the bottom, excluded from assignment dropdowns, but retained on historical records. `[spec]`

### 8.14 Settings — `/settings`

Manager only. Google Drive connection, backup status display, and manual backup. See §9.

---

## 9. Backup System

> Sources: Claude.ai conversation #2 (the spec) and `src/lib/backup.ts` + `vercel.json` (the implementation). **These diverge in several places** — divergences are flagged.

### 9.1 Authentication — OAuth 2.0

> ⚠ **Changed from spec.** The conversation specified a **Google service account** with a JSON key stored as `GOOGLE_SERVICE_ACCOUNT_KEY`. The implementation replaced this with **OAuth 2.0** (`6158df0`), using `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`, with tokens stored in the `AppSettings` singleton. **All service-account instructions in the earlier spec are obsolete.** `[code]`

The Manager connects Google Drive from the Settings page via an OAuth consent flow (`/api/drive/connect` → `/api/drive/callback`).

> ⚠ **The Google Cloud OAuth app must stay in `In production` publishing status, never `Testing`.** Google expires refresh tokens after **7 days** for apps in Testing, which kills every backup path at once — manual, opportunistic and cron all share one token refresh. This broke backups in production until August 2026 and produced no visible diagnosis, because `getDriveConnectionStatus()` reports "connected" whenever tokens exist in `AppSettings` — it never validates them. Publishing requires no verification review: the only scope requested is `drive.file`, which is neither sensitive nor restricted. `[code]`

### 9.2 Storage

Root folder **`SimCRM Files`** — created automatically on first backup, its ID saved to `AppSettings.driveFolderId`. Subfolders `daily/` and `manual/` are auto-created.

> ⚠ **Changed from spec:** the specified folder name was `SimCRM Backups/`. The implementation uses `SimCRM Files`. `[code]`

### 9.3 Format

PostgreSQL SQL dump. Tables are dumped in FK-safe order, wrapped in `SET session_replication_role = replica` so foreign-key checks are disabled during restore, and written as `INSERT ... ON CONFLICT DO NOTHING`.

Table order: Person, PersonRole, Organization, ParticipantGroup, Workshop, Room, Topic, SimulationModel, Scenario, Actor, Casting, ActorWorkshopAvailability, WorkshopConfirmedActor, CastingChangeLog, Feedback, ActorDevelopmentLog, AnnualGoal, AppSettings, BackupLog. `[code]`

> Any new table must be added to `TABLE_ORDER` in `src/lib/backup.ts` **before** the tables that reference it, or it is silently omitted from every backup.

### 9.4 Nightly automatic backup

Vercel Cron, `"schedule": "0 1 * * *"` — **01:00 UTC**. `[code]`

> ⚠ **Changed from spec:** the conversation specified 03:00 Israel time; the original spec §9 said 02:00. The implementation runs at 01:00 UTC (03:00 Israel in summer / 02:00 in winter — it does not track DST). `[gap]` — confirm whether this matters.

The cron route authenticates via `Bearer ${CRON_SECRET}`, refuses to run if env vars are missing, and **writes a `RUNNING` log entry before starting** so that timeouts remain visible in the UI (`461f75f`). On success the entry is updated to `SUCCESS` with the file size; on failure to `FAILED` with the error message. `maxDuration = 300` (Vercel Pro limit).

### 9.5 Manual backup

Settings page, Manager only, button **"צור גיבוי עכשיו"**. Writes to `manual/`. Inline spinner → success or failure message.

### 9.6 Opportunistic backup

If the last successful backup is more than **3 days** old, a backup is triggered automatically when a Manager loads a page (`29ec9f9`). `[code]` — this is **not** in any prior spec; it was added as a safety net against silent cron failure.

Triggered via `after()` from `next/server` in `src/app/(app)/layout.tsx`, which keeps the serverless invocation alive until the work finishes. It was previously a bare `void maybeAutoBackup()`, which Vercel killed the moment the page finished rendering — every attempt died mid-dump, leaving a `RUNNING` row that was never resolved. **Never fire background work from a layout or route without `after()`.**

Guards, all added after that failure:
- A `RUNNING` entry younger than 10 minutes means one is genuinely in flight — skip.
- A `RUNNING` entry older than 10 minutes is dead — mark it `FAILED` and continue.
- After a `FAILED` attempt, wait 1 hour before retrying. Without this the trigger fired on **every page load**, because the interval check only consulted the last *successful* backup.

### 9.7 Startup environment check

If `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` is missing, a persistent non-dismissible amber banner shows for the Manager on every page:

> ⚠ משתני הסביבה לגיבוי חסרים — הגיבוי האוטומטי אינו פעיל. יש להגדיר `GOOGLE_CLIENT_ID` ו-`GOOGLE_CLIENT_SECRET` ב-Vercel.

No backup attempts are made while env vars are missing — silent failure is explicitly not acceptable. `[code]`

### 9.8 Settings page display

Last successful backup (date, time, size) · last status · total backups stored — **counting only `SUCCESS` entries** (`2ce4867`). `[code]`

`RUNNING` renders distinctly (amber, ⏳, *"לא הסתיים"*) rather than as a bare ✗. The stored `errorMsg` is shown whenever one exists — it was previously gated on status being `FAILED`, so a stuck `RUNNING` entry displayed a failure with no explanation. Manual backup surfaces the server's actual error text instead of *"נסה שוב"*. An undiagnosable failure message costs more than it saves.

### 9.9 Retention — managed manually

**There is no automatic retention or deletion.** Backups accumulate in Drive indefinitely until a human removes them. This is a deliberate decision.

Earlier documents (original spec §9, and the backup conversation) called for keeping the last 30 daily backups with automatic deletion of older ones. **That policy is withdrawn** — it was never implemented, and automatic deletion of backups is not wanted.

The Manager deletes old backups directly from Google Drive as needed, from both `daily/` and `manual/`.

> Operational note: at roughly one dump per day plus occasional manual backups, this needs attention perhaps once or twice a year. Worth a periodic glance at the folder size rather than a calendar reminder.

### 9.10 Restore

No in-app restore UI. Manual developer operation: download the `.sql` from Drive, apply migrations to a fresh PostgreSQL instance, run the file, repoint `DATABASE_URL`. Should be documented in the project README. `[spec]`

---

## 10. Reporting

The system answers the following without a custom report builder. `[spec]`

| # | Question | Answered by |
|---|---|---|
| 1 | Which groups haven't visited in X months? | Org list — sort by last workshop date |
| 2 | What topic did a group last work on? | Org detail — expand group history |
| 3 | How many times have we worked on Topic X? | Topic Management — workshop count per topic |
| 4 | How many rooms/workshops in a period? | Workshop table — date filter; Goals dashboard |
| 5 | How many times did Facilitator X work in period Y? | Facilitator Load Dashboard |
| 6 | Which actor hasn't worked in X months? | Actor list — sort by last active |
| 7 | Which actor got negative feedback on Aspect X? | Actor profile feedback history |
| 8 | How does actor feedback differ by group type? | Feedback CSV export + external analysis |
| 9 | How many group types visit us? | Org list — filter by both שיוך dimensions |
| 10 | Which workshops are missing feedback? | Workshop table — `⏳ פידבק חסר` badge |
| 11 | Which workshops are missing letters? | Workshop table — מכתבים column |
| 12 | Is Facilitator X overloaded? | Facilitator Load Dashboard |

### 10.1 Exports `[code]`

- **Single actor feedback** → CSV, from Actor Profile (`/api/shakhanim/[id]/export`)
- **All actors feedback** → CSV, from Actor List (`/api/shakhanim/export`)

Columns: date, workshop, facilitator, and all four aspect colour + text pairs. Colours export as text values.

> `[gap]` The design spec called for CSV/Excel export buttons on the **Workshop Table** and the **Organizations list**. Neither exists.

---

## 11. Notifications

Phase 1 notifications are **in-system visual flags only** — badges, banners, highlighted rows. No email or WhatsApp integration. `[spec]`

| Trigger | Who sees it | How |
|---|---|---|
| Workshop sent to casting | Caster | Pending count + change banner on ליהוק |
| Scenario/room/counts changed after send | Caster | Change-log banner (amber / red) |
| Workshop postponed after casting | Manager, Tech, Caster | Amber banner + `DATE_CHANGED` log |
| Date passed, still סדנה חדשה | Manager, Tech | Red badge in workshop table |
| Date passed, casting incomplete | Manager, Tech | `⏳ ממתין לליהוק` |
| Date passed, feedback missing | Feedback Doc, Manager | `⏳ פידבק חסר` |
| Backup env vars missing | Manager | Persistent amber banner |

---

## 12. Out of Scope (v1)

Explicitly excluded: `[spec]`

- Actor or facilitator self-service portal / login
- WhatsApp or email integration, automated external notifications
- Payment or billing tracking — *revisited for v2, see F-05*
- Props and costume management
- Standalone actor availability calendar (availability is a per-workshop scratch note only)
- Participant-facing group feedback forms
- Facilitator commitments outside the simulation center
- Tracking which room an actor moves between mid-workshop
- Scenario library / reuse across workshops (all scenarios are one-time)
- Document storage for scenario files (written = checkbox only)
- In-app backup restore
- **Aggregate / statistical RAG summary on the actor profile** — the "סיכום היבטים" distribution bars from the design spec. Per-feedback RAG dots in the history table are the intended level of detail. This is excluded by decision, not deferred.

---

## 13. Known Gaps & Open Questions

Carried forward for V2 planning. Each needs a decision.

| # | Item | Type | Detail |
|---|---|---|---|
| 1 | **חד׳ column counts cancelled rooms** | `[gap]` | The workshop table renders the stored `numRooms` estimate; `decisions.md` §10 specified the **active** room count. Cancelling a room does not decrement `numRooms`. **Display-only — verified not to affect statistics:** the Goals dashboard counts active `Room` records (`rooms: { where: { cancelled: false } }`), not `numRooms`, so allocation tracking is correct. Low priority. |
| 2 | Workshop Table CSV export | `[gap]` | Specified in design spec §23 and `decisions.md` §12, not built. |
| 3 | Organizations CSV export | `[gap]` | Specified in design spec §23 and `decisions.md` §12, not built. |
| 4 | Scenario-level author | `[gap]` | Original spec had `Scenario.author_id`; only Workshop-level author exists. |
| 5 | Cron timezone | `[gap]` | Runs 01:00 UTC; does not track Israel DST. Confirm acceptable. |
| 6 | Supabase pooler blocks DDL | `[code]` | Enum migrations need manual SQL + manual `_prisma_migrations` entry. Document in README. |
| 7 | Mobile spec | `[gap]` | Casting is mobile-responsive and the actor table hides columns on mobile, but no comprehensive mobile spec exists. |

Two items previously listed here are now **resolved**:

- **Backup retention** — see §9.9. Managed manually by design; the 30-day auto-delete policy is withdrawn.
- **Aggregate RAG summary on the actor profile** — **not wanted.** Moved to §12 (out of scope). The per-feedback RAG dots that already exist are sufficient; no statistical aggregation over feedback is to be built.

---

---

## 14. V2 Roadmap — Planned Features

> **This section is deliberately separate from §13.** The two are different in kind:
>
> - **§13 Known Gaps** — things specified in the past, never built, and **not expected to be built.** Recorded so they stop resurfacing as surprises.
> - **§14 V2 Roadmap (this section)** — concrete, intended future work.
>
> These are directional, not implementation-ready. Each will need a proper spec pass before development. Consolidated here from the standalone *Future Features* notes, which this section replaces.

### 14.0 Cross-cutting: the Admin role

Several V2 features (F-02, F-07) assume a new **Admin** role sitting **above** Manager — everything Manager can do, plus exclusive access to the audit log and backup management.

> ⚠ **This does not exist today.** The current system has exactly five roles (§1.1), with Manager as the highest. Introducing Admin means a schema enum change, a permissions-matrix revision, and a decision on who holds it. **Treat this as its own work item, a prerequisite for F-02 and F-07.**

---

### F-01 · Actor Training Log (הכשרות שחקנים)

A record of training sessions the SimCenter runs for its actor pool. Each session is a standalone event.

**Data per session:** date · topic/title (free text, ad hoc — no predefined list) · attendees (actors from the pool) · optional notes.

**Where it appears:**

1. **Dedicated הכשרות page** — log of all sessions, newest first. Each shows date, topic, attendee count. Expandable to the full attendee list; actor names link to their profile. "+ הכשרה חדשה" button.
2. **Actor profile** — a section listing sessions that actor attended (date + topic). Read-only here; editing happens on the הכשרות page.

**Permissions:**

| Action | Manager | Feedback Doc | Caster |
|---|---|---|---|
| View הכשרות page | ✓ | ✓ | — |
| Create / edit session | ✓ | ✓ | — |
| View section on actor profile | ✓ | ✓ | ✓ (read-only) |

**Deferred:** whether to record who *ran* the session (facilitator or external trainer). Navigation placement — under actors, or standalone.

---

### F-02 · Audit Log (יומן פעילות)

**Access:** Admin only (see §14.0).

**Logged automatically, two categories:**

- **Auth events** — login, logout, failed login attempt.
- **Action events** — any create / edit / delete / cancel by any user, in plain Hebrew referencing the entity by name. Examples: `ערך שחקן — דני לוי` · `ביטל סדנה — בית ספר עמק, מורים, 12.5.26` · `יצר ארגון — עיריית תל אביב`.

Navigation and page views are **not** logged.

**Entry format:** `[timestamp] | [user full name] | [action text]` — plain-text feel, no heavy UI.

**Display:** reverse-chronological feed, filterable by user and date range. Not visible in nav to any other role.

---

### F-03 · Scenario Library (ספריית תרחישים)

A searchable archive of written scenarios — reference and download only. No "attach to workshop" action.

**Upload flow:** from the Workshop Detail page, per scenario card. Tech clicks **"העלה לספרייה"**, attaches the Word file, confirms. All metadata (org, group, date, author, topic) auto-populates from the existing records — nothing to fill in manually. Scenarios upload independently, one per card.

**Search & browse:** standalone library page, filterable by ארגון · קבוצה · נושא · מחבר/ת. Each result shows org, group, topic, author, date, and a download button.

Full-text search inside document content is **out of scope**.

**Permissions:**

| Action | Admin | Manager | Tech | Facilitator | Caster | Feedback Doc |
|---|---|---|---|---|---|---|
| View & search library | ✓ | ✓ | ✓ | ✓ | — | — |
| Upload to library | ✓ | ✓ | ✓ | — | — | — |

The library filters on **מודל סימולציה**, but does not own that field — it is a separate feature in its own right, and it **has already shipped**. See §3.7 and §8.10.

**Deferred:** whether uploaded scenarios can be removed from the library, and by whom.

---

### F-04 · WhatsApp Message Generator

After scenarios are written, the system generates a ready-to-copy WhatsApp message summarising actor assignments. Tech copies it manually and posts it to the shared actors group (all actors are in one group). **No WhatsApp integration** — manual send.

**Content:** one message per workshop. Workshop context (org, group, date, auto-populated) plus per-scenario assignments with rooms — e.g. `בילי ורחל — תרחיש 1, חדר 1 | ג'ו וג'יל — תרחיש 1, חדר 2`.

**UX:** a **"העתק הודעת וואטסאפ"** button on the workshop detail page once the message is ready; clicking copies formatted text to clipboard.

**Deferred:** exact message format and logistics fields (call time, location). Trigger point — one scenario written, or all. What happens if casting changes after the message was already sent.

---

### F-05 · Actor Activity & Payments Dashboard

**Access:** Manager only.

Combines actor work activity with payment-order tracking, built on data already in the system.

1. **Workshop activity summary** — workshops that took place, each showing which actors played. Auto-populated from casting records.
2. **Per-actor activity** — how many workshops each actor worked in a given month. Filterable by month. Auto-calculated.
3. **Payment order tracking** — a manual ✓ per actor indicating they sent their payment order. Orders arrive via WhatsApp; Manager or Tech marks it. No actor-facing interaction is planned.
4. **Payment reminder** *(possibly)* — a passive flag for actors who worked but haven't sent an order. Not an automated message.

**Deferred:** whether the ✓ is per workshop or per month. Whether Tech can mark it or Manager only. Whether the reminder is a passive dashboard flag or an active notification.

> ⚠ **Supersedes an out-of-scope entry.** §12 lists "Payment or billing tracking" as excluded from v1. That exclusion stands **for v1**; F-05 is the v2 plan that revisits it.

---

### F-06 · Facilitator PPT Generation

> **Note:** this feature was unlabelled in the source notes — it appeared without a heading, nested inside the backup section. Assigned F-06 here, which was otherwise unused.

The CRM generates a presentation for each facilitator assigned to a workshop, merging their personal base PPT with workshop-specific content (group name, date, schedule, scenario details).

**The generation logic is built separately** — a standalone Claude Code project, handed off to be embedded. This section covers only what the CRM stores, triggers, and delivers.

**Data the CRM holds:**

- **Per facilitator** — a base PPT file: their personal template with preferred slides and phrasing. Tech uploads and maintains it; facilitators contact Tech to request changes.
- **Per workshop** — a schedule file defining that workshop's timing structure (which varies per workshop). Uploaded by Tech during setup.

**Generation:** manual trigger via a **"צור מצגות"** button on the workshop detail page. Preconditions: scenarios written, facilitators slotted, schedule file uploaded. Produces one PPT per assigned facilitator, attached to the workshop and downloadable from its detail page.

**Deferred:** whether preconditions hard-block or soft-warn. Behaviour when base PPT or schedule is missing. Whether a PPT can be regenerated after later changes.

---

### F-07 · Backup Management

> **Note:** this feature appeared **twice** in the source notes with slightly different wording. Merged here into one entry.

**Access:** Admin only (see §14.0).

A read-only view of database backups in Google Drive, giving visibility into what's accumulating so old files can be cleaned up manually.

- List of backup files currently in the Drive folder
- Per file: filename, date, size
- **No delete action in the CRM.** Deletion happens directly in Drive.

This is the natural companion to the manual-retention decision in §9.9 — it makes "managed manually" practical by showing what's there without opening Drive.

**Deferred:** whether the view links directly to the Drive folder (probably yes). Any sorting beyond date (likely unnecessary).

---

### F-08 · מודל סימולציה (Simulation Model field) — **SHIPPED**

Built as the first V2 item, on branch `sim_model`. It is now as-built behaviour and documented in place: data model §3.7 and §3.14, send-to-casting precondition §7.2, casting requirements panel §7.3, change alert §3.12 (`MODEL_CHANGED`), scenario card §8.4, managed list §8.10.

**Not built in that pass, still open:**
- No backfill of `modelId` on historical scenarios — left null, per the original deferred item.
- No surfacing in group history / org detail views yet. This was the "why it matters" case in the original note — seeing not just *what topic* a group covered but *in what format* — and remains worth building.
- Scenario Library filtering on the field depends on F-03, which does not exist.

---

### 14.1 Roadmap summary

| ID | Feature | Access | Depends on |
|---|---|---|---|
| F-01 | Actor Training Log | Manager, Feedback Doc | — |
| F-02 | Audit Log | **Admin** | Admin role (§14.0) |
| F-03 | Scenario Library | Manager, Tech, Facilitator | — |
| F-04 | WhatsApp Message Generator | Tech | — |
| F-05 | Actor Activity & Payments | Manager | — |
| F-06 | Facilitator PPT Generation | Tech | External generation project |
| F-07 | Backup Management | **Admin** | Admin role (§14.0) |
| ~~F-08~~ | ~~מודל סימולציה field~~ | — | **Shipped** — remaining scope is group-history surfacing |

---

## Appendix A — Pre-Launch Checklist

Retained from Claude.ai conversation #1. Completed for the August 2026 rollout; kept for reference and for any future environment setup. `[spec]`

1. **Database reset** — wipe all test data, keep schema and topic lookup.
2. **Topics** — enter all real topics as Manager.
3. **Users** — one account per team member, correct roles, temporary passwords communicated out-of-band (WhatsApp), each user logs in once before launch.
4. **Actors** — enter all active actors (name, gender, specialty, languages, canDirect). Do this with the Caster. `פעילות אחרונה` populates naturally.
5. **Organizations** — enter active orgs with both שיוך fields, city, POC.
6. **Verify environment** — nightly backup ran at least once; all roles can log in on the live URL from their own devices; mobile works for the Caster; Google Form string generates correctly.
7. **Smoke test on clean DB** — run one real upcoming workshop end to end as a team.

### Rollout guidance

- Start in slow months.
- Be physically present for the first 2–3 weeks.
- Roll out **by role**: Manager + Tech first (one week) → Caster → Feedback Documenter → Facilitator.
- **Do not migrate historical data.** Start fresh from today.
- Keep the old sheets running in parallel for the first month, then retire them.
- Identify one champion per role.
- One-page cheat sheet per role — the 3–4 most frequent actions only.
- Expect the first real workshop to surface 2–3 issues. That is normal.

---

## Appendix B — Build Session History

Sessions 1–19 as built. Branch naming `session-N-*`, merged to `develop` then `main`. `[code]`

| Session | Scope |
|---|---|
| 1 | Database schema + authentication |
| 2 | User management + roles + role-based navigation |
| 3 | Organizations + participant groups |
| 4 | Topic lookup table |
| 5 | Actor list + actor profile shell |
| 6 | New workshop form |
| 7 | Workshop table |
| 8 | Workshop detail + specification + שלח לליהוק |
| 9 | Status flow + checklists (system-triggered READY/CLOSING/CLOSED) |
| 10 | Calendar view |
| 11 | Casting interface (later redesigned to Step 1 / Step 2) |
| 12 | Feedback entry + actor feedback history |
| 13 | Feedback CSV export |
| 14 | Facilitator load dashboard |
| 15 | Organization detail + group history |
| 16 | Goals dashboard (יעדי סדנאות) |
| 17a | **Migration SQLite → PostgreSQL (Supabase)** |
| 17b | Backup system (Google Drive + Vercel Cron) |
| 18 | Permissions hardening, sort/filter controls, nav ordering |
| 19 | Status transition fixes, casting display fixes, stale-cache fixes |
| post | Rollout, DB reset, ZOOM location, TECH permissions, cancel-when-closed |

---

## Appendix C — Changelog

| Date | Version | Change |
|---|---|---|
| April 2026 | 1.0 | Initial specification |
| April 2026 | 1.1 | New workshop flow: group created inline; org dropdown, group free text |
| April 2026 | 1.2 | שיוך split into two mandatory fields; יעדי סדנאות added; date format DD.MM.YY; org name clickable everywhere |
| April 2026 | 1.3 | Workshop Table as default landing; feedback shortcut on workshop detail; casting clarified live and reversible; goals totals row; Google Form string uses שיוך פדגוגי; topic workshop counts |
| May 2026 | design 0.1 | UI/UX design spec — brand, layout, per-screen design; overrode several v1.3 decisions |
| Aug 2026 | — | Backup system specified (service account — later superseded) |
| Aug 2026 | — | **Backups fixed — they had never succeeded since the rollout reset.** Three causes: the Google OAuth app sat in `Testing`, expiring refresh tokens every 7 days (§9.1); the opportunistic trigger used a bare `void` call that Vercel killed mid-dump (§9.6); the Settings page hid the error text unless status was exactly `FAILED` (§9.8). Also added: retry guards on the opportunistic trigger, and the dump now skips tables absent from the database instead of aborting (§9.3). |
| Aug 2026 | — | **Separate test environment + release procedure recorded** (§2.1.1, §2.1.2). Preview deployments previously shared the production database; Supabase project `sim_crm_testing` now backs all previews. Documents that migrations are never automatic, the migrate-then-deploy order for additive changes, and how to rebuild the test database. `DIRECT_URL` added to §2.2 — it was in use but undocumented. |
| Aug 2026 | — | Post-review UI corrections to F-08: דרישות הסדנה expanded by default (§7.3); model rendered as plain text beside the topic rather than a coloured pill; workshop header casting line reads `שחקנים: N  שחקניות: N` instead of `ליהוק: N גברים`; scenario **name** removed from the table, add form and edit form, kept in the schema for F-03 (§3.7). |
| Aug 2026 | — | **F-08 מודל סימולציה shipped** (branch `sim_model`). New `SimulationModel` managed list; nullable `Scenario.modelId`; hard precondition at שלח לליהוק; `MODEL_CHANGED` change alert; scenario-card selector; נושאים page becomes **רשימות מערכת** with a second section. No historical backfill; group-history surfacing deferred. |
| **Aug 2026** | **2.0** | **Consolidation.** All sources merged and reconciled against source code. Documents as-built reality: PostgreSQL/Supabase + Vercel + Next.js 16; two-stage casting flow; three-condition READY with regressions; ZOOM location type; OAuth backup; revised permissions; RAG relabel to תקין/במעקב/חמור. Backup retention policy withdrawn — manual by design (§9.9). Unbuilt gaps catalogued in §13; V2 roadmap absorbed as §14. |

---

*End of Specification — Version 2.0*
