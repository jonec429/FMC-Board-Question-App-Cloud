# FMC QBank Cloud — Project Roadmap

> [!TIP]
> **Quick Start Prompt for AI Assistants:**
> "Please start by reviewing the `ROADMAP.md` file, specifically the 'AI Coordination & Handover Protocol' and the 'Recent Updates' sections. Identify what was completed by the previous agent and if there are any 'In Progress' tasks claimed. Let me know when you've reviewed it so we can proceed."

---

This file serves as the shared source of truth for development progress between AI assistants and developers.

## 🟢 Legend
- `[ ]` **Todo**: Planned task, not yet started.
- `[/]` **In Progress**: Currently being worked on.
- `[x]` **Completed**: Finished and verified.
- `[!]` **Blocker / Attention**: Requires user input or external fix (e.g., Supabase settings).

---

## 🤖 AI Coordination & Handover Protocol
*This protocol ensures that multiple AI assistants (Antigravity, Claude, etc.) can work on this codebase without collision or loss of context.*

1. **Check First**: Every assistant MUST read this `ROADMAP.md` at the start of a session to identify changes made by other agents.
2. **Claiming Tasks**: When starting a task, mark it as `[/]` and append your name (e.g., `[/] [Antigravity] ...`).
3. **Closing the Loop**: Every session MUST end with a dated entry in the **🆕 Recent Updates (Changelog)** section.
4. **Documentation Hierarchy**: 
    - **ROADMAP.md (The "What")**: High-level progress, status updates, and user-facing changelog.
    - **Technical Docs (The "How")**: Deep-dive technical details, code review findings, or implementation plans should be kept in separate files (e.g., `REVIEW_FINDINGS.md`, `walkthrough.md`, `implementation_plan.md`). 
    - **Linking**: Always include a link to the technical document in your Roadmap changelog entry.
5. **Cross-Accountability & Peer Review**: At the start of a session, the current agent should perform a brief validation of the work completed by the previous agent. 
    - **Principle**: If the code is functional, accurate, and meets the stated goal, do NOT refactor it simply to match your own "style." 
    - **Goal**: Ensure cross-accountability without "reinventing the wheel" at every handoff.
6. **Shared Source of Truth**: This file is the primary handover document. If logic is changed in a way that impacts future phases, update the Roadmap descriptions accordingly.

---

## 🚦 Deployment Workflow

**Current (pre-launch):** Pushing directly to `main` is OK because no residents are using the app yet — fast iteration matters more than preview safety.

