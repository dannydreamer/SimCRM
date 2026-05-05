# SimCenter CRM — מערכת ניהול

Internal CRM for כיתקטיקה simulation center.

## Stack
- **Frontend + Backend**: Next.js (App Router)
- **Database**: SQLite + Prisma ORM
- **Styling**: Tailwind CSS (RTL-first)
- **Auth**: NextAuth.js (credentials)

## Specification
- `docs/SimCenter_CRM_Spec.md` — original full product specification (v1.3)
- `docs/simcenter_crm_design_spec.md` — UI/UX design specification (v0.1, takes precedence on conflicts)
- `docs/decisions.md` — resolved ambiguities and clarifications from pre-build review session

## Branch structure
- `main` — stable, production-ready snapshots
- `develop` — integration branch
- `session-X-*` — one branch per build session, merged into develop on completion

## Build sessions
See `docs/SimCenter_CRM_Spec.md` Section 11 for the full 19-session build plan.
