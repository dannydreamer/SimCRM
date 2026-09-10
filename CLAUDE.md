# SimCRM — Simulation Center CRM

Internal Hebrew-language CRM for the כיתקטיקה simulation center. ~6 staff users, not public-facing.
**Live in production.** Treat `main` as production — it auto-deploys to Vercel.

## The spec

`docs/SPEC.md` is the **authoritative specification**. Read it before any non-trivial work.

- Sections 1–13 describe the system as built. Section 13 lists known gaps (specified, never built).
- **Section 14 is the V2 roadmap** — features F-01 … F-08. If asked to build a new feature, start there.
- Section 0.4 explains the `[code]` / `[spec]` / `[gap]` markers used throughout.

Older documents in `docs/` (`SimCenter_CRM_Spec.docx`, `simcenter_crm_design_spec.md`, `decisions.md`) are **superseded**. They are kept for history. Where they conflict with `SPEC.md`, `SPEC.md` wins. Do not follow them.

## Spec maintenance

**Update `docs/SPEC.md` in the same commit as the code change — never as a separate follow-up.** A spec updated later is a spec that drifts.

Update it when a change:
- adds or removes a feature, field, screen, or route
- alters a business rule or user-visible behaviour
- changes permissions or role access

Do **not** update it for bug fixes that restore already-specified behaviour, refactors, styling, or dependency bumps.

When a fix closes an item in the spec's "Known Gaps" table (section 13), delete that row rather than editing it. When behaviour changes, edit the relevant section directly and add a line to the changelog at the end. Bump the version number in the header only for meaningful milestones, not routine edits — git carries the detailed history.

## Stack

Next.js 16 (App Router) · React 19 · Prisma 7 + `@prisma/adapter-pg` · PostgreSQL on Supabase · NextAuth 4 · Tailwind · deployed on Vercel Pro.

## Conventions

- **Hebrew UI, RTL, always.** Every label, button, placeholder, and error message is in Hebrew. Build RTL-first — never LTR flipped with `direction: rtl`.
- **Dates render `DD.MM.YY`** (e.g. `7.5.26`).
- **Negative numbers need `dir="ltr"` on the cell**, or they render as `9-` instead of `-9`.
- Routes use Hebrew transliteration: `sadnaot` (workshops), `lihukim` (casting), `shakhanim` (actors), `irgunnim` (organizations), `nosim` (topics), `omas` (facilitator load), `yaadot` (goals), `luach` (calendar).
- Roles: MANAGER, TECH, SENIOR_TECH, CASTER, FEEDBACK_DOCUMENTER, FACILITATOR. Nav visibility is centralised in `src/lib/roles.ts`. **Permissions must be enforced in the API route, not only in the UI.**
- **SENIOR_TECH implies TECH**, expanded once in `authorize()` via `expandRoles()`. A guard that names TECH already admits her — do **not** add SENIOR_TECH beside an existing TECH test. Only a right a plain Tech must not have names the senior role, through a capability list in `roles.ts`. Store SENIOR_TECH alone, never both. The expansion does not reach Prisma queries filtering on the role column. Spec §5.4; `npm run check:roles`.

## Things that will bite you

- **Workshop status is system-owned.** READY, CLOSING, and CLOSED are set *only* by `checkAndAdvanceStatus()` in `src/lib/workshop-status.ts`. Never set them from a route handler or the UI. That function also handles regressions (READY→SPECIFIED, CLOSED→CLOSING). Call it after any mutation that could affect status.
- **NEW never auto-advances.** A past-dated workshop still in סדנה חדשה stays there and shows a warning badge. This is deliberate — do not "fix" it.
- **The Supabase Data API is disabled on purpose, and must stay disabled.** Prisma creates tables as the `postgres` role, so every table silently inherits full `anon` privileges (read *and* write) from Supabase's default privileges, and no table has RLS. The disabled Data API is the only thing standing between the anon key and the whole database — and every new table inherits the same grants. Never re-enable it without first revoking those grants. Spec §2.3.1.
- **Supabase's transaction pooler rejects DDL** through Prisma's prepared statements. `prisma migrate deploy` will hang on enum changes. Apply the SQL directly, then insert the migration row into `_prisma_migrations` by hand. See spec §2.2.
- **Status changes must invalidate the router cache.** After a mutation that can change status, call `router.refresh()` — otherwise the workshop table shows stale data. This has caused three separate bugs.
- **Casting is two-stage.** Step 1 = confirming physical attendance (`WorkshopConfirmedActor`); Step 2 = assigning confirmed actors to scenario×room slots (`Casting`). Step 2 draws only from Step 1. Spec §7.
- **Never scripted-edit `docs/SPEC.md` while another session may be running.** The working tree is shared, so another session's *uncommitted* spec edits are already in the file, and a find-and-replace pass will commit their unfinished draft into your branch. They then revise and commit their own version — so by merge time you are carrying a **stale copy of their prose**, and the natural "it's my file, take mine" resolution ships their older text over their finished one. This nearly reached production on 9 Sep 2026.
  - Check **before** merging, not at the conflict: `git diff <merge-base> <your-branch> -- docs/SPEC.md`. Hunks about a feature you never worked on mean you picked something up.
  - To resolve, keep both sides: `git checkout --ours -- docs/SPEC.md` to take theirs, then re-apply only your own hunks from `git diff -U6 <merge-base> <your-branch> -- docs/SPEC.md`, dropping any that mention their feature's identifiers. Re-insert your own changelog row by hand — it usually shares a hunk with theirs and gets dropped with it. Then assert the union rather than eyeballing it: each branch's changelog row present exactly once, their prose intact, your sections present.
  - Better, avoid it: do the work in `git worktree add --detach <tmp> origin/develop` and never touch the shared tree.

## Commands

```bash
npm run dev            # local dev server
npx prisma studio      # inspect the database
npm run build          # verify before pushing — Vercel builds on push
npm run check:casting  # pure-function checks for casting staleness + state (§7.2.1, §7.7)
npm run check:roles    # pure-function checks for role implication + capabilities (§5.4)
```

## Git

Branch from `develop`, not `main`. Merge to `develop`, then to `main` when ready to deploy.
Do not commit or push unless asked.