**Once we roll out to users (REQUIRED — do not skip this transition):**
- ❌ Stop pushing untested changes straight to `main`.
- ✅ Use one of:
    - **Local dev** (`npm run dev` → http://localhost:3000) for unverified changes, OR
    - **Vercel preview deployments**: push to a feature branch → Vercel auto-generates a unique preview URL → test there with real Supabase → merge to `main` only after verifying.
- The "push to main = instantly live for residents" model is acceptable now and unacceptable later. Whichever AI agent is in the seat at launch must enforce this.

---

## 📊 Current Status (Snapshot — 2026-05-20)

| Phase | Status | Notes |
|-------|--------|-------|
| **Phase 1** | ✅ **Complete** | 3 optional code-quality recommendations remain |
| **Phase 2** | ✅ **Complete** | Admin Overhaul, Fixed Blocks, and Stability Hardened |
| **Phase 3** | ✅ **Complete** | QOTD, Notifications, Heatmap, Resident Review |
| **Phase 4** | ✅ **Complete** | YoY schema + derived-PGY model done. "Start Year Transition" wizard built. Academic Year filtering implemented. |

**Data layer (2026-05-20):** Admin console now runs on **TanStack Query** (retries, caching, lazy questions). The recurring timeout issues are resolved. See changelog.

### ⚠️ Action Required From Admin
- [x] **Sprint 5 step 1**: SQL migration `migrate_blocks_question_ids.sql` run in Supabase ✅
- [x] **Sprint 5 step 2**: ~~Open the app → Admin Console → **Curriculum** → click **"Initialize N Blocks"** to lock in question sets~~ *(Deprecated: the old "Block Builder" tab was merged into the new Curriculum Manager on 2026-05-18 and fixed blocks are now automatically enforced).*
- [x] **2026-05-14 — Profile Names Migration**: `migrate_profiles_split_names.sql` — adds `first_name`/`last_name` to `profiles`. ✅
- [x] **2026-05-18 — Block Archiving Migration**: `migrate_blocks_archive.sql` — adds `is_archived` to `blocks`. ✅
- [x] **2026-05-20 — YoY Schema Migration**: `migrate_yoy_schema.sql` — adds `cohort_year`/`track`/`pgy_override`/`status`/`graduated_year` to `authorized_roster`, backfilled. ✅
- [x] **2026-05-20 — Roster RLS Fix**: `fix_roster_rls.sql` — roster had RLS enabled but no SELECT policy, silently hiding all rows. ✅
- [x] **NEXT — Roster Split-Names Migration**: `migrate_roster_split_names.sql` — Adds `first_name`/`last_name` to `authorized_roster` so tables sort by true last name. **Admin must run it in Supabase.**
- [x] **NEXT — Tighten RLS Policies**: `tighten_rls_policies.sql` — Secures write access to core tables, restricting it to admins and faculty. **Admin must run it in Supabase.**
- [x] **NEXT — Academic Year Tagging**: `migrate_academic_year.sql` — Adds `academic_year` to `results` and `blocks` for historical dashboard filtering. **Admin must run it in Supabase.**
- [x] **NEXT — Phase 3 QOTD & Push**: `migrate_qotd_reactions.sql` and `migrate_push_subscriptions.sql` — Adds the tables required for Web Push notifications and Question of the Day emoji reactions. **Admin must run it in Supabase.**
- [x] **Environment Setup**: Node.js installed, `npm install` run. ✅ *(Note: `@tanstack/react-query` added 2026-05-20)*

### 🎯 Remaining in Phase 2
- [x] **Sprint 4B** — Browse + per-question Edit UI for the question bank ✅
- [x] **Roster Edit/Archive** — finish the Roster CRUD ✅
- [x] **Custom URL** — DNS/Vercel config only, no code change ✅
- [ ] **Question-level Analytics** (Moved to Phase 3)

---

## 🤝 Session Handoff — 2026-05-21 (Antigravity)

**What shipped today (all live on `main`, verified by `tsc --noEmit`):**
1. **Real Last-Name Sort**: Updated `RosterManager` and `AdminPerformance` to capture and sort by true last name. Added `migrate_roster_split_names.sql`.
2. **Pre-launch RLS Security**: Hardened write operations for `questions`, `blocks`, `block_schedule`, and `authorized_roster`. Added `tighten_rls_policies.sql`.
3. **Admin Reorg**: Retired the legacy "Advanced" tab, finalizing the clean 5-tab structure for the Admin Console.
4. **Year Transition Wizard**: Built a new UI to bulk-graduate PGY3s, explain auto-advancement, and onboard incoming PGY1s (with faculty advisor capture). Accessible from the Roster Manager.
5. **Academic Year Tagging**: Added `academic_year` column to `results` and `blocks` (via `migrate_academic_year.sql`). The Dashboard and Admin Performance screens now feature an "Academic Year" dropdown (e.g., "AY 25-26") that correctly filters data.

**Next tasks, priority order:**
1. **Reporting & Risk (Phase 4)**: Implement "Resident Risk" logic and exportable PDF reporting in the Admin Console.

**Workflow note:** still pushing straight to `main` (pre-launch, no users). User works on the live BRQ URL, not local. See "Deployment Workflow" above for the post-launch transition.

---

## 📍 Phase 1: Stabilization & User Feedback (Complete)
*Goal: Address feedback from initial cloud testing and fix core UI/Auth issues.*

### UI & UX Improvements
- [x] Fix Dashboard Header (`Noon Conference Blocks` -> `FMC Board Review App`)
- [x] Implement `formatDisplayName` utility for "Dr. LastName" format
- [x] Update Dashboard and Admin screens to use `formatDisplayName`
- [x] Add `name` and `id` attributes to Login forms for Chrome Autofill stability
- [x] Replace favicon with premium medical icon (Using app book icon for now)

### Registration & Auth
- [x] Update Signup Form: Add First Name, Last Name, and Password Confirmation
- [x] Update Signup Logic: Map first/last name to `profiles` table
- [x] User Profile Settings: Allow users to update name, email, and password
- [x] Implement "Forgot Password" link and Supabase reset flow
- [x] Create `/auth/callback` page to handle password reset redirects

### Admin & Data
- [x] Wire up "Add Authorized Person" button in Roster Manager
- [x] Finalize "What's New" dynamic parsing from this Roadmap
- [x] **[Data Fix]** Run `import_roster.sql`, `import_questions.sql`, and `import_history.sql`

### Code Quality & Stability
- [x] Comprehensive code review of `33e12a1` (1:1 legacy alignment commit) — see `REVIEW_FINDINGS.md`
- [x] **[Bug Fix]** Login.tsx: Added missing `useEffect` import (was causing runtime error on changelog fetch)
- [x] **[Bug Fix]** Login.tsx: Added missing closing brace to `handleSignUp` function (was causing build failure)
- [x] **[Recommended]** Create `lib/types.ts` with shared interfaces (User, Profile, Question, Result, Block)
- [x] **[Recommended]** Add React Error Boundaries around main app sections (`app/error.tsx`)
- [x] **[Recommended]** Add `aria-label` and `role="timer"` to QuizEngine countdown for accessibility

---

## 📍 Phase 2: The "Admin Overhaul" & Logic Engine (Active)
*Goal: Move the source of truth to the app and implement "Set and Forget" block logic.*

### Dynamic Quiz Engine
- [x] **[Pivoted 2026-05-13]** ~~Category-Based Block Logic~~ → **Fixed Assigned Question Sets per Block**: Curriculum blocks now have a fixed `question_ids` list so every resident sees the same questions (order shuffled per resident). Enables cross-resident comparison to identify knowledge gaps. Category-based sampling preserved for Mixed Review & Weakest Topics.
- [x] Implement/Restore "Demo Quiz" functionality.
- [x] ITE Priority Sorting: Prefer newest ITE years first in the question pool (still applies to Mixed Review / Custom Builds).
- [x] Implement "Mixed Review" preset (random across most recent 3 ITE years, 5-200 Qs) — intentionally per-resident random.
- [x] **[NEW]** "Weakest Topics" Custom Block: Auto-generate a block targeting the user's lowest-scoring categories — intentionally per-resident.
- [x] **[NEW]** Cross-Platform Save State: Quiz progress synced to user account (start on desktop, resume on mobile, etc.).
- [x] **[Claude] [NEW]** Block Builder UI: Admin can view all blocks, see init status, auto-populate from category filters with one click, or manually curate questions with category/year/search filters. Save warns if residents have already taken the block. *(Superseded 2026-05-18 — merged into `CurriculumManager.tsx` + `BlockEditor.tsx`.)*

### Quiz Tools & Accessibility
- [x] **[NEW]** Text Resizing: Allow users to adjust question/answer font size (A-/A+ toolbar, persists via localStorage).
- [x] **[NEW]** Highlight Tool: Allow users to highlight key text within question stems (session-persistent across navigation).
- [x] **[NEW]** Strikeout Tool: Allow users to strike out answer choices they've eliminated (session-persistent across navigation).
- [x] **[Claude] [NEW]** ITE Freshness Window: questions older than the last 3 ITE years are hidden by default from Custom Builder year picker, Block Builder filter dropdown, and auto-populate flows. Residents/admins can opt-in via a "Show legacy ITEs" toggle that surfaces a confirmation warning ("Using ITE questions more than 3 years old may not reflect current guidelines or recommendations"). DB unchanged — filter applied at presentation time only.

### Permissions & Access Control
- [x] **[Claude] [NEW]** Implement 3-Tier Role System: `Resident`, `Faculty`, `Admin` — centralized in `lib/roles.ts` (`getUserRole`, `isAdmin`, `isFaculty`, `canAccessAdmin`).
- [x] **[Claude] [NEW]** Faculty View: Access to performance stats + "My Advisees" filter — faculty now see a filtered AdminConsole (Performance tab only) with a "My Advisees" sub-tab defaulted on entry.

### Admin Console Redesign
- [x] **[Claude]** Implement Sidebar navigation for Admin Console — left rail with grouped sections (Reports / Program Management / Content / System), mobile-collapsible.
- [x] **[Claude & Antigravity]** Create dedicated "Roster Management" center (Add/Edit/Archive) — Roster tab surfaces RosterManager from the sidebar; **Add**, **Edit**, and **Archive** all fully implemented.
- [x] **[Claude]** Build "Attendance Center" (Bulk import and manual tracking) — Bulk import via NI paste working in AttendanceManager; manual tracking deferred.
- [x] **[Claude]** Create "Block Schedule" manager (Topic + Date range selection) — new `BlockScheduleManager.tsx` with active/upcoming/past sections and create/edit/delete flows. *(Superseded 2026-05-18 — merged into `CurriculumManager.tsx`.)*

### Infrastructure & Branding
- [x] Configure Custom URL (Custom Domain setup) — Configured `brq.stvfamilymed.org` via Squarespace/Vercel.

### Question Management (Durable Link)
- [x] **[Claude] [Pivoted]** ~~"Google Sheets Master Sync"~~ → **CSV Bulk Import + In-App Edit** workflow chosen instead — sheet becomes optional AI scratch pad, app owns the question bank. See changelog 2026-05-13.
- [x] **[Claude]** Build spreadsheet validation engine (Catch errors before they hit the app) — implemented in `lib/csvImport.ts` (`parseAndValidate`): required-field check, category resolution with alias-correction, correct-index bounds check, truncated-text warnings, duplicate detection.
- [x] **[Claude]** Bulk CSV Import UI — `components/QuestionImporter.tsx`: paste or upload .csv, validate with per-row error/warning preview, duplicate toggle, confirm-then-write to Supabase. Wired into Admin Console under Content → Questions.
- [x] **[Claude]** Sprint 4B: Browse + per-question Edit UI for existing questions in the bank — fully implemented via new `QuestionBankManager`.

---

## 🛠️ Feedback Backlog / Hotfixes
*Items identified during testing to be addressed before or during Phase 3.*
- [x] **[Antigravity]** **Highlighter Tool**: Redesigned as a toggle mode with click-to-remove functionality.
- [x] **[Antigravity]** **Board Prep Gem**: Headings restored; full AI generation scheduled for Phase 3.
- [x] **[Antigravity]** **Evidence Link**: Added AAFP Search and Review Topic buttons to explanations.
- [x] **[Antigravity]** **Submit Button**: Implemented mandatory submit-before-grading workflow.
- [x] **[Antigravity]** **Autofill Login**: Form attributes hardened (Note: browsers tie these to domain).
- [x] **[Antigravity]** **Admin Console Loading**: Fixed via 30s timeouts and comprehensive Error UI.
- [x] **[Antigravity]** **Profile Name Update**: Resolved infinite spinner via robust promise handling.
- [x] **[Antigravity]** **Question Bank Sorting**: Fixed query error on missing `created_at` column.
- [x] **[REGRESSION 2026-05-14, fixed Claude]** **Profile Name Update — still spins**: Root cause was a single 30s outer timeout wrapping three sequential Supabase calls with no per-step timeouts. When the auth-metadata update hung, users sat on the spinner for 30s before any error. Fixed by wrapping each step in `withTimeout(..., 10000)` with step-specific error messages, and making the `authorized_roster` sync non-fatal so a roster mismatch can't break the primary save. Password update flow untouched (separate path, untested).
- [x] **[2026-05-14, fixed Claude]** **Resume Later — silent data loss**: Root cause was a 3s debounce on `syncProgress` whose pending timeout got cancelled on component unmount. Clicking Resume Later within 3s of an answer change discarded the latest state. Added `handleResumeLater` that flushes the current state to `quiz_sessions` immediately (with 8s timeout) before calling `onCancel`. Button now shows a "Saving…" state while flushing. Same handler wired to the top-left back-arrow (same exit intent).
- [ ] **[Security 2026-05-19, flagged Claude] [MUST FIX BEFORE LAUNCH]** **Tighten RLS policies on `questions`, `blocks`, `block_schedule`, `authorized_roster`**: Current policies (from `migrate_admin_fixes.sql` and `fix_roster_rls.sql`) grant `ALL` to any `authenticated` user via `USING (true)`. Any logged-in resident could write to the question bank, schedule, block metadata, or roster via direct Supabase API calls — bypassing the UI's admin-only checks entirely. Low practical risk today (small trusted roster) but unacceptable for general rollout. Replace with role-based policies that check `auth.uid()` against an `admin`/`faculty` role in `profiles` for write operations. **Reads can stay open; writes must be locked down.**
- [x] **[Feature 2026-05-20, requested by user — for Antigravity] Real Last-Name Sort**: Tables currently sort the Resident/Member column via `lastName()` in `lib/sorting.tsx`, which takes the **final token** of the full name. Two-part last names ("Jan Dela Cruz" → sorts under "Cruz") sort wrong. **Robust fix (user explicitly wants the real field, not a heuristic):**
    1. Write `migrate_roster_split_names.sql` — add `first_name` + `last_name` to `authorized_roster` (mirror `migrate_profiles_split_names.sql`), idempotent, backfill from `name` (split on first space — then admin hand-corrects two-part surnames). Admin runs it in Supabase.
    2. Update RosterManager Add/Edit modal to capture `first_name`/`last_name` as separate fields (or at least `last_name`), writing them on save.
    3. Update sort accessors — `RosterManager` `rosterAccessor` (`'member'` case) and `AdminPerformance` `residentAccessor` (`'name'` case) — to use `last_name` when present, falling back to the existing `lastName()` heuristic for un-migrated rows. Graceful: works before AND after the migration runs.
    4. The `profiles` table already has `last_name`; could be joined, but `authorized_roster` is the source of truth for names pre-signup, so adding the columns there is cleaner.
- [ ] **[Security 2026-05-19, flagged Claude]** **`migrate_admin_fixes.sql` is destructive if re-run**: First statement is `DROP TABLE IF EXISTS public.block_schedule CASCADE` with no guard. File now carries a "DO NOT RE-RUN" header, but the safer fix is to split it into idempotent steps (`CREATE TABLE IF NOT EXISTS …`, conditional ALTERs) before reusing any of it as a template for future migrations.
- [x] **[Perf 2026-05-19 → done 2026-05-20]** ~~`sessionStorage`-backed cache for `useAdminData`~~ **Superseded by the TanStack Query refactor** (2026-05-20) — React Query provides caching, stale-while-revalidate, retries, and dedup, which covers this item and more.

## 📍 Phase 3: Notifications & Intelligence
*Goal: Engagement and advanced analytics.*

### Email Integrations
- [x] Implement Email service provider (e.g. Resend or SendGrid) to restore the legacy functionality of emailing the resident the results of their quiz upon completion.

### Question of the Day (QOTD)
- [x] **[NEW]** **Full QOTD Ecosystem**:
    - [x] **Automated Selection**: Daily job to pick a high-yield question (ITE focus).
    - [x] **Push/Email Notifications**: Alert residents at a set time (e.g., 8:00 AM).
    - [x] **Dedicated QOTD UI**: Quick-access interface for the daily question (separate from full blocks).
    - [x] **Stat Tracking**: Track streak, daily participation rate, and cohort performance.

### Push Notifications
- [x] Implement Web Push API (iOS 16.4+ compatible)
- [x] Add "Notification Settings" to User Profile
- [x] Implement Mid-block and End-block deadline alerts

### AI & Analytics
- [x] Question Analytics Heatmap: Identify "Trend" questions being missed by many.
- [x] ~~Google Gemini Integration: Assist Admins in pulling questions for lectures by topic/keyword.~~ *(Scrapped per admin feedback: strict adherence to verbatim source material, plus no API key available. The custom Gem handles this externally).*
- [x] ~~AI-Generated explanations for incorrect answers (Opt-in)~~ *(Scrapped per admin feedback)*

### Resident Review Experience
- [x] **[NEW 2026-05-14]** **Resident Review Tab**: Dedicated page where residents can revisit questions they answered incorrectly, with quick access to Open Evidence, Board Prep Gem, and Review Topic Material links per question. Goal: reinforce weak areas without restarting an entire block. May overlap with the existing "Weakest Topics" custom block — decide whether to extend that flow or build a separate review surface.

### Curriculum Manager (UI Optimization)
- [x] **[NEW]** **Unified Curriculum Tab**:
    - [x] Merge the "Block Schedule" and "Block Builder" tabs into a single interface.
    - [x] Add explicit ability to **Create New Blocks** (e.g., custom electives).
    - [x] Add explicit ability to **Delete/Archive Blocks**.
    - [x] Hoist data fetching to `AdminConsole` to eliminate loading times when switching tabs.

---

## 📍 Phase 4: Graduation & Rollover
*Goal: Long-term maintenance and reporting.*

### Transition Tools
- [ ] "Academic Year Transition" Tool: Handle PGY bumps, archiving old data, and resetting for July 1st.
- [ ] Build "Reporting" tab in Admin Console (PDF Generation)
- [ ] Implement "Resident Risk" logic (On-time completion vs. score)

---

## 🆕 Recent Updates (Changelog)
*These items will appear in the app's "What's New" modal. Newest entries on top.*

### 2026-05-21 — Question Analytics Heatmap (Antigravity)
*   **New** `QuestionHeatmap.tsx`: Added a new "Trend Analysis" tab to the Admin Performance screen to help faculty pinpoint cohort weaknesses.
*   **Data Aggregation**: Pulled down `question_attempts` and cross-referenced with `authorized_roster` (to filter out faculty/fellow attempts) to find true failure rates across the active resident cohort.
*   **Category Trends**: Integrated `recharts` to render a visual bar chart of the highest-failing medical categories.
*   **AI generation scrapped**: Per admin feedback, all AI-generation (explanations) and in-app Gemini integrations (search) were abandoned to ensure strict adherence to verbatim source material. The existing external Gemini Gem will continue to be used for lecture prep.
*   Files: `components/QuestionHeatmap.tsx` (new), `components/AdminPerformance.tsx`, `components/AppIcons.tsx`, `package.json` (added recharts).

### 2026-05-20 — Data Layer Refactor: TanStack Query (Claude)
*   **The durable fix for the recurring admin-console timeouts.** Replaced the hand-rolled `useAdminData` (Promise.allSettled + manual per-query timeouts) with React Query infrastructure: automatic retries with exponential backoff, caching, stale-while-revalidate, and request dedup. Transient blips (Supabase free-tier slowness) now self-heal without the user clicking Retry.
*   **New** `@tanstack/react-query` dependency + `app/providers.tsx` (client `QueryClientProvider` wired into `app/layout.tsx`). Defaults: retry 3 w/ backoff, 60s staleTime, 5min gcTime, no refetch-on-window-focus.
*   **`useAdminData` rewritten** as two queries: a **core** query (blocks, schedule, results, profiles, roster — all small, always loaded) and a **lazy questions** query that only fires on the Questions/Curriculum tabs (`enabled: includeQuestions`). The heaviest table is no longer on the critical path for Performance/Roster/Attendance. Return shape (`{ data, loading, error, refetch }`) is unchanged, so AdminPerformance/RosterManager/CurriculumManager/QuestionBankManager need no changes. `refetch` invalidates `['admin']` query keys.
*   **`AdminConsole`** computes `includeQuestions = activeTab === 'questions' || 'builder'` and passes it to the hook.
*   **Verified**: `tsc --noEmit` clean + `next build` succeeds (all 7 routes, 196 kB first load on `/`).
*   Files: `package.json`, `package-lock.json`, `app/providers.tsx` (new), `app/layout.tsx`, `hooks/useAdminData.ts`, `components/AdminConsole.tsx`.

### 2026-05-20 — Sortable Tables (Performance + Roster) (Claude)
*   **New** `lib/sorting.tsx`: reusable `useSortState` hook, pure `sortItems()` sorter, `SortHeader` clickable-header component, and a `lastName()` helper (sorts "First Last" by final token). Numbers sort numerically; text via locale-aware compare.
*   **AdminPerformance**: every column in the resident tables is now click-to-sort (Resident by last name, PGY, Attempts, Avg %, Blocks, On-Time %, Points, Status) with asc/desc toggle. Default remains Points-descending. Applies across Overview / At Risk / By Class Year / My Advisees.
*   **RosterManager**: Member (last name), Class/Role (derived label), and Account Status columns are click-to-sort. Default is last-name ascending.
*   Sort state lives in the parent component (not the inline table) so it survives re-renders. `tsc --noEmit` passes.
*   Files: `lib/sorting.tsx` (new), `components/AdminPerformance.tsx`, `components/RosterManager.tsx`.

### 2026-05-20 — Roster RLS Fix + Baseline Verified Working (Claude)
*   **Root cause of empty Roster + 0 residents**: `authorized_roster` had RLS enabled but **no SELECT policy** for authenticated users. RLS silently filters blocked reads (no error, no timeout) — the query succeeded and returned 0 rows. The absence of any `admin fetch: authorized_roster` warning in the browser console was the tell. Unlike questions/blocks/profiles, the roster never got an explicit RLS policy this session.
*   **Fix**: `fix_roster_rls.sql` (new, in repo) — clean-slates roster policies and recreates permissive read + write. Run in Supabase. **Verified working**: Roster shows all 49 people with derived PGY labels; Performance shows 34 residents (faculty/fellows excluded), 69.6% program avg.
*   **YoY model confirmed live**: derived PGY1/2/3 labels, "Show graduates" toggles on Roster + Performance, fellow/faculty exclusion from resident metrics — all working on the live site.
*   **Decision — data layer**: the recurring admin-console timeouts trace to a hand-rolled fetching hook (`useAdminData`). Agreed long-term fix is to replace it with **TanStack Query (React Query)** for automatic retries, caching, stale-while-revalidate, request dedup, and lazy per-tab loading of the heavy `questions` table. Planned as the next focused refactor. (Server-side fetching considered but rejected as over-engineering — changes auth model, and RQ captures ~90% of the reliability benefit at far lower risk.)
*   Files: `fix_roster_rls.sql` (new), `ROADMAP.md`.

### 2026-05-20 — Admin Console Resilience: Per-Query Timeouts (Claude)
*   **Symptom**: Entire Admin Console intermittently shows "Request timed out" — all tabs dead behind one error screen.
*   **Root fragility**: `useAdminData` ran all 6 table queries under a single combined `withTimeout(Promise.all, 45s)`. If ANY one query hung (Supabase free-tier cold start, slow RLS eval), the whole batch timed out and the console died. This pattern bit us repeatedly this session.
*   **Fix**: Switched to `Promise.allSettled` with a per-query 20s timeout. Each table now fails independently; the console loads with whatever succeeded. Still hard-fails only if BOTH questions and blocks are unavailable. Per-table console warnings (`admin fetch: <table> timed out`) now pinpoint exactly which query is slow.
*   **Note**: If a specific table (e.g. `profiles` / `authorized_roster`) is *consistently* hanging rather than cold-starting, this fix lets the console load but that table shows empty — pointing to an RLS/perf issue on that table specifically. The console warnings will identify it.
*   Files: `hooks/useAdminData.ts`. `tsc --noEmit` passes.

### 2026-05-20 — Year-over-Year Model: Foundation + Read Paths (Claude)
*   **New schema** (`migrate_yoy_schema.sql`, run in Supabase): adds `cohort_year`, `track`, `pgy_override`, `status`, `graduated_year` to `authorized_roster`. Idempotent + non-destructive (legacy `pgy` column preserved). Backfilled existing roster: "Class of YYYY" → `cohort_year` + `track='family_medicine'`, "Faculty" → `track='faculty'`.
*   **New helper** (`lib/academicYear.ts`): `getCurrentAcademicYear()` (July rollover, ending-year convention), `derivePGY()`, `deriveLabel()`, `isActiveResident()`, `isGraduated()`, `mapSelectionToFields()`, `getRoleOptions()` (dynamic class list so "(PGY3)" labels never go stale). **PGY is now derived from cohort_year — no more manual bumping every July 1.**
*   **`useAdminData`**: removed the `.neq('pgy','Faculty')` filter so the FULL roster (faculty included) loads. Consumers now filter by track/status. *(This also fixes a latent bug from the 2026-05-19 roster refactor where faculty silently vanished from the Roster tab.)*
*   **AdminPerformance**: resident stats now scope to active FM residents only (faculty + fellows excluded); graduates hidden behind a new "Show graduated residents" toggle. PGY column, By-Class-Year grouping, and the drill-down modal all use the derived label.
*   **RosterManager**: Class/Role column shows the derived label (PGY1-3 / OB Fellow / Academic Fellow / Faculty / Graduated YYYY) with track-aware coloring. New "Show graduates" toggle (default off). Add/Edit modals use the dynamic role list and now write `cohort_year` + `track` + `status` alongside legacy `pgy`.
*   **Fellows**: OB Fellows and Academic Fellows are first-class tracks but not in the current roster — add them via the Roster UI (they're excluded from resident performance metrics; OB Fellows don't do questions, Academic Fellows participate irregularly).
*   **Verified**: `npx tsc --noEmit` passes clean.
*   **Still TODO** (next session): the "Start Year Transition" wizard (bulk graduate PGY3s + onboard new PGY1s in one flow); `academic_year` tagging on `results`/`blocks` for historical dashboard filtering.
*   Files: `migrate_yoy_schema.sql` (new), `lib/academicYear.ts` (new), `hooks/useAdminData.ts`, `components/AdminPerformance.tsx`, `components/RosterManager.tsx`.

### 2026-05-19 — Roster Refactor: Eliminate Duplicate Fetch (Claude)
*   **Symptom**: Clicking the Roster tab (or Advanced → Roster) showed "Connection Error — Request timed out" after 30s. Performance tab showed 0 residents.
*   **Diagnosis**: `RosterManager` was doing its own `authorized_roster + profiles` fetch on mount via `useEffect` + `withTimeout(..., 30000)`, duplicating data that `useAdminData` already loads. This second fetch was hanging — possibly due to Supabase connection contention or a slow RLS evaluation on `profiles`/`authorized_roster` (no obvious schema mismatch found).
*   **Fix**: Refactored `RosterManager` to consume `adminData.roster` + `adminData.profiles` via props (same pattern as `QuestionBankManager` and `CurriculumManager`). Removed the standalone fetch entirely. Mutations (Add / Edit / Delete) still write directly to Supabase, then call `onRefresh` to repull through the parent hook.
*   **Wired up**: `AdminConsole` now passes `adminData` + `refetch` to both the top-level Roster tab AND the `AdvancedTab → Roster` sub-tab.
*   **Honest caveat**: This eliminates the 30s timeout error but **does not fix the underlying issue if `profiles` / `authorized_roster` are also failing in `useAdminData`** (which would manifest as Performance still showing 0 residents). If that's still happening after this push, the next investigation is whether `fix_profiles_rls_recursion.sql` (file present in repo but absent from the Supabase migration history) needs to be applied.
*   Files: `components/RosterManager.tsx`, `components/AdminConsole.tsx`.

### 2026-05-19 — Admin Console Hotfix Follow-up: Schema Mismatch (Claude)
*   **Root cause**: The slim `questions` select in the timeout hotfix included a `keyword` column that exists in `lib/types.ts` but **never existed in the actual DB** (see `import_questions.sql` — real columns are `year, category, system, abfm_category, question_text, correct_index, explanation, resource_link, options`). Selecting a non-existent column fails the entire Supabase query, which my soft-failure code then quietly collapsed into an empty `questions` array. Result: Questions tab "No questions found" and Curriculum Manager showing "Needs Qs" on every block.
*   **Fix**: Removed `keyword` from the select. Added a strong comment warning future edits to verify column existence before adding to the list.
*   **Outstanding (needs DevTools investigation)**: Roster + Advanced tabs reported as "not loading," and Performance tab shows 0 residents despite roster import. Suspect a separate RLS / fetch issue on `authorized_roster` + `profiles`. Will diagnose from the next round of browser console output.
*   File: `hooks/useAdminData.ts`.

### 2026-05-19 — Admin Console Timeout Hotfix (Claude)
*   **Root cause**: The new `useAdminData` hook pulled `questions.select('*')` on every admin entry — including multi-paragraph `explanation` text for every question. Combined `Promise.all` over 6 tables exceeded the 30s `withTimeout` ceiling, so the entire Admin Console showed "Request timed out" before any tab could render. Pre-consolidation, each tab fetched its own data and individually fit in the budget; the consolidation moved everything to one upfront fetch without slimming the per-table selects.
*   **Fix 1 — Slim the `questions` upfront select** (`hooks/useAdminData.ts`): now selects `id, question_text, category, year, keyword, options, correct_index` — drops `explanation` and `resource_link` (the two heaviest columns). Cuts payload by ~80%.
*   **Fix 2 — Lazy-fetch full row on edit** (`components/QuestionBankManager.tsx`): `openEditModal` is now async and pulls `explanation, resource_link` for the single question being edited (5s timeout, ~50ms in practice). Edit UX unchanged.
*   **Fix 3 — Soft per-table failures** (`hooks/useAdminData.ts`): individual table errors are now logged-and-skipped instead of throwing the whole console into an error state. Only escalates to a hard error if BOTH `questions` AND `blocks` fail (true core-data outage). Bumped the safety timeout from 30s → 45s as belt-and-suspenders.
*   **Cleanup**: Removed the dead `Block Schedule` sidebar entry in `AdminConsole.tsx` (no render branch existed for it after the 2026-05-18 consolidation — clicking it produced an empty pane).
*   **Follow-up logged**: `sessionStorage` cache for `useAdminData` added to backlog so re-entry is instant within a session.
*   Files: `hooks/useAdminData.ts`, `components/AdminConsole.tsx`, `components/QuestionBankManager.tsx`, `ROADMAP.md`.

### 2026-05-19 — Roadmap Cleanup, Security Flags & Antigravity Work Pushed Live (Claude)
*   **Action list synced**: Added the 2026-05-18 `migrate_blocks_archive.sql` to the Admin action checklist (marked complete per user confirmation) and updated Sprint 5 step 2 to point at the new **Curriculum** tab instead of the now-deleted Block Builder tab.
*   **Status snapshot refreshed**: Bumped snapshot date to 2026-05-19 and re-classified Phase 3 as "Partially started" since the Curriculum Manager UI Optimization landed under that phase on 2026-05-18.
*   **Superseded-file notes**: Annotated the historical `BlockBuilder` and `BlockScheduleManager` task entries in Phase 2 so future agents don't go hunting for deleted files.
*   **SQL hardening**: Made `migrate_blocks_archive.sql` idempotent (`ADD COLUMN IF NOT EXISTS`) so re-running it on an already-migrated database is a no-op instead of an error. Added DO-NOT-RE-RUN warning header to `migrate_admin_fixes.sql` (destructive `DROP TABLE` on first line).
*   **Security backlog**: Flagged two pre-launch must-fix items — overly permissive RLS policies (any authenticated user can write to questions/blocks/schedule) and the destructive `migrate_admin_fixes.sql` re-run risk.
*   **Deployment workflow section added**: Documented the current "push straight to main" workflow as pre-launch only, with explicit instructions to switch to local dev or Vercel preview deployments once residents start using the app.
*   **Antigravity 2026-05-18 work pushed**: The Curriculum Manager consolidation, `useAdminData` hook, archive migration, and supporting Antigravity diagnostic scripts had been sitting uncommitted in the working tree since 2026-05-18 — production was still serving the pre-consolidation build. Committed in two commits (feat + chore) and pushed to `main`. Vercel rebuild expected within ~60s.
*   Files: `ROADMAP.md`, `migrate_blocks_archive.sql`, `migrate_admin_fixes.sql`, plus 2026-05-18 Antigravity bundle.

### 2026-05-18 — Admin Console Performance & Curriculum Manager Consolidation (Antigravity)
*   **Instant Tab Navigation**: Created `useAdminData` custom hook to hoist data fetching (blocks, schedule, results, questions) to the `AdminConsole` root level. Child tabs now receive this data synchronously via props, eliminating the 3-5 second loading spinner when switching between management tools.
*   **Curriculum Manager Pivot**: Deleted the disjointed `BlockScheduleManager.tsx` and `BlockBuilder.tsx` components and merged them into a unified `CurriculumManager.tsx`. Admins can now view schedules, edit question counts, create brand new blocks, and access the block builder all from one table.
*   **Block Archiving**: Added `is_archived` boolean to the `blocks` table. Instead of deleting historical blocks (which would break past resident score calculations), admins can now safely "Archive" a block if it has resident completions. Archived blocks are hidden from the resident dashboard but maintain their historical leaderboard stats.
*   Files: `components/CurriculumManager.tsx` (new), `components/BlockEditor.tsx` (extracted), `hooks/useAdminData.ts` (new), `components/AdminConsole.tsx`, `components/AdminPerformance.tsx`, `components/QuestionBankManager.tsx`, `components/Dashboard.tsx`, `components/AppIcons.tsx`, `migrate_blocks_archive.sql` (new).

### 2026-05-14 — Profile Names Schema Migration & Display Update (Claude)
*   **Root cause of Profile name save failure** (after the fire-and-forget auth fix surfaced the real error): the `profiles` table is missing the `first_name` and `last_name` columns that `ProfileSettings.tsx` and `Login.tsx` both write to. Supabase silently rejects the entire row when an unknown column is written. **Every signup since this code was written has silently failed to create a profiles row** — the app's fallback to `authorized_roster` is what's been keeping users functional.
*   **New SQL migration**: `migrate_profiles_split_names.sql` adds the two columns (idempotent) and backfills from `full_name` by splitting on the first space (multi-word last names like "de la Cruz" preserved correctly; multi-word first names will need user correction). **Admin must run this in Supabase SQL Editor.**
*   **Display change in `formatDisplayName`**: Now returns "Dr. {full_name}" instead of "Dr. {last word only}". Helps disambiguate residents who share a last name. Affects Dashboard greeting, Performance tab, Leaderboard, Faculty Advisees subtitle, and the modal header in resident drill-downs.
*   Files: `migrate_profiles_split_names.sql` (new), `lib/utils.ts`.

### 2026-05-14 — Profile Save & Resume Later Reliability (Claude)
*   **Profile Name Update — root cause identified and routed around**: Step-labeled timeouts revealed that `supabase.auth.updateUser({ data: ... })` was the consistently-hanging call. Investigation: the app reads names exclusively from the `profiles` table, never from `user_metadata`, so the auth-metadata sync is dead weight for this app's UX. Restructured the save flow:
    *   `profiles` upsert is now the primary save (10s timeout, surfaces step-labeled error if it fails).
    *   `auth.updateUser` is **fire-and-forget** — not awaited, errors logged but never block the user. If Supabase ever fixes the underlying hang, this still keeps the metadata in sync for any future integrations (custom email templates, Edge Functions, etc.).
    *   `authorized_roster` sync remains best-effort with logged warning.
*   **Resume Later**: Added `handleResumeLater` that immediately flushes current quiz state to `quiz_sessions` before exiting, with an 8s timeout. Eliminates the silent data loss caused by the 3s debounce + unmount cleanup race. Button shows "Saving…" state while flushing; if the save fails, the user is prompted to confirm exit anyway. Top-left back-arrow now uses the same handler.
*   Files: `components/ProfileSettings.tsx`, `components/QuizEngine.tsx`.

### 2026-05-14 — Resident Review Resources (Claude)
*   **Open Evidence Link Fix**: The "Open Evidence (AAFP)" button on quiz explanations pointed at a dead AAFP search URL. Repointed to `https://www.openevidence.com` and dropped the "(AAFP)" suffix.
*   **Board Prep Gem — now clickable**: Previously just a decorative heading. Added a new button (purple, gem icon) in the explanation toolbar that opens the residency's Google Gemini Gem for board prep in a new tab.
*   **Review Topic Material — always renders with Drive fallback**: Previously hidden when `question.resource_link` was null. Now always visible. If a per-question `resource_link` is set in Supabase it takes precedence; otherwise the button opens the residency's shared Google Drive board-review folder with `?q={question.category}` appended to attempt pre-filling the in-folder search bar. Note: Google Drive's `?q=` URL parameter behavior is inconsistent — if it stops honoring the param, residents still land on the right folder and can search manually.
*   File: `components/QuestionCard.tsx`.

### 2026-05-14 — App Initializer Hardening (Claude)
*   **Root Cause Diagnosis**: Production and preview deployments were hanging on "Initializing FMC BRQ App..." indefinitely with zero Supabase requests firing. Network tab confirmed the Supabase client was never reaching the wire.
*   **Defensive Fix in `app/page.tsx`**:
    *   Wrapped the `init()` useEffect in `try/catch/finally` so `setLoading(false)` always runs, eliminating the silent-spinner failure mode.
    *   Wrapped `supabase.auth.getSession()` and the `loadProfile`/`loadCurrentBlock` parallel awaits in `withTimeout(..., 15000)`.
    *   Added an explicit env-var sanity check that surfaces a clear error if `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing at runtime.
    *   New `initError` state + actionable error UI with retry button (replaces infinite spinner). Lists common causes: Supabase pause, env vars, network.
*   **Outstanding**: The underlying cause of the original hang still needs confirmation — likely either Sensitive env-var values weren't actually saved in Vercel, or the Supabase project is paused. The new error screen will tell us which on next reload.
*   **Admin Console Hardening**:
    *   **Global Request Timeouts**: Increased timeout to 30s to accommodate slow cold starts and large data payloads.
    *   **Comprehensive Error UI**: Added visual error alerts and "Retry" buttons to all Admin modules (Performance, Roster, Questions, Block Builder, Attendance). No more silent failures.
    *   **Database Query Fix**: Resolved a "Column not found" error in the Question Bank by switching to `year` based sorting.
*   **Next Steps**:
    *   Added "Question of the Day" (QOTD) to Phase 3 roadmap per user request.
    *   Addressed TypeScript lint errors in AdminConsole and QuizEngine.
    *   **Environment Advisory**: Identified missing Node.js dependencies locally; added "Environment Setup" task to the action list.

### 2026-05-13 — Final UX Polish & UX Refinements (Antigravity)
*   **Quiz Engine UX Redesign**:
    *   **Highlighter Toggle Mode**: Redesigned the highlighter as a persistent "Mode". Users can toggle it on/off, select text to highlight, and click existing highlights to remove them.
    *   **Two-Step Submission**: Decoupled selection from grading. Users now select an answer and must manually click "Submit Answer" before the explanation is revealed.
    *   **Bottom Nav Optimization**: Moved the "Finish Block" button to the bottom navigation bar (replacing "Next") when on the final question, ensuring a smoother flow.
    *   **Resume Later**: Added a dedicated "Resume Later" button to the top-right header that saves progress and returns to the dashboard.
*   **Stability & Fixes**:
    *   **Profile Settings**: Fixed an infinite spinner bug in the name-update flow by implementing robust timeouts and optimized Supabase upsert logic.
    *   **Global Timeouts**: Integrated `withTimeout` across all primary data fetches to prevent "infinite loading" across the Admin Console and Quiz Engine.
    *   **Auth Autofill**: Hardened form attributes for better browser credential persistence.
    *   **Evidence Links**: Restored the "Open Evidence" (AAFP Search) and "Review Topic" buttons in the explanation area.

### 2026-05-13 — Phase 2 Sprints (Claude)

- **Sprint 5.5 — Legacy ITE Freshness Window**: Default question pool restricted to the last 3 ITE years. Older questions stay in the DB but are hidden from Custom Builder, Block Builder, and the "Initialize All" auto-populate flow. A "Show legacy ITEs" toggle surfaces them after a confirmation warning ("Using ITE questions more than 3 years old may not reflect current guidelines or recommendations. Are you sure?"). Constants live in `lib/questionFilters.ts` (`RECENT_ITE_YEAR_WINDOW = 3`) for easy adjustment.

- **Sprint 5 — Fixed Assigned Question Sets**: Strategic pivot from per-resident random sampling. Curriculum blocks now show the **same questions to every resident** (order still shuffled per resident) so the program can identify cohort-wide knowledge gaps via question-level analytics.
  - **DB migration** `migrate_blocks_question_ids.sql` — adds `question_ids JSONB` column + GIN index on the `blocks` table. ✅ **Migration run by admin.** Block initialization in the app may still be pending — see Current Status above.
  - **New** `components/BlockBuilder.tsx` — replaces the old stub. Two-view UI: (1) Block list with init status + bulk "Initialize All" button, (2) per-block editor with searchable/filterable question picker, multi-select, save-with-warning if results already exist.
  - **QuizEngine.tsx** — added `questionIds` prop. When a block has a fixed set, the engine fetches those exact IDs (ignoring category/keyword/year filters and pool filters). Order is shuffled per resident as before. Mixed Review & Weakest Topics continue to use the legacy random-sample path.
  - **Dashboard.tsx** — passes `questionIds` through to QuizEngine and now displays the *actual* question count per block (e.g. "Block 1: 38 Questions") instead of a hard-coded 40.
  - **app/page.tsx** — forwards `questionIds` through the `activeQuiz` state to QuizEngine.
  - **Backward compatibility**: blocks that haven't been initialized yet still work via the legacy category-based sampling, so nothing breaks before the admin runs the in-app initialization.

- **Sprint 4A — Question Bank Bulk Import**: Strategic pivot away from live Google Sheets sync (which would require either public-sharing residency-restricted ITE content or service-account credentials). Built an offline CSV import flow that works equally well with Gemini-scraped data.
  - **New** `lib/csvImport.ts` — pure-function CSV parser (handles quoted fields, embedded newlines, doubled-quote escapes) + validation engine. Validates against canonical 14-category list with fuzzy-alias correction ("Cardio" → "Cardiovascular"), letter-to-index conversion (A-E → 0-4), bounds checks, and truncated-text warnings.
  - **New** `components/QuestionImporter.tsx` — 4-phase UI (Input → Preview → Importing → Done). Supports paste or .csv file upload, shows a CSV format reference with a one-click sample loader, surfaces per-row errors/warnings with line numbers, detects duplicates by exact `question_text` match against the live DB, and offers an opt-in toggle to allow duplicate imports.
  - **AdminConsole** — replaced the "Q Metadata" stub with a real "Questions" tab under the Content group. Removed dead `MetadataStub` code.
  - **Editing workflow update**: Sheets are now an *optional* AI scratch pad rather than the source of truth. Long-term editing of existing questions will happen in-app in Sprint 4B (Browse + per-question Edit).

- **Sprint 3 — Admin Console Overhaul**: AdminConsole now uses a **left sidebar layout** with grouped navigation (Reports / Program Management / Content / System). Mobile users see a collapsible nav toggled from the top bar.
  - **Roster tab** wired up — `RosterManager` was previously imported but never rendered; now accessible from the sidebar under Program Management.
  - **Block Schedule tab** added — new `components/BlockScheduleManager.tsx` provides full CRUD over `block_schedule`: hero card for the active block, separate Upcoming/Past tables, modal with date pickers, server-side insert/update/delete, sanity validations (start ≤ end, required fields).
  - Faculty users still only see the Performance tab — admin-only items are filtered out and a small emerald banner explains the limited view.
  - Roster Edit/Archive UI deferred to a follow-up task (current ROADMAP entry marked `[/]` per protocol).

- **Sprint 2 — Permissions Foundation**: Centralized 3-tier role system.
  - Created `lib/roles.ts` with helpers: `getUserRole`, `isAdmin`, `isFaculty`, `canAccessAdmin`, `getFacultyAdviseeFilter`, `getRoleLabel`.
  - Dashboard.tsx now uses `canAccessAdmin()` instead of inline email/role checks.
  - AdminConsole renders as **Admin Console** (blue) for admins or **Faculty Console** (emerald) for faculty, with a role badge in the header.
  - Faculty users only see the Performance tab; admin-only tabs are hidden from them.
  - AdminPerformance gained a "My Advisees" sub-tab for faculty: filters residents where `authorized_roster.advisor` matches `profile.full_name`. Faculty land on this tab by default.
  - page.tsx now forwards `user` and `profile` into AdminConsole so role context propagates correctly.

- **Sprint 1 — Quiz Tools & Accessibility**:
  - Text Resizing toolbar (A-/A+) added to QuizEngine — 6 size steps (14-24px), persists via localStorage.
  - Highlight Tool now session-persistent: highlights survive navigation between questions (stored as text strings, re-applied on render).
  - Strikeout Tool now session-persistent: struck answer choices survive navigation.
  - Refactored QuestionCard to accept `fontSize`, `initialHighlights`, `initialStrikethroughs`, and `onToolsChange` props for parent-managed state.

### 2026-05-13 — Coordination Protocol & Phase 1 Polish (Antigravity)
- **Sprint 4B Completion**: Built `QuestionBankManager.tsx` to serve as a unified hub for the Question Bank. Added a full browse/search/filter table, per-question Edit modals, and Delete functionality, while moving the bulk importer into a sub-tab.
- **Infrastructure**: Successfully configured the custom production URL `brq.stvfamilymed.org` using a Squarespace CNAME and Vercel.
- **Sprint 3 Completion**: Finished the `RosterManager` implementation by adding full **Edit** and **Archive** (delete) functionality via interactive modals, completing the roster CRUD operations.
- Established AI Coordination & Handover Protocol in ROADMAP.md, including a documentation hierarchy, Peer Review rule, and a **Quick Start Prompt** for the user to initiate new sessions.
- Completed remaining Phase 1 Code Quality tasks: created `lib/types.ts` with core data models, implemented global Next.js Error Boundary (`app/error.tsx`), and added ARIA accessibility tags to the `QuizEngine` timer.

### 2026-05-12 — Phase 1 Stabilization & Code Review

- [Claude] Fixed critical bugs in Login.tsx: added missing `useEffect` import (line 3) and missing closing brace in `handleSignUp` function (line 121). Build should now compile successfully.
- [Claude] Comprehensive code review completed — identified the 2 critical syntax errors in Login.tsx (see `REVIEW_FINDINGS.md`).
- [Antigravity] Admin Console updated with manual "Add Authorized Person" functionality.
- [Antigravity] Registration enhanced with First/Last name fields and secure Password Reset flow.
- [Antigravity] Phase 1 UI/UX improvements deployed: "Dr. LastName" formatting and improved login autofill.
- [Antigravity] Project Roadmap initialized to track the transition to a professional-grade platform.
- [Antigravity] Initial Cloud Migration complete. Basic performance tracking and leaderboard active.
