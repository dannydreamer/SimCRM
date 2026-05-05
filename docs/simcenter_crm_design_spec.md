# SimCenter CRM — Design Specification
**Version 0.1 | May 2026**
**For Claude Code**

---

## 0. Global Design Principles

### Brand
- Product: כיתקטיקה simulation center internal CRM
- Logo and brand assets from כיתקטיקה brand book apply
- Brand palette (use these exact values):
  - Navy: #2C4B9A (R44 G75 B154)
  - Teal: #0B8390 (R11 G131 B144)
  - Green: #31AA59 (R49 G170 B89)
  - Mint: #86C9BB (R134 G201 B187)
  - Blush: #F9CFCC (R249 G207 B204)
- **Dominant background: white (#FFFFFF)**
- No decorative brand motifs (circles, fingerprint patterns) in the UI — brand is present through color and logo only
- Feel: clean, calm, functional. No wow factor. This is a work tool.

### Language & Layout
- **100% Hebrew UI**. Every label, button, placeholder, error message, and tooltip is in Hebrew
- **RTL layout throughout** — no exceptions
- Date format: DD.MM.YY (e.g. 7.5.26)

### Typography
- Use a clean Hebrew-supporting font (e.g. Heebo or Rubik from Google Fonts)
- Body text: 14px
- Table cells: 13–14px
- Section headers: 16px semi-bold
- Page titles: 20–22px bold

### Interaction defaults
- Clicking a workshop row → navigates to Workshop Detail page
- Clicking an org name anywhere → navigates to Org Detail page
- Clicking a warning badge → navigates to Workshop Detail page, scrolled to the relevant section
- No modal-heavy flows — prefer inline editing and navigation to dedicated pages

### Status color system (used consistently across all pages)
| Status | Color | Treatment |
|---|---|---|
| סדנה חדשה | Gray | Muted pill |
| בוצע איתור צרכים | Blue (#2C4B9A) | Colored pill |
| מוכן | Green (#31AA59) | Colored pill |
| בתהליך סגירה | Amber/orange | Colored pill |
| סגור | Dark gray | Muted pill |
| בוטל | Red, strikethrough on row | Muted pill |

### RAG color system (feedback aspects)
| Value | Background color |
|---|---|
| ירוק | #D4EDDA (soft green) |
| צהוב | #FFF3CD (soft amber) |
| אדום | #F8D7DA (soft red) |

---

## 1. Global Navigation & Header

Persistent on all screens except Login.

### Header bar
- White background, subtle bottom border (#E5E7EB)
- **Right side**: application logo (כיתקטיקה) + name of system (e.g. "מערכת ניהול")
- **Left side**: logged-in user's full name + role badge (e.g. "רונית | מנהלת"), logout button
- Height: ~56px

### Navigation
- Horizontal nav below header, or left sidebar — Claude Code's choice, but must be role-filtered (users only see screens they can access)
- Active screen highlighted

### Footer
- Every screen (except Login): version number in small gray text (e.g. v1.0.0), bottom right

---

## 2. Workshop Table (Main View — סדנאות)

**Primary landing page for all roles after login.**

### Page header
- Page title: **סדנאות** (right-aligned, large)
- Subtitle: "X סדנאות בסך הכל" (count of currently filtered results)
- **"+ סדנה חדשה"** button — top left, navy background, white text. Visible to Manager only.

### Filters

**Date filter — 3 toggle pills (one active at a time):**
- עתידיות + פתוחות ← **default active**
- עברו ונסגרו
- הכל

**Facilitator filter:**
- Dropdown, right side of filter row, labeled "מתחקר/ת: הכל"
- Filters table to workshops where any room is assigned to the selected facilitator

**No other filters.** Remove individual status filters — they are not useful for daily work.

### Table

**Default sort:** upcoming workshops first (ascending date). Past workshops descending.

**Column order (right to left, RTL):**

| # | Column | Header (Hebrew) | Notes |
|---|---|---|---|
| 1 | Date | תאריך | DD.MM.YY, colored teal, sortable |
| 2 | Group name | שם הקבוצה | "Org — Group" format. Tentative workshops show **?** badge directly next to the group name (e.g. "בית ספר עמק — מורים ?"). Org name is a clickable link. |
| 3 | Rooms | חד׳ | Integer |
| 4 | Status | סטטוס | Colored pill per status system above |
| 5 | Author | כותבת | First name only of assigned scenario author (Facilitator role). If unassigned: red dash "—" |
| 6 | Facilitator assignment | שיבוץ | X/Y format. ❗ badge on **any** upcoming workshop where X < Y — no grace period, slotting is step zero. Clicking navigates to workshop detail. |
| 7 | Needs assessment done | איתור צרכים | Single ✓ (green) or ✗ (gray). This is the "בוצע איתור צרכים" declaration. |
| 8 | Casting | ליהוק | X/Y format. ❗ badge only **after איתור צרכים is marked ✓** and casting is incomplete. Before איתור צרכים: show gray — (not applicable yet, no alarm). |
| 9 | Scenario written | תרחיש | See urgency states below |
| 10 | PPT received | מצגות | X/Y format |
| 11 | Letters received | מכתבים | X/Y format |
| 12 | Feedback | פידבק | See states below |

### תרחיש column — urgency states
The scenario written cell (✓/✗) changes based on proximity to workshop date:
- **Written:** green ✓
- **Not written, >14 days out:** gray ✗ (no urgency)
- **Not written, 7–14 days out:** orange ✗ (warning — "הגיע הזמן")
- **Not written, <7 days out:** red ✗, bold (urgent — "מאחר")
- Once written → green ✓, urgency disappears regardless of date

### פידבק column — states
- Pre-workshop (date not yet passed): gray dash **—** (not applicable)
- Post-workshop, all feedback entered: green ✓
- Post-workshop, feedback missing: red ✗ (not a dash — an active problem)

### Cancelled workshops
- Shown with strikethrough on the entire row
- Visually dimmed (opacity ~50%)
- Collapsed at the bottom of the list under a disclosure toggle: "X סדנאות שבוטלו ▾"
- Only visible in "הכל" date filter, not in the default view

### Row interaction
- Clicking anywhere on a row → Workshop Detail page
- No hover tooltip needed — keep it simple

---

## 3. Design Notes for Claude Code

- Build RTL-first. Do not build LTR and flip with `direction: rtl` as an afterthought — structure the layout RTL from the start.
- The ❗ warning badges are not blocking — they are informational. Clicking them goes to the workshop detail page. Do not implement them as modal triggers.
- The כותבת column shows first name only. Derive this from the assigned Person's name field (split on space, take first token).
- The tentative **?** badge sits inline next to the group name text, not in a separate column. Style it as a small rounded gray badge.
- X/Y fractions: when X === Y, render in green. When X < Y and the workshop is upcoming, render in orange/red with the ❗. When X === 0 and Y > 0 and upcoming, that is the most urgent state.
- Do not add hover tooltips, popovers, or expandable rows to the table in v1. Navigation to the workshop detail page is the answer to "I want more information."

---

---

## 4. Workshop Detail Page

### Breadcrumb
- Top of page: סדנאות / [Org name] — [Group name]
- Org name is a clickable link to Org Detail page

### Page header
- **Title**: Org — Group name, large and bold, right-aligned
- Below title: date (with calendar icon) | room count (with icon) | location (מרכז or address)
- **Status pill**: prominent, next to or below title, using status color system
- **Top-left actions**: "עריכה" button (secondary style) | "ביטול סדנה" button (soft red, secondary style)
- If workshop is tentative: amber "?" badge next to the group name in the title

---

### Two-column layout
- **Right column (~65% width)**: main content sections
- **Left column (~35% width)**: checklist sidebar + background details

---

### Right column — sections

#### תרחישים
- Section header: **תרחישים** with author name as subtitle directly beneath: `כותב/ת התרחיש: [first name last name]` in smaller gray text. If no author assigned: red "לא שויך/ה"
- "+ הוספת תרחיש" button — right of header, secondary style (outline, not filled)
- Each scenario is a card containing:
  - Topic pill (colored by topic, or neutral gray)
  - Scenario name (if exists) — or gray italic "שם טרם נקבע"
  - דרישות לשחקן: free text, clearly labeled
  - "נכתב תרחיש" checkbox — manually checked by Tech only, when scenario is received. The author does not interact with this checkbox.
  - **Soft cancel**: small gray "בטל תרחיש" text link at card edge. When clicked: card content gets strikethrough, dimmed to ~50% opacity, "בטל תרחיש" becomes "שחזר" in the same position. No confirmation dialog. Manager only.
  - When cancelled: dismissible amber banner appears once: "יש להודיע למלהקת על ביטול התרחיש"

#### חדרים ושיבוץ מתחקרים
- Section header: **חדרים ושיבוץ מתחקרים**
- "+ הוספת חדר" button — right of header, secondary style
- Each room is a card containing:
  - Room number badge (large, left side of card)
  - מתחקר/ת: assigned facilitator name, or red "לא שובצ/ה" link (clicking opens assignment)
  - If facilitator is tentative: small amber "?" badge next to their name
  - "✓ מצגת" checkbox — manually checked by Tech
  - "✓ מכתב" checkbox — manually checked by Tech
  - **Soft cancel**: same pattern as scenario — "בטל חדר" text link. Manager only. When cancelled: strikethrough + dimmed, "שחזר" appears. Banner: "יש להודיע למתחקר/ת ולמלהקת על ביטול החדר"
  - PPT checkbox disabled (grayed, unclickable) until both שיבוץ is assigned AND scenario is written. Tooltip or inline note explains why if hovered.

#### ליהוק — שחקנים לפי תרחיש וחדר
- Section header: **ליהוק — שחקנים לפי תרחיש וחדר**
- If איתור צרכים not yet done: gray placeholder "טרם בוצע ליהוק לסדנה זו"
- If casting exists: table with columns שחקן | תרחיש | חדר | זמינות

#### מחרוזת למשוב עודכן
- Section header: **משוב עודכן**
- Shown only after איתור צרכים is marked ✓ (topics must exist to generate the string)
- Instruction text: "העתיקי את המחרוזת והדביקי אותה כאפשרות חדשה ב-Google Form של הפידבק החיצוני. לאחר ההדבקה, סמני ✓ בתיבת הסימון למטה."
- Generated string in a bordered text box with a "העתק ללוח" button
- "סימנתי ✓ — המחרוזת הוספה לטופס החיצוני" checkbox — manually checked by Tech
- This checkbox is a **blocker**: contributes to מוכן status alongside casting completion

---

### Left column — sidebar

#### רשימת תיוג
Section showing the full workflow checklist. Two visual categories:

**ידני (Tech checks these manually):**
- [ ] בוצע איתור צרכים
- [ ] נכתב תרחיש (per scenario — shown as "נכתב תרחיש 1", "נכתב תרחיש 2" if multiple)
- [ ] משוב עודכן (disabled/grayed until איתור צרכים is ✓)
- [ ] מצגות (X/3) — aggregate count
- [ ] מכתבים (X/3) — aggregate count

**אוטומטי (system-derived, no checkbox — gray italic text explaining what's pending):**
- ליהוק — shows "✓ הושלם" or "ממתין לאיתור צרכים" or "X/Y שחקנים שובצו"
- שיבוץ מתחקרים — shows "✓ הושלם" or "X/Y מתחקרים שובצו"
- מוכן — shows "✓ מוכן" or lists what's still blocking (e.g. "ממתין לליהוק + משוב עודכן")
- הוזן פידבק — shows "✓ הושלם" or "ממתין לתאריך הסדנה" or "X שחקנים ממתינים לפידבק"
- סגור — shows "✓ סגור" or "ממתין למכתבים + פידבק"

Manual items have real checkboxes. Automatic items have no checkbox — just a status line. The visual separation between the two groups should be clear (e.g. a divider and a small label "אוטומטי").

#### הערות
- Free text area, always editable

#### פרטי רקע
- כותב/ת תרחיש | הוזן ע"י | נוצר | במאי נדרש | טנטטיבי
- Read-only, small text

#### הזנת פידבק לסדנה זו
- Full-width navy button at bottom of sidebar
- Navigates to Feedback Entry form with this workshop pre-selected

---

### Postponement warning
If workshop date is changed after casting or slotting is complete:
- Amber banner at top of page (below header): "⚠ התאריך שונה — יש לאמת זמינות שחקנים ומתחקרים"
- Dismissible

---

## 5. Workshop Table — updated column list

Full column order (right to left, RTL):

| # | Column | Header (Hebrew) | Notes |
|---|---|---|---|
| 1 | Date | תאריך | DD.MM.YY, teal, sortable |
| 2 | Group name | שם הקבוצה | "Org — Group". Tentative: **?** badge next to name. Org name = clickable link. |
| 3 | Rooms | חד׳ | Integer |
| 4 | Status | סטטוס | Colored pill |
| 5 | Author | כותבת | First name only. If unassigned: red dash |
| 6 | Facilitator assignment | שיבוץ | X/Y. ❗ immediately on any upcoming workshop with incomplete slotting. |
| 7 | Needs assessment | איתור צרכים | ✓ or ✗ |
| 8 | Casting | ליהוק | X/Y. ❗ only after איתור צרכים ✓. Before that: gray — |
| 9 | Scenario written | תרחיש | Urgency states: gray ✗ / orange ✗ (14 days) / red bold ✗ (7 days) / green ✓ |
| 10 | PPT received | מצגות | X/Y |
| 11 | External feedback updated | משוב עודכן | ✓ or ✗. Only relevant after איתור צרכים. Before that: gray — |
| 12 | Letters received | מכתבים | X/Y |
| 13 | Feedback entered | פידבק | Pre-workshop: gray —. Post-workshop missing: red ✗. Complete: green ✓ |

---

---

## 6. Actor Profile — required fields addition

The Actor profile must include **מגדר** as a required field:
- Values: שחקן (male) | שחקנית (female)
- This field drives the gender split in the casting interface pool
- Must be set on actor creation — no default, field is mandatory

---

## 7. Casting Interface (לוח מלהקת)

### Access
- Accessible from the Workshop Detail page (casting section) once בוצע איתור צרכים is ✓
- Also accessible from a "פתח ליהוק" link in the main workshop table row
- Role: Caster only (and Manager)

### Pending workshops banner
- Static line at top: "X סדנאות ממתינות לליהוק"
- Below it: tabs for the **nearest 5 upcoming workshops** with pending casting, showing date + org name
- Caster navigates between them via these tabs, or returns to the main table for others

### Page header
- Workshop name (Org — Group), large
- Workshop date and start time, prominent
- **אימון שחקנים: [start time minus 1 hour]** — auto-calculated, displayed clearly, not editable
- Status indicator: "X/Y שחקנים שובצו | X/Y שחקניות שובצו"

---

### Section 1 — דרישות תרחישים (read-only)

- One card per scenario showing topic pill + actor requirements text
- Below the scenario cards, a highlighted box:
  - **סה"כ שחקנים נדרשים: [N]** (integer, entered by Tech)
  - **סה"כ שחקניות נדרשות: [N]** (integer, entered by Tech)
  - **הערות נוספות למלהקת** — Tech-authored free text (physical constraints, special requests)
- This entire section is **read-only for the Caster**

---

### Section 2 — בריכת שחקנים

Two side-by-side columns: **שחקנים** (right) | **שחקניות** (left)

Each column:
- Text filter input at top: typing filters list in real time
- Alphabetical list of all actors of that gender
- Each actor shown as a chip: name only
- Default state: all actors **לא זמין** (gray)
- Click to toggle to **מעוניין/ת** (teal, highlighted)
- Click again to revert
- Marking מעוניין/ת only makes them available in assignment dropdowns — it does not assign them

---

### Section 3 — שיבוץ לפי תרחיש וחדר

- One card per scenario
- Each card: scenario topic + requirements reminder (small, collapsed) + grid of rooms
- Each room row: room number | actor dropdown (only מעוניין/ת actors of correct gender)
- Live counter at top: "שובצו X/Y שחקנים | X/Y שחקניות" — green when complete, red if over total

**Director slot:**
- Separate card, only shown if במאי נדרש = כן
- Single dropdown, gender-neutral, filtered to can_direct = true actors

---

### Auto-save and completion
- All changes auto-save — no confirm button
- ליהוק הושלם is not a button — derived automatically when all slots filled and totals match
- Green "✓ הליהוק הושלם" indicator appears when complete
- Caster can still edit after completion — reverts to in-progress

---

### Tech side — casting requirements entry (Workshop Detail page)

- Before איתור צרכים ✓: casting section grayed out, labeled "זמין לאחר השלמת איתור צרכים"
- Once איתור צרכים ✓: highlighted input box appears at top of casting section:
  - **סה"כ שחקנים נדרשים:** [number input]
  - **סה"כ שחקניות נדרשות:** [number input]
  - **הערות למלהקת:** [free text]
- These fields are prominent — they are the Tech's handoff to the Caster
- "פתח ליהוק" button disabled until at least one integer field is filled

---

### Mobile
- Sections stack vertically: Requirements → Actor pool → Assignment
- Actor pool columns stack vertically
- Text filter essential — 40 actors is unworkable without it
- Full mobile spec to be detailed in a later session

---

## 8. Feedback Entry Form (הזנת פידבק)

### Access
- Via "הזנת פידבק לסדנה זו" button on Workshop Detail page sidebar
- Role: Facilitator (מתחקר/ת) — this is the most tech-savvy user, no special simplification needed
- Not mobile-responsive — desktop only

### Page header
- Title: **הזנת פידבק**
- Subtitle: "הערכת שחקנים לאחר סדנה · מתעד/ת פידבק בלבד"

---

### Layout — two columns

**Right column (~75%)**: feedback form for current actor
**Left column (~25%)**: actor quick-view sidebar

---

### Right column — הקשר סדנה (top section)

Three sequential dependent dropdowns:
- **סדנה** — select workshop (pre-selected if arriving from Workshop Detail page)
- **מתחקר/ת** — grayed out until סדנה is selected. Shows facilitators assigned to that workshop
- **שחקן** — grayed out until מתחקר/ת is selected. Shows actors cast in rooms assigned to that facilitator

Helper text below dropdowns: "בחר/י מתחקר/ת — השדה מציג שמות מתחקרים, לא תוונית חדרים"

---

### Right column — feedback cards

One card per feedback dimension. All cards identical in structure:

- **Section header** (right-aligned, bold)
- **Guiding question** in gray text below header
- **RAG selector**: three pill buttons in a row
  - ירוק — טוב (default selected, green)
  - צהוב — לשיפור (amber)
  - אדום — בעיה (red)
- **Card background tint**: updates to match selected RAG color (soft green / soft amber / soft red) per the RAG color system defined in Section 0
- **הערות חופשיות** text area below the buttons

Feedback dimensions (one card each, in this order):
1. **התכוננות לסדנה** — האם קרא/ה את התרחיש? שלח/ה שאלות מוקדמות? ציין/ה פרי תלבושת 48 שעות מראש? הגיע/ה לאימון מוק/ה?
2. **השחקן כסימולטור** — האם הגיב/ה באמינות? קידם/ה את הדמות? ידע/ה את המטאפל? מתי לרכך ומתי לאתגר?
3. **שיקוף** — עמד/ה במסגרת הזמן? דיבר/ה מתוך הדמות בלבד? ניסח/ה חוויה רשמית? נמנע/ה מהמלצות?
4. **התנהלות מקצועית** — הגיע/ה בזמן? תלבושת מלאה? זמין/ה לאורך הסדנה? נשאר/ה עד שחרור רשמי?

---

### Primary action button

- **When more actors are waiting**: single primary button — "שמירה ומעבר לשחקן הבא ›" (navy, full width or prominent)
- **When current actor is the last one**: button label changes to "שמירת פידבק" — on click, saves and returns to Workshop Detail page
- **ביטול** — secondary text button, bottom left, returns to Workshop Detail without saving

---

### Left column — מבט מהיר sidebar

Shown once a שחקן is selected:

- Actor name, large
- "פעיל לאחרונה: [date] · [N] סדנאות"
- **התמחויות**: list of actor's specialties
- **3 פידבקים אחרונים**: each shown as a row of RAG dots (one per dimension) + date. Gives the facilitator immediate historical context before entering new feedback.
- **Warning banner** (amber, shown when applicable): "⚠ שחקן נוסף ממתין לפידבק:" followed by a list of names. Informational only.


---

## 9. Actor Profile Page (שחקן — פרופיל)

### Access
- Via breadcrumb: שחקנים / [actor name]
- Via actor name link in casting interface or feedback form

### Page header
- **Avatar**: circle with actor's two initials (e.g. "ימ" for יוני מאיר). No photo for now — placeholder for future image upload.
- **Actor name**: large, bold, right-aligned
- Contact details: phone (with phone icon) | email (with email icon) | languages spoken
- **Role tags**: pills showing roles actor can play (e.g. במאי/ת, חזק עם מורים, קונפליקט)
- **התמחויות**: free text line below tags — longer description of specialties
- **פעיל/ה לאחרונה**: date + number of workshops
- **עריכה** button — secondary style
- **ייצוא CSV** button — exports actor's full feedback history to CSV

---

### Two-column layout

**Right column (~60%)**: היסטוריית פידבק table + יומן פיתוח
**Left column (~40%)**: סיכום היבטים

---

### Right column — היסטוריית פידבק

Table with columns (right to left):
- תאריך
- סדנה (org name, bold)
- מתחקר/ת
- התכוננות לסדנה
- שחקן כסימולטור
- שיקוף
- התנהלות מקצועית
- ▼ expand toggle (rightmost)

Each of the four feedback dimension columns shows a single RAG dot.

Expanding a row (▼) reveals the free-text notes per dimension below that row, inline.

**"הזנת פידבק לשחקן זה"** button below table — navigates to feedback form with this actor pre-selected. Facilitator still must select סדנה and מתחקר/ת manually.

---

### Right column — יומן פיתוח

Below the feedback table, a separate section.

- List of dated notes, newest first
- Each note: date (small, gray) + free text body
- **"+ הוספת רשומה ליומן"** button — visible to Manager and feedback person (מתחקר/ת) only. Not visible to Tech or Caster.
- Clicking opens a simple inline text input with a "שמור" button — no modal

---

### Left column — סיכום היבטים

One block per feedback dimension (4 total), in same order as feedback form:
1. התכוננות לסדנה
2. שחקן כסימולטור
3. שיקוף
4. התנהלות מקצועית

Each block:
- Dimension name, bold
- Horizontal progress bar: proportional green/amber/red fill based on historical RAG distribution
- Breakdown text below bar: "X ירוק · Y צהוב · Z אדום"

Bars reflect **all feedback in history**, not just recent. No date filter needed in v1.

---

## 10. Actors List Page (שחקנים)

### Access
- Main navigation item, visible to Manager and Caster

### Layout
- Page title: **שחקנים**
- Search input: text filter by name, real-time
- Gender filter toggle: הכל | שחקנים | שחקניות
- Role/topic filter: dropdown (optional, v1)
- Table or card grid of all actors — each row/card shows:
  - Two-initial avatar
  - Name
  - Gender
  - Last active date
  - RAG summary dots (average across all feedback, one dot per dimension)
  - Specialties (truncated)
- Clicking a row/card → Actor Profile page
- **"+ שחקן/ית חדש/ה"** button — Manager only

*Full spec to be completed in a later session if layout decisions are needed.*


---

## 11. Topics Management (נושאים)

- Manager only, rarely used
- Simple CRUD list of simulation topics
- Topics are assigned to scenarios on the Workshop Detail page
- No special UX requirements — standard list with add/edit/delete

---

## 12. User Management (ניהול משתמשים)

- Standard user management: create, edit, deactivate users, assign roles
- Roles: מנהלת | טכנית | מלהקת | מתחקר/ת
- No unusual requirements

---

## 13. Calendar (לוח שנה)

- Used by Manager and Tech
- Primary use: planning and checking facilitator availability
- Shows workshops plotted on a calendar view
- Full spec pending screenshot review

---

## 14. Organizations (ארגונים + פרטי ארגון)

### שיוך תקציבי — new mandatory field on every organization
Must be selected when creating a new organization. Cannot be left blank. Four options:
1. עובדי הוראה
2. מנח"י
3. עיריית ירושלים בתשלום
4. סדנאות חיצוניות בתשלום

### Org list page
- List of all organizations, searchable
- Full spec pending screenshot review

### Org detail page (פרטי ארגון)
- POC (point of contact) details
- Past and upcoming workshops list
- שיוך תקציבי displayed prominently
- Full spec pending screenshot review

---

## 15. New Workshop Form (סדנה חדשה)

- Inline form (not a separate page, not a modal wizard)
- Full spec pending review session

---

## 16. Workshop Goals (יעדי סדנאות)

### Access
- Main navigation tab, visible to Manager only

### Year selector
- Dropdown at top of page
- Default: current year
- Options: all years with data in DB + next year

### Goals table

Four data rows (one per שיוך תקציבי) plus a header row.

Columns (right to left):

| Column | Description |
|---|---|
| שיוך תקציבי | One of the four budget categories |
| פירוט | Sub-items listed as comma-separated text within the cell (not separate rows): עובדי הוראה → גפ"ן, השתלמויות, אנשי חינוך/משרד חינוך, חינוך מיוחד · מנח"י → מנח"י · עיריית ירושלים בתשלום → עיריית ירושלים בתשלום · סדנאות חיצוניות בתשלום → סדנאות חיצוניות בתשלום |
| הקצאה שנתית | Number of rooms allocated as annual goal for this category. See edit flow below. |
| נוצלו | Count of **rooms** (not workshops) with past dates, from orgs with this שיוך תקציבי, for the selected year. All past rooms counted regardless of workshop status. |
| עתידי | Count of **rooms** (not workshops) with today's date or future, from orgs with this שיוך תקציבי, for the selected year. All future rooms counted regardless of workshop status. |
| סה"כ | נוצלו + עתידי |
| נותרו | הקצאה שנתית minus סה"כ. If negative: display in red. |

### הקצאה שנתית edit flow
- Column header is clickable
- On click: system shows a confirmation prompt — "האם ברצונך לערוך את ערכי ההקצאה השנתית?"
- On confirm: all four cells in the הקצאה שנתית column become editable inputs simultaneously
- Single "אישור" button confirms all four changes at once
- Single "ביטול" cancels without saving

### Default values
- All years start with הקצאה שנתית = 0 for all four categories


---

## 17. Calendar (לוח שנה) — full spec

### Access
- Main navigation, visible to Manager and Tech

### View toggles
Three options, pill-style toggles at top right:
- **שבוע** — single week, columns = days, one row per workshop slot
- **שבועיים** — two weeks side by side, same structure
- **חודש** — monthly grid, each day cell contains workshop cards ← most important view for planning

Default view: **חודש**

Navigation: prev/next arrows + "היום" button to return to current period.

---

### Workshop cards (all views)

Each card shows:
- **Org — Group name** (bold)
- **Room count** (e.g. "3 חדרים")
- **Assigned facilitators**: first names, comma-separated. If any room unassigned: "לא שובץ" in red
- **Left border color**: matches workshop status color (see Section 0 status color system)
  - Ready (מוכן) → green
  - In progress / needs action → amber
  - New / unassigned → red or gray per urgency

Clicking a card → navigates to Workshop Detail page.

---

### Creating a workshop from the calendar
- Clicking on an **empty day cell** opens the inline new workshop form (same as סדנה חדשה, Section 15) with the date pre-filled
- Visual affordance: empty cells show a faint "+" on hover

---

### חודש view specifics
- Each day cell can contain multiple workshop cards, stacked vertically
- If more than 2 workshops on one day: show 2 cards + "X נוספות" link that expands
- Weekend days (ו׳/ש׳) visually dimmed — workshops rarely on these days but not impossible

### שבוע / שבועיים view specifics
- Columns = days of the week (not absolute dates as primary label — show day name + date)
- Rows = time slots if workshops have times, otherwise just stacked cards per day
- Facilitator names visible on cards even in compact view (truncate if needed)


---

## 18. Organizations List Page (ארגונים וקבוצות)

### Page header
- Title: **ארגונים וקבוצות**
- Subtitle: "X ארגונים, Y קבוצות"
- **"+ ארגון חדש"** button — top left, navy, Manager only

### Filters
- **חיפוש** — free text search by org or group name
- **שיוך פדגוגי** — dropdown filter, "הכל" by default
- **שיוך תקציבי** — dropdown filter, "הכל" by default. Options: עובדי הוראה | מנח"י | עיריית ירושלים בתשלום | סדנאות חיצוניות בתשלום
- **מיין** — sort dropdown: סדנה אחרונה | שם | מספר סדנאות

### Org cards
Each org is a card showing:
- **Org name** (bold, large)
- **שיוך פדגוגי** pill
- **שיוך תקציבי** pill (alongside שיוך פדגוגי)
- **איש/אשת קשר**: name · city
- **Workshop count** + **last workshop date**
- **Group pills**: clickable pills showing group names (e.g. מורים, מנהלים, רופאים)
- No AI-generated notes — remove entirely

Clicking an org card → Org Detail page
Clicking a group pill → Org Detail page scrolled to that group's section

### No expandable rows on the list
Groups are shown as pills only. Full group detail lives on the org detail page.

---

## 19. Org Detail Page (פרטי ארגון)

### Breadcrumb
ארגונים וקבוצות / [Org name]

### Page header
- **Org name**, large bold
- **שיוך פדגוגי** pill + **שיוך תקציבי** pill
- "X סדנאות · אחרונה: [date]"
- **עריכה** button — secondary style
- **"+ סדנה חדשה"** button — navy, opens new workshop form with org pre-filled

### Org details row
Four fields in a horizontal row:
- איש/אשת קשר
- עיר
- שיוך פדגוגי
- שיוך תקציבי

### הערות
- Free text area, editable by Manager
- No AI generation — plain notes field

### Total rooms summary
- A single line below the details row: "סה"כ חדרים שבוצעו: X | חדרים מתוכננים: Y"
- Derived from all workshops under this org
- Relevant for יעדי סדנאות tracking

---

### קבוצות משתתפות

One expandable section per group:

**Group header row (collapsed state):**
- Group name (bold) + group icon
- Workshop count + last workshop date
- **"+ סדנה"** button — opens new workshop form with org + group pre-filled
- ▲/▼ toggle

**Expanded state — workshop table:**
Columns: תאריך | סטטוס | מתחקר/ת | חדרים
Each row clicks through to Workshop Detail page.

**"+ קבוצה חדשה תחת ארגון זה"** button — bottom of page, secondary style, Manager only


---

## 20. Permissions Matrix

All permissions below are from the original spec (Section 4, Table 13) with additions from our design sessions.

| Entity / Action | Manager | Tech | Caster | Feedback Doc. | Facilitator |
|---|---|---|---|---|---|
| Organizations — view | ✓ | ✓ | ✓ | ✓ | — |
| Organizations — create/edit | ✓ | ✓ | — | — | — |
| Participant Groups — view | ✓ | ✓ | ✓ | ✓ | — |
| Participant Groups — create/edit | ✓ | ✓ | — | — | — |
| Workshops — view all | ✓ | ✓ | ✓ | ✓ | Own only |
| Workshops — create/edit | ✓ | ✓ | — | — | — |
| Workshops — cancel/postpone | ✓ | ✓ | — | — | — |
| Rooms — assign facilitator | ✓ | — | — | — | — |
| Rooms — mark PPT/Letter ✓ | ✓ | ✓ | — | — | — |
| Scenarios — create/edit | ✓ | ✓ | — | — | — |
| Scenarios — mark written ✓ | ✓ | ✓ | — | — | — |
| Casting — view | ✓ | ✓ | ✓ | — | — |
| Casting — assign actors/director | ✓ | — | ✓ | — | — |
| Casting — note availability | ✓ | — | ✓ | — | — |
| Actors — view profiles | ✓ | — | ✓ | ✓ | — |
| Actors — create/edit | ✓ | — | ✓ | — | — |
| **Actor profile — feedback history & יומן פיתוח — view** | ✓ | — | — | ✓ | — |
| Feedback — view | ✓ | — | — | ✓ | — |
| Feedback — enter/edit | ✓ | — | — | ✓ | — |
| Feedback — export | ✓ | — | — | ✓ | — |
| Actor Dev. Log — view | ✓ | — | — | ✓ | — |
| Actor Dev. Log — write | ✓ | — | — | ✓ | — |
| Topic List — view | ✓ | ✓ | ✓ | ✓ | ✓ |
| Topic List — edit | ✓ | — | — | — | — |
| Facilitator Load Dashboard | ✓ | — | — | — | — |
| Calendar | ✓ | ✓ | — | — | — |
| יעדי סדנאות | ✓ | — | — | — | — |
| User Management | ✓ | — | — | — | — |
| Settings & Backup | ✓ | — | — | — | — |
| Soft cancel room/scenario | ✓ | — | — | — | — |
| יומן פיתוח — write | ✓ | — | — | ✓ | — |
| הקצאה שנתית — edit | ✓ | — | — | — | — |

### Key UI rules derived from permissions
- Navigation menu shows only screens the current user's role can access
- Caster sees Actor profile but NOT feedback history section and NOT יומן פיתוח — those sections do not render for Caster role
- Tech sees Workshop Table and Workshop Detail but cannot access casting interface to make assignments
- Soft cancel buttons (room/scenario) render only for Manager role
- "+ שחקן/ית חדש/ה" button on actor list visible to Manager and Caster only
- הקצאה שנתית column header (clickable to edit) renders only for Manager


---

## 21. Facilitator Load Dashboard (עומס מתחקרים)

### Access
- Manager only
- Main navigation item

### Page header
- Title: **עומס מתחקרים**
- Subtitle: "ספירת סדנאות לפי מתחקר/ת בטווח זמן נבחר"

### Time window selector
- Four pill toggles (one active at a time): **שבוע | 2 שבועות | 3 שבועות | 4 שבועות**
- Default: שבועיים
- No month/custom view needed
- Counts update immediately when toggle changes

### Table

Columns (right to left):
| Column | Description |
|---|---|
| מתחקר/ת | Facilitator name, bold |
| תחקור | Count of rooms they are slotted to facilitate in the selected period |
| כתיבה | Count of workshops where they are assigned as author in the selected period |
| סה"כ | Sum of תחקור + כתיבה |
| ▼ | Expand toggle |

- No color coding on numbers — plain black numbers only
- Sorted by סה"כ descending by default
- Only active facilitators shown (deactivated users excluded)

### Expanded row
Clicking ▼ reveals a list of workshops assigned to that facilitator in the period:
- One row per workshop: תאריך | שם קבוצה | ארגון | תפקיד (תחקור / כתיבה) | סטטוס
- Each workshop row is a clickable link to Workshop Detail page
- Clicking ▼ again collapses

### No colored left border, no legend, no threshold indicators
Plain table. Numbers speak for themselves.


---

## 22. New Workshop Form (סדנה חדשה)

### Access
- "+ סדנה חדשה" button on Workshop Table (top left, navy, Manager only)
- Clicking an empty day cell on the Calendar (date pre-filled automatically)
- "+ סדנה" button on Org Detail page group rows (org + group pre-filled)

### Layout
- Full page (not a modal), with breadcrumb: סדנאות / סדנה חדשה
- Title: **סדנה חדשה**
- Subtitle: "שלב 1 מתוך 2 — יצירת מעטפת הסדנה. פירוט תרחישים יתבצע בדף הסדנה."
- Two columns: **right (~65%)** — form fields | **left (~35%)** — live preview

---

### Form sections (right column)

#### ארגון וקבוצת משתתפים
- **ארגון** — dropdown of all existing orgs, required
  - Once selected: show two read-only pills beneath: שיוך פדגוגי + שיוך תקציבי for confirmation
- **שם הקבוצה** — free text, required (e.g. מורים, יועצות, מנהלים)
- **"הארגון לא קיים? הוסיפי ארגון חדש"** — inline link. Clicking opens the New Organization form inline on this page without losing filled data. On save, returns to this form with the new org pre-selected.

#### תאריך ושעות
- **תאריך** — date picker, required. Pre-filled when accessed from calendar.
- **שעת התחלה** — time input (HH:MM), required
- **שעת סיום** — time input (HH:MM), required

#### חדרים ומיקום
- **מספר חדרים משוער** — toggle: 1 / 2 / 3, required. Editable later by Manager.
- **סוג מיקום** — toggle: מרכז / חיצוני. If חיצוני selected: address text field appears below.

#### מתחקר/ת כותב/ת תרחיש
- **מתחקר/ת (author)** — dropdown of active Persons with Facilitator role. Optional at creation, editable later.
- **סדנה טנטטיבית** checkbox — default unchecked
- **נדרש במאי לסדנה זו** checkbox — default unchecked

#### הערות
- Free text area, optional

---

### Live preview (left column — תצוגה מקדימה)
Updates in real time as fields are filled. Shows:
- ארגון
- קבוצה
- תאריך
- שעות
- חדרים
- מיקום
- כותב/ת (author name once selected)
- טנטטיבי (כן/לא)
- במאי (נדרש/לא נדרש)
- סטטוס: "סדנה חדשה" (always, with status dot)

---

### Footer actions
- **"יצירת סדנה"** button — primary, navy. Disabled until all required fields filled.
- **"ביטול"** — secondary text button, returns to Workshop Table
- Helper text below buttons: "שדות חובה: ארגון, קבוצה, תאריך, שעות ומספר חדרים"

### On save
- Creates workshop with status סדנה חדשה
- Navigates to Workshop Detail page
- Info banner shown once on Workshop Detail: "לאחר היצירה — המשיכי לדף הסדנה להוסיף תרחישים, חדרים ופרטים נוספים"


---

## 23. Corrections, Clarifications & Directives for Claude Code

### Priority directive
**This design spec takes precedence over the original CRM spec (SimCenter_CRM_Spec.docx) wherever they conflict. If in doubt about any design decision, ask the user before proceeding.**

### Workshop Detail — two-column layout
**This design spec's two-column layout (right: content sections, left: checklist sidebar) takes precedence over the original spec's "no sidebar" instruction. Use the two-column layout as described in Section 4 of this document.**

### Resolved contradictions

**מוכן status trigger**: מוכן is automatic when: ליהוק complete AND all rooms have PPT ✓ AND משוב עודכן ✓. The משוב עודכן checkbox IS a blocker for מוכן status.

**Workshop Table columns**: Use the column order and definitions in Section 2/5 of this design spec, not the original spec's column list. The two are significantly different.

**Facilitator Load Dashboard**: No color coding on load numbers. Plain numbers only. Remove Green/Yellow/Red thresholds entirely.

**Calendar access**: Accessible to both Manager and Tech (not Manager only as in original spec).

**New Workshop creation**: Manager only. Tech cannot create new workshops despite having create/edit permissions on workshop data. The "+ סדנה חדשה" button is not rendered for Tech role.

### Gaps filled

**Feedback entry — room display**: In the feedback entry form, the Room field must display the facilitator's name, not the room label. "Room 1" is an implementation detail only. The UI label is "מתחקר/ת" and shows the name of the facilitator assigned to that room.

**Director casting record**: Director is a workshop-level assignment, not tied to any scenario or room. In the data model: scenario_id = null, room_id = null, is_director = true. The director slot in the casting interface is a single actor picker at the workshop level, not per room or per scenario.

**Workshop transitions**: A workshop that never reached מוכן still automatically transitions to בתהליך סגירה when its date passes. Incomplete items (missing PPT, missing casting, etc.) remain as warnings on the workshop detail page but do not block the status transition.

**יעדי סדנאות — totals row**: A totals row appears at the bottom of the goals table, summing all 4 category rows for each numeric column (הקצאה שנתית, נוצלו, עתידי, סה"כ, נותרו). The נותרו total cell is shown in red if negative.

**הקצאה שנתית display**: Show 0 as "0" (not "—"). 

**נותרו display**: When הקצאה שנתית = 0, נותרו will be a negative number equal to סה"כ. Show the actual number in red. Do not show "—".

### Export additions

**Workshop Table**: Add an "ייצוא CSV/Excel" button to the Workshop Table page. Exports all currently filtered/visible workshops with all columns.

**Organizations List**: Add an "ייצוא CSV/Excel" button to the Organizations list page. Exports all currently visible organizations with all fields.

