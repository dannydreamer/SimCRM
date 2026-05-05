# SimCenter CRM — Pre-Build Decisions Log

Resolved during spec review session, May 2026.
These decisions take precedence over any ambiguity in the two spec files.

---

## 1. Participant Group — always new record
When creating a new workshop, typing a group name always creates a new Participant Group entity.
Groups are not reused even if the same name exists under the same org.

**Org Detail page** shows a flat chronological list of all workshops for the org — no grouping by participant group entity. Group name appears as a field on each workshop row.

---

## 2. Facilitator role — no system login
The Facilitator role exists in the Person table only for assignment purposes (slotted to rooms, named as scenario author).
Facilitators do not log in to the system. No Facilitator-facing screens are built.

---

## 3. "Scenario written" checkbox — Tech only
Only Tech (מפעילה טכנית) can mark a scenario as written. The assigned author does not interact with this checkbox.

---

## 4. PPT checkbox unlock condition
PPT is unlocked per room when **both**:
- A facilitator is assigned to that room (שיבוץ ✓)
- **All** scenarios in the workshop are written (not just one)

Scenarios are workshop-level (shared across all rooms). PPT is room-level.

---

## 5. Room labels — auto-generated
Room labels are auto-generated as "חדר 1", "חדר 2", etc. based on creation order.
No custom naming by users.

---

## 6. Director notes — separate field
Workshop entity includes a `director_notes` field (Long text), displayed only when `director_requested = true`.
This is separate from the caster's general notes in the casting interface.

---

## 7. Casting completion — dual condition
Casting (ליהוק) is marked complete only when **both** are true:
- Every scenario × room slot in the assignment grid has an actor assigned
- Total unique actor count and total unique actress count each match the required numbers entered by Tech

These conditions are independent and both required. Example: one actor covering 2 rooms fills 2 slots but counts as 1 actor toward the total.

---

## 8. Actor availability — workshop-level record
The casting pool's "מעוניין/ת" toggle is stored as a dedicated entity: `ActorWorkshopAvailability` (actor_id × workshop_id).
This is separate from Casting records (actor × scenario × room).
Caster marks who is available at workshop level, then assigns from that pool into specific slots.

---

## 9. Google Form string — uses שיוך פדגוגי
The auto-generated feedback string uses the **שיוך פדגוגי** (9-value) field, not שיוך תקציבי.
Format (from original spec): `[date] - [group name] - [שיוך פדגוגי] - [topic1, topic2, ...]`
Example: `6.5.2026 - מתנדבים באים לטוב - מנח"י - שיחה מורכבת`

---

## 10. חד׳ column — active room count
The rooms column in the Workshop Table shows the count of **active (non-cancelled) Room records** for the workshop, not the original `num_rooms` estimate.

---

## 11. Organization — two שיוך fields, both required
Organization entity has two separate mandatory fields:
- `shiyuch_pedagogi` — Enum, 9 values: גיל הרך, בי"ס יסודי, חטיבות ותיכונים, חינוך מיוחד, שפ"ח, מובילי תחום מדריכות ומפקחים, עיריית ירושלים, מנח"י, אחר
- `shiyuch_takzivi` — Enum, 4 values: עובדי הוראה, מנח"י, עיריית ירושלים בתשלום, סדנאות חיצוניות בתשלום

Both are required at organization creation. The New Organization form must include both.

---

## 12. Exports — maximum comprehensiveness
All exports should include as many fields as possible. Users will filter/delete what they don't need.
In scope:
- Workshop Table → CSV/Excel export (all visible columns, currently filtered view)
- Organizations List → CSV/Excel export (all fields)
- Actor feedback export (single actor, from Actor Profile)
- All actors feedback export (bulk, from Actor List)

---

## 13. Tech stack
- **Framework**: Next.js (App Router)
- **Database**: SQLite + Prisma ORM
- **Styling**: Tailwind CSS, RTL-first
- **Auth**: NextAuth.js with credentials provider
- **Deployment target**: Railway / Render / Hetzner VPS

---

## 14. Session management
- Sessions expire after 8 hours of inactivity or on browser close
- "Remember me" feature: deferred to final sessions
- Passwords: minimum 8 characters, stored bcrypt-hashed
- Forced password change on first login with temporary password
- No self-service password reset in v1 — Manager sets temporary password manually

---

## 15. Backup
- Automatic daily backup at 2:00 AM — full SQLite DB file
- Uploaded to Google Drive folder (Manager has access)
- Retention: 30 days, older auto-deleted
- "Backup Now" manual button in Manager settings
- Backup log visible in Settings screen (date/time, file size per backup)
- Restore requires developer access — no UI restore feature

---

## Design spec precedence
Where the two spec files conflict, the **design spec** (`simcenter_crm_design_spec.md`) takes precedence.
All conflicts are explicitly listed in design spec Section 23.
