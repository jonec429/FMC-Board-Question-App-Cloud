# FMC Board Question App V2 — Project Roadmap

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

**⚠️ AI Rule (MUST FOLLOW):** ALWAYS ask the user for permission before executing a `git push` to trigger a Vercel deployment. Do not push code autonomously to prevent miscommunications and confusion when testing.

**Current (pre-launch):** Pushing directly to `main` is OK because no residents are using the app yet — fast iteration matters more than preview safety.

**Once we roll out to users (REQUIRED — do not skip this transition):**
- ❌ Stop pushing untested changes straight to `main`.
- ✅ Use one of:
    - **Local dev** (`npm run dev` → http://localhost:3000) for unverified changes, OR
    - **Vercel preview deployments**: push to a feature branch → Vercel auto-generates a unique preview URL → test there with real Supabase → merge to `main` only after verifying.
- The "push to main = instantly live for residents" model is acceptable now and unacceptable later. Whichever AI agent is in the seat at launch must enforce this.

---

## 📊 Current Status (Snapshot — 2026-06-08)

**All planned phases are shipped; the app is in pre-launch hardening.** The active work queue is the **🔧 Code Review — Tech Debt & Hardening** section below (security → bugs → maintainability), being worked top-to-bottom.

| Phase | Status | Notes |
|-------|--------|-------|
| **Phase 1 — Stabilization** | ✅ Complete | UI/Auth fixes, shared types, error boundaries |
| **Phase 2 — Admin Overhaul & Logic Engine** | ✅ Complete | Fixed blocks, Curriculum Manager, RLS write-lockdown, TanStack Query data layer |
| **Phase 3 — Notifications & Intelligence** | ✅ Complete | QOTD ecosystem, Web Push, Analytics Heatmap, Resident Review |
| **Phase 4 — Year-over-Year Transition** | ✅ Complete | YoY schema, derived-PGY model, Academic-Year filtering, Annual Rollover |
| **Phase 5 — Feature Wishlist** | 🔄 Ongoing | Resident Risk shipped; RFID kiosk still parked. See section below. |

**Deployment:** still pre-launch (no residents yet), so pushing straight to `main` is acceptable for now — but **must** switch to preview-branch testing before rollout (see Deployment Workflow). The app is **deploy-blind for AI agents**: every screen sits behind Supabase login, so changes are verified with `tsc` + `next build`, then the user tests on the live site (`brq.stvfamilymed.org`).

### ▶️ Session Handoff — 2026-06-09 (Antigravity)
**Shipped & pushed to `main` this session** (detail in the Changelog): 
1. Fixed a major bug in the `useDashboardData` hook where starting multiple quizzes caused the Dashboard to lose track of all but the most recent one. 
2. Fixed a silent database constraint violation (foreign key on `quiz_sessions`) that was completely preventing the Demo Quiz and Test Block from saving progress.
3. Hardcoded all "Review Topic Material" buttons to point directly to the program's shared Google Drive board review folder, removing reliance on legacy database links.
4. Added a "Show All / Show Incorrects" toggle to the end-of-quiz review screen.

**▶️ Recommended next task — Tech-Debt #4:** Tighten unauthenticated routes (rate-limiting/identity checks for `verify-roster` and `subscribe`).

**Workflow gate:** `npx tsc --noEmit` + `npm run build` both pass at this commit.

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
- [x] **Punctual QOTD Notifications (pg_cron)** ✅ *(2026-06-05)*: `migrate_qotd_pgcron.sql` run + verified in Supabase (`pg_cron` + `pg_net` enabled; test push returned `200 "Morning QOTD notifications processed."`). The redundant Vercel cron (`vercel.json`) and GitHub Actions workflow were removed in the same deploy — **pg_cron is now the single scheduler.** Note: `CRON_SECRET` was rotated to a new value on this date.
- [x] **2026-06-08 — QOTD Top-Up Engine**: `20260608_qotd_topup.sql` — adds a `UNIQUE(question_id)` recycle guardrail to `qotd_schedule` plus the `qotd_topup()` function that powers the Annual Rollover "Update Daily Question pool" button. ✅ **Run by admin 2026-06-08.**
- [x] **2026-06-08 — Badge Catalog Expansion**: `20260608_badges_expansion.sql` — seeds the 9 new achievement badges (Ironman, block-streak ladder, Sharpshooter, Early Bird, Weekend Warrior, Perfectionist, Procrastinator) and removes the duplicate "Marathoner". ✅ **Run by admin 2026-06-08 — new badges now live.**
- [ ] **NEXT — Over Achiever Badge**: `20260611_over_achiever_badge.sql` — seeds the new "Over Achiever" milestone badge to the catalog so it shows as locked in the UI. **Admin must run it in Supabase.**
- [x] **Environment Setup**: Node.js installed, `npm install` run. ✅ *(Note: `@tanstack/react-query` added 2026-05-20)*

### 🎯 Phase 2 — Final Items ✅
- [x] **Sprint 4B** — Browse + per-question Edit UI for the question bank ✅
- [x] **Roster Edit/Archive** — finish the Roster CRUD ✅
- [x] **Custom URL** — DNS/Vercel config only, no code change ✅
- [x] **Question-level Analytics** (Moved to Phase 5 Wishlist)

---

## 🔧 Code Review — Tech Debt & Hardening
*Opened 2026-06-08 (Claude) from a full deep-dive review. User reviewed and approved all items; we're working **top-to-bottom**. Most are small. None change the resident-facing 1:1 look — they're security, correctness, and maintainability fixes. Each item notes the file(s) involved so any agent can pick it up.*

**🔴 Security & data exposure**
- [x] **1. Delete the open `/api/email` route.** ✅ *Done 2026-06-08 (Claude).* Removed `app/api/email/route.ts` (an open, unauthenticated Resend relay); confirmed no code referenced it. The `resend` npm package is now unused — optional follow-up to drop it from `package.json`. *(If email is ever needed again, gate it behind the `CRON_SECRET` / admin-token check that `app/api/web-push/send` already uses.)*
- [x] **2. Put all RLS policies under version control.** Some tables' policies live only in the Supabase dashboard — notably **`results`** (the leaderboard depends on a read policy that exists in no migration file) and the **`question_attempts`** read policy (see #3). Export the live policies into a `supabase/migrations/` file so the repo is the source of truth and the DB is reproducible.
- [x] **3. Stop shipping every resident's raw scores to the browser; verify cohort-stats RLS.** The dashboard leaderboard pulls **all** `results` rows (emails + per-topic scores) client-side (`hooks/useDashboardData.ts`). Related: QOTD "cohort performance" reads `question_attempts` across users — so either (a) those stats are silently self-only (if the policy is still `auth.uid() = user_id`), or (b) the policy was loosened in the dashboard and every resident can read everyone's per-question history. **Verify the live policies**, then move leaderboard + cohort aggregation server-side (a Postgres function/view) so only summaries leave the server.
- [x] **4. (minor) Tighten the unauthenticated routes.** `app/api/auth/verify-roster` lets anyone enumerate the roster (returns name/pgy/role per email); `app/api/web-push/subscribe` trusts a client-supplied email. Add basic rate-limiting / identity checks.

**🟠 Correctness bugs**
- [x] **5. "Review incorrect questions" includes mastered questions.** In `components/QuizEngine.tsx` the `pool === 'incorrect'` path grabs any question ever answered wrong, even if a later attempt was correct (the code comment flags it as "simplified"). Fix to "the most recent attempt was incorrect."
- [x] **6. Push-notification icons 404.** `public/sw.js` references `/icon-192x192.png` and `/badge-72x72.png`, but the icons live under `/icons/` and no badge file exists. Point them at real paths (and add a badge asset).
- [x] **7. "Unused questions" pool can under-fill.** `pool === 'unused'` fetches `count × 10` then filters client-side, so a heavy user can get fewer than requested. Use a server-side `NOT IN` / RPC.
- [x] **8. Biased shuffle.** `sort(() => Math.random() - 0.5)` (QuizEngine, question delivery order) isn't uniform. Replace with Fisher–Yates.

**🟡 Performance & maintainability**
- [x] **9. Gamification fires 20+ sequential DB calls per submit.** `lib/gamification.ts` does a select-then-insert for every badge/club threshold. Move into one Postgres function (or batch + upsert).
- [x] **10. `SUPER_ADMIN_EMAILS` is duplicated in ~7 places** (`lib/roles.ts`, four API routes, a component, the SQL helper). Centralize so adding/removing an admin can't drift out of sync.
- [x] **11. Re-enable build-time type/lint checks.** `next.config.js` sets `ignoreBuildErrors`/`ignoreDuringBuilds: true`. `tsc` passes clean today, so flip them back on to restore the safety net.
- [ ] **12. Replace pervasive `any` types** (`user`, `profile`, `question`, …) with the interfaces already in `lib/types.ts`, so the `tsc` gate actually protects those paths.
- [x] **13. Consolidate loose SQL files.** ~30 ad-hoc `*.sql` files + large data dumps sit in the repo root; only 2 are in `supabase/migrations/`. Move into one ordered migrations folder so it's clear what's been applied.

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

## 📍 Phase 2: The "Admin Overhaul" & Logic Engine (Complete)
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
- [x] **[Antigravity] [NEW]** Admin Designation UI: Allow assigning admin roles directly from the Roster Manager dashboard.

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
- [x] **[Security 2026-05-19, flagged Claude] [MUST FIX BEFORE LAUNCH]** **Tighten RLS policies on `questions`, `blocks`, `block_schedule`, `authorized_roster`**: Current policies (from `migrate_admin_fixes.sql` and `fix_roster_rls.sql`) grant `ALL` to any `authenticated` user via `USING (true)`. Any logged-in resident could write to the question bank, schedule, block metadata, or roster via direct Supabase API calls — bypassing the UI's admin-only checks entirely. Low practical risk today (small trusted roster) but unacceptable for general rollout. Replace with role-based policies that check `auth.uid()` against an `admin`/`faculty` role in `profiles` for write operations. **Reads can stay open; writes must be locked down.**
- [x] **[Feature 2026-05-20, requested by user — for Antigravity] Real Last-Name Sort**: Tables currently sort the Resident/Member column via `lastName()` in `lib/sorting.tsx`, which takes the **final token** of the full name. Two-part last names ("Jan Dela Cruz" → sorts under "Cruz") sort wrong. **Robust fix (user explicitly wants the real field, not a heuristic):**
    1. Write `migrate_roster_split_names.sql` — add `first_name` + `last_name` to `authorized_roster` (mirror `migrate_profiles_split_names.sql`), idempotent, backfill from `name` (split on first space — then admin hand-corrects two-part surnames). Admin runs it in Supabase.
    2. Update RosterManager Add/Edit modal to capture `first_name`/`last_name` as separate fields (or at least `last_name`), writing them on save.
    3. Update sort accessors — `RosterManager` `rosterAccessor` (`'member'` case) and `AdminPerformance` `residentAccessor` (`'name'` case) — to use `last_name` when present, falling back to the existing `lastName()` heuristic for un-migrated rows. Graceful: works before AND after the migration runs.
    4. The `profiles` table already has `last_name`; could be joined, but `authorized_roster` is the source of truth for names pre-signup, so adding the columns there is cleaner.
- [x] **[Security 2026-05-19, flagged Claude]** **`migrate_admin_fixes.sql` is destructive if re-run**: First statement is `DROP TABLE IF EXISTS public.block_schedule CASCADE` with no guard. File now carries a "DO NOT RE-RUN" header, but the safer fix is to split it into idempotent steps (`CREATE TABLE IF NOT EXISTS …`, conditional ALTERs) before reusing any of it as a template for future migrations.
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

## 📍 Phase 5: Feature Wishlist
*Goal: Track potential long-term architectural upgrades and features.*

### App Hardening / Reliability
- [x] **Platform Stability**: App hardening to minimize reloads, logouts/sign-ins, and silent failures. Focus on robust error boundaries, graceful fallbacks, and connection resiliency.
- [x] **Caching Balance**: Ensure we strike the right balance between aggressive client-side caching (React Query / Next.js) and data freshness, so users don't have to force-reload (ctrl+F5) to see new blocks or QOTD results.


### Analytics & Reporting
- [x] **Question-level Analytics**: More granular tracking of individual question performance (distractor analysis heatmap).
- [x] **Admin "Reporting" Tab**: Enhanced PDF generation and export tools for program directors.
- [ ] **"Resident Risk" Logic**: Early-warning metrics based on performance vs. on-time completion. ✅ *2026-06-08:* added **overdue-block detection** (past-due assigned blocks flag a resident who'd otherwise look "on track"), per-resident **"why flagged" reasons**, and **declining-trend detection** (recent scores sliding vs. earlier flags a resident even when their average still looks OK) — in a shared `lib/residentRisk.ts` used by both the Performance dashboard and the CSV/PDF reports. **Alerts:** ✅ in-app "needs attention" banner (Tier 1) + ✅ manual advisor-email digest now carries the overdue/trend/why-flagged reasons. **Remaining (parked):** scheduled Web-Push digest (Tier 2).
- [x] **Advisor Email Reports**: Automated email summaries sent to faculty advisors detailing their specific advisees' performance and completion rates.

### Transition & Infrastructure
- [x] **"Academic Year Transition" Tool**: Handle PGY bumps, archiving old data, and resetting for July 1st (Completed in Phase 4).
- [x] ~~**Migrate Study Materials**: Move PDFs and docs from personal Google Drive to **Supabase Storage**~~ — **Scrapped 2026-06-08 (user decision):** keeping a Supabase Storage mirror in sync with the live Google Drive would be ongoing maintenance for little benefit. Study materials stay on Google Drive.
- [ ] **RFID Kiosk Attendance System:** Build a dedicated iPad kiosk mode (`/kiosk`) that uses a hidden input field to accept badge taps via a USB RFID keyboard-emulating reader. Admins can register badges and monitor a live attendance roster.

### Learning Features
- [x] **Spaced Repetition / "Incorrects Only" Blocks**: Allow residents to auto-generate a custom block consisting solely of questions they've previously missed to reinforce weak areas.
- [x] **Custom Block Live Capacity Filter**: Add an active live filter when building a custom block. It will show exactly how many questions are available based on the selected criteria (e.g., Cardiology + Unused + 2025 ITE). If the requested number of questions exceeds the available pool, the system will block creation and show a popup error.

### UI & UX
- [ ] **Dark Mode Toggle**: Implement a dark mode theme using `next-themes` and Tailwind `dark:` variants. Requires systematically updating all hardcoded Tailwind color classes across the app to prevent visual bugs.

---

## 💡 Parked Ideas & Future Considerations
*Captured 2026-06-05. **✅ All shipped the same day** — #1–#5 built; #6 dropped → replaced by #4 (review). See the changelog above for each. Kept here for provenance.*

- **Block rename in Curriculum Manager**: Inline-edit a block's title. Intended for *planning* (before residents start a block) and to fix accidental "(Copy)" names — explicitly **not** for renaming blocks already in use. ⚠️ If a block with completions is ever renamed, the change must cascade to `results.topic` and `quiz_sessions.topic` (the title is the foreign key) to avoid orphaning scores — best done via a secure admin-only server route.
- **Per-user quiz sorting**: Let every user sort their own quiz/block list however they want — independently on the resident side and the admin side (it does **not** need to be the same order for everyone). Supersedes the earlier "global admin-set block order via `sort_order`" idea.
- **Pause the question timer during review**: When the explanation is revealed, pause the 90-second per-question timer so reading/reviewing the explanation doesn't count against the resident's time.
- **Review prior quizzes** *(now the primary completion record — replaces the dropped email below)*: Let residents revisit **any** past quiz — assigned blocks and custom builds — to review the questions, their own answers, the correct answers, and explanations at any later date.
- **Quiz Mode vs Practice Mode** *(any block EXCEPT QOTD; chosen on a screen right before the quiz starts)*: *Practice mode* reveals the answer + explanation right after each question (current behavior); *Quiz mode* hides them until the whole quiz is submitted, then shows the full review. Applies to assigned blocks AND custom builds.
- ~~**Assigned-block submission email (failsafe)**~~ — **DROPPED 2026-06-05 (user decision):** can't legitimately send *from* the program's `@ascension.org` address (Ascension's domain isn't controllable in Resend → would be spoofing/spam). The **"Review prior quizzes"** history above replaces it as the completion failsafe. The existing (silently-failing) `fetch('/api/email')` in `QuizEngine.tsx` will be removed during the Quiz/Practice + review rework.

### 🔒 Security / Maintenance Notes
- **2026-06-05 — dotenv ad / agent-bait silenced & pinned (Claude)**: `dotenv@17.4.2` (genuine npm package; used only in `scripts/*.ts` dev tooling, **never** in the production bundle) prints rotating console "tips," one of which — `⌁ auth for agents [www.vestauth.com]` — is third-party bait aimed at AI agents. Confirmed it's only a console string: no network calls, no install/postinstall hooks, no exfiltration. Mitigation: added `quiet: true` to all 15 `dotenv.config()` calls in `scripts/`, and pinned `dotenv` to exact `17.4.2` (dropped the `^`) so `npm update` can't silently pull a more aggressive ad build. The domain was not visited. (Note: affects any project using this dotenv version.)

---

## 🆕 Recent Updates (Changelog)
*These items will appear in the app's "What's New" modal. Newest entries on top.*

### 2026-06-13 — View As Impersonation Feature (Antigravity)
*   **See what residents see:** Super Admins can now instantly preview the app exactly as a Resident or Faculty member would, perfect for troubleshooting issues without needing a test account.
*   **Where to find it:** Open **Profile Settings** (the gear icon on the dashboard) and look for the new **Admin Tools: View As** dropdown.
*   **Temporary by design:** Changing your view is purely a temporary client-side override. The moment you refresh the page or log out, you will automatically revert back to your default Admin view.

### 2026-06-11 — Over Achiever Badge (Antigravity)
*   **The Ultimate Milestone:** Added a new "Over Achiever" badge (👑) that unlocks automatically when a resident earns every other standard achievement in the catalog. 
*   **Admin Note:** `20260611_over_achiever_badge.sql` must be run in Supabase to seed the catalog so the badge appears as locked before it's earned.

### 2026-06-09 — Dashboard Active Session Fix & Review Links (Antigravity)
*   **Multiple In-Progress Quizzes Now Supported:** The dashboard previously had a bug where starting a second quiz would cause the first one to "forget" its active state and drop the "In Progress" badge. Now, the dashboard accurately loads **all** incomplete sessions simultaneously, so every quiz you start retains its own independent resume state and badge. (`hooks/useDashboardData.ts`, `components/Dashboard.tsx`.)
*   **Database Fix for Quiz Sessions:** Discovered and fixed a silent database constraint error that was completely preventing the "Demo Quiz" and "Test Block" from saving active sessions. They now reliably save and sync your progress. (`components/QuizEngine.tsx`.)
*   **"Review Topic Material" Button Now Links to Drive:** Hardcoded the Review Topic Material links in both the Question Card and Performance screens to always point directly to the program's shared Google Drive board prep folder instead of relying on legacy/broken database links. (`components/QuestionCard.tsx`, `components/MyStatsModal.tsx`.)
*   **"Show All / Show Incorrects" Toggle:** Added a quick toggle switch to the end-of-quiz review screen. When you finish a quiz, you can now instantly flip between reviewing only the questions you missed or seeing your entire quiz (questions, answers, and explanations) all at once. (`components/QuizEngine.tsx`.)


*   **The Daily Question now shows the correct answer & explanation after it unlocks.** Previously, if you got the QOTD *right*, the review screen showed your score but never the explanation — only a *wrong* answer surfaced it. Now, once the question unlocks at 12:30 PM, you always see the full card: the correct answer highlighted, your own pick, and the explanation. (`components/QuizEngine.tsx`, reusing `QuizReview`.)
*   **"Just in Time" badge retimed.** It used to reward answering 11:55–11:59 AM (just before *noon*), but the Daily Question actually unlocks at **12:30 PM** — so it now fires for answers in the 5 minutes before that (12:25–12:29 PM). The code's unlock time and the on-screen "12:30 PM" text now agree. (`lib/gamification.ts`, `lib/qotd.ts`; catalog description refreshed by `20260608_badges_expansion.sql`.)

### 2026-06-08 — New Achievements & Badges (Claude)
*   **Nine new badges to chase.** 🏊 **Ironman** (140 questions — an Ironman is 140.6 miles, and our program staffs the race's medical tent), an on-time **block-streak ladder** (🎳 On a Roll / 🔒 Locked In / ⚡ Unstoppable for 3 / 5 / 10 in a row), 🎯 **Sharpshooter** (5 QOTDs correct in a row), 🌅 **Early Bird** (block finished 4–6 AM), ⚔️ **Weekend Warrior** (block on a weekend), 💯 **Perfectionist** (100% on 5 different blocks), and 🐢 **Procrastinator** (turn an assigned block in on its last day). Tap **Achievements → View all** to see them — locked until earned. (`lib/gamification.ts`; catalog seeded by `20260608_badges_expansion.sql`.)
*   **🎓 Topic Master now spans the 3 most recent ITEs** — earn it by answering every question in a category across the last three ITE years (was: only the single most recent year), matching the app's freshness window.
*   **Retired a duplicate.** "Marathoner" and "100 Club" were the same achievement (100 questions answered); the unused Marathoner was removed.

### 2026-06-08 — Add-to-Home-Screen Guide + Fresh Block Icons (Claude)
*   **"Install this app on your phone" — step by step.** The login screen *and* your dashboard now have an **Install on your phone** button that opens simple instructions for both **iPhone/iPad (Safari → Share → Add to Home Screen)** and **Android (Chrome → ⋮ → Install app)** — so you can add the app to your home screen and open it full-screen like a native app (and get Question-of-the-Day reminders). It auto-detects your device and highlights the matching steps. (`components/InstallAppModal.tsx`, surfaced from `Login.tsx` + `Dashboard.tsx`.)
*   **Board Review Blocks got friendlier icons.** The plain grey document on each block is now a **colored icon tile** — an open book for standard blocks, a play symbol for the Demo, a gem for Bonus blocks, and a green check once you've completed one. (`components/Dashboard.tsx`.)

### 2026-06-08 — Advisor Emails Now Include the "Why" (Claude)
*(Faculty/admin Performance view.)*
*   **The "Email Advisors" and "Email Report" drafts carry the risk reasons.** Each resident line gains a **Flags** field — e.g. *"2 blocks overdue, Trending down 14%"* — and a ⚠ marker for anyone At Risk / Needs Attention (declining included). So when you manually send an advisor a ping, it shows *who* needs attention and *why*, not just a score. (Still `mailto:` drafts you send from your own mailbox — all advisees included since lists are short.)

### 2026-06-08 — Resident Risk: "Needs Attention" Banner (Claude)
*(Faculty/admin Performance view.)*
*   **Flagged residents surface the moment you open Performance.** A banner up top — *"N residents need attention"* with the at-risk count — links straight to the flagged list (scoped to your advisees if you're faculty), so nobody slipping gets buried in a tab. (In-app alerting; a scheduled push digest is the next piece.)

### 2026-06-08 — Resident Risk: Declining-Trend Detection (Claude)
*(Faculty/admin Performance view.)*
*   **Catch slipping residents before the average tanks.** A resident whose **recent block/quiz scores are trending down** versus their earlier ones is now flagged **🟡 Needs Attention** — even if their cumulative average still looks fine. It appears as a *"Trending down 14%"* chip alongside the other reasons, in the Performance tables, the resident modal, and the CSV/PDF. (Compares the last few scores against the previous few; needs ≥4 attempts. `computeTrend` in `lib/residentRisk.ts`.)

### 2026-06-08 — Resident Risk: Overdue Detection & "Why Flagged" Reasons (Claude)
*(Faculty/admin Performance view.)*
*   **Early warning now catches residents who aren't doing the work.** Risk used to be based only on *completed* blocks — so a resident who'd done nothing showed "on track / 100% on-time." Now any **assigned curriculum block past its due date that the resident hasn't completed** counts as **overdue** and drives their compliance flag (2+ overdue → At Risk, 1 → Needs Attention). (`lib/residentRisk.ts`, shared by the Performance dashboard and the CSV/PDF reports so they always agree.)
*   **Every flag now shows *why*.** Flagged residents display the specific trigger(s) — e.g. "2 blocks overdue," "Avg 54%," "On-time 40%" — in the Performance tables, the resident detail modal, and the exported CSV/PDF, so it's clear who to follow up with and about what.

### 2026-06-08 — See All Achievements, Locked & Unlocked (Claude)
*   **The Achievements card now opens a full catalog.** Tap **“View all”** to see *every* badge — earned ones in color with the date you got them, and **locked ones greyed out with a lock and their “how to earn” description**, so residents can see what's available to chase. Shows an **“X of Y earned”** count, grouped into Daily Question vs Practice & Milestones. The card is now always visible (even before you've earned anything) so achievements are discoverable from day one. (`components/AchievementsModal.tsx` → `components/Dashboard.tsx`.)

### 2026-06-08 — Self-Healing QOTD Streak + Annual Rollover System (Claude)
*   **The Day Streak now heals itself.** It used to be a fragile running counter bumped by a fire-and-forget write on submit — so if that write was slow, failed, or got skipped (and across the schedule resets), the count silently stuck at 1 or dropped. It's now **computed from your real QOTD answer history** (the Eastern weekdays you actually answered), so it's always correct, survives a missed write, and retroactively fixes itself. Weekends are still forgiven, and today stays "in grace" until you answer. (`lib/streaks.ts` → `hooks/useDashboardData.ts`.)
*   **New "Annual Rollover" admin screen** (Admin Console → **System**). A guided, once-a-year workflow for folding in new ITE questions, with a live status header (newest ITE year, question counts by year, Daily Question runway) and three steps: (1) import new questions, (2) refresh the Daily Question pool, (3) optionally refresh blocks. (`components/AnnualRollover.tsx`.)
*   **Daily Question "frozen past, fresh future" top-up.** New questions can now feed the daily without ever recycling: one click rebuilds only the *upcoming* schedule from questions nobody has been shown yet (newest ITE year first), while past days stay frozen and no one is re-served a question they've answered. Backed by a `UNIQUE(question_id)` guardrail so a question can never be scheduled twice. (`supabase/migrations/20260608_qotd_topup.sql` + admin-only `app/api/admin/qotd-topup`.) **⚠️ Run `20260608_qotd_topup.sql` in Supabase before using the button.**
*   **Importer year-tagging.** The bulk importer gained a "Tag all rows as ITE year" field so each annual batch is labeled consistently — keeping the newest-3-years freshness window reliable. (`components/QuestionImporter.tsx`.)

### 2026-06-08 — QOTD "Already Answered" Fix + Shield Logo Restored (Claude)
*   **Question of the Day no longer shows "Answer recorded" before you've answered it.** The dashboard checked *whether* you'd ever answered today's question as a QOTD, but not *when* — so after the daily schedule's clock was reset, a question you answered as a QOTD on an earlier day could resurface as today's question and wrongly skip you to the "Answer recorded / Review Selection" screen. The completion check is now scoped to **today (Eastern time)**, so today's QOTD stays available until you actually answer it today. (`hooks/useDashboardData.ts`, reusing the existing `getTodayDateString` Eastern-time helper. Note: if a question literally repeats across days, that's a leftover in the `qotd_schedule` table from the earlier clock resets — a separate data cleanup.)
*   **The shield is back as the app's icon.** Restored the shield crest for all iconography — the browser favicon (`app/icon.svg`), the home-screen / PWA app icon (192/512/apple-touch + `pwa-icon.svg`, re-added to `manifest.json` + `layout.tsx`), and the dashboard header — so the app stands apart from the many other tools that carry the Ascension "A." `scripts/generate-icons.mjs` again regenerates from the shield SVG. The login and password-reset screens show the shield at the top as well.
*   **Program logo kept for continuity.** The full Ascension St. Vincent's Family Medicine Residency logo now sits — smaller and understated — at the **bottom of the login card**, beneath the form and the AI Disclaimer / What's New links, so the program branding stays present without taking over the app's identity. (`public/brand/program-mark.png` is now unused and can be pruned later.)

### 2026-06-05 — Review Any Past Quiz (My Performance) (Claude)
*   **New "Past Quizzes" tab under My Performance.** Residents can reopen any completed quiz — assigned blocks *and* custom builds — and review every question with their own answer, the correct answer, and the explanation (powered by the saved `review_data` snapshot + the shared `QuizReview` component). This is the permanent record that **replaces the old completion email**. *(Parked idea #4 — shipped. Quizzes taken before the 2026-06-05 "review foundation" update show as "review unavailable.")*

### 2026-06-05 — Curriculum Order Fix (Claude)
*   **Blocks now sort in true curriculum order.** Previously every block carried a leftover `sort_order = 0`, which the sorter treated as "explicitly ordered" — so all blocks tied at 0 and just appeared in creation order (e.g., the Demo Quiz landing in the middle). Now `0` is treated as "unset," so the intended order applies — **Block 1 → Block 2 → … → bonus → other → Demo last** — on both the admin Curriculum list and residents' dashboards. (`blockSortKey` in `CurriculumManager.tsx` + `getBlockSortKey` in `useDashboardData.ts`.)

### 2026-06-05 — Practice vs Quiz Mode + End-of-Quiz Review (Claude)
*   **Pick your mode before any block** (assigned or custom; not QOTD): a quick start screen lets you choose **Practice** (answer + explanation reveal after each question — the original behavior) or **Quiz** (answers stay hidden until you submit the whole thing).
*   **Quiz mode ends with a full review** — every question, your answer, the correct answer, and the explanation on one screen (new reusable `QuizReview` component).
*   The "timer pauses while reviewing" behavior now applies only in Practice mode (Quiz mode has nothing to reveal mid-quiz). *(Parked idea #5 — shipped. Reviewing *past* quizzes under My Performance is the final piece, coming next.)*

### 2026-06-05 — Sort Your Board Review Blocks (Claude)
*   Residents can now **sort their block list** — *Curriculum order* (default), *Name (A–Z)*, or *Unfinished first* — from a dropdown above "Board Review Blocks." The choice is **saved per person** on their own device, so everyone can order their list however they like.
*   Admins get the same per-user sort in the **Curriculum Manager** (*Curriculum order / Name (A–Z) / Due date*). *(Parked idea #2 — shipped, both sides.)*

### 2026-06-05 — Curriculum Manager: Inline Block Rename (Claude)
*   **Admins can rename a block inline** — click a block's title in the Curriculum Manager, type a new name, press Enter (Esc to cancel). Guarded for safety: a block can only be renamed **before any resident has completions for it** (it's meant for planning new blocks and fixing accidental "(Copy)" names) — once a block is in use it locks, since the title is what links residents' scores to it. *(Parked idea #1 — shipped.)*

### 2026-06-05 — Timed Quizzes: Timer Pauses While Reviewing (Claude)
*   On timed quizzes, the countdown now **pauses while you review a question's explanation** (any question you've already answered) and resumes when you move to a question you haven't answered yet — so reading explanations never counts against your time. The timer shows **"(paused)"** in amber while it's held. *(Parked idea #3 — shipped.)*

### 2026-06-05 — Admin Tables: Last-Name Display & Curriculum Layout (Claude)
*   **Admin tables now read by last name:** The Performance resident tables and the Roster "Member" column display residents as **"Lastname, Firstname"** (e.g. *Nguyen, Angela*) via a new `formatLastNameFirst` helper, so sorting by last name is obvious at a glance. (Resident-facing screens still show "Dr. First Last".) The underlying sort already used last name — this fixes the *display* that made it look first-name-sorted.
*   **Curriculum Manager row layout:** Rebalanced the block-row columns and restructured the last two cells — the Questions cell now stacks vertically (count over label) and the actions sit as **Builder on top with Duplicate / Archive / Delete evenly spaced beneath**, fixing the cramped collision between the "Needs Qs" badge and the Builder button.

### 2026-06-05 — Program Logo & Branding (Claude)
*   **Ascension St. Vincent's Family Medicine Residency logo** now appears across the app, replacing the generic shield: the **full logo** anchors the Login and password-reset screens, and the **triquetra mark** sits in the Dashboard header and is the new **home-screen / PWA app icon** (regenerated at every size on a clean white tile).
*   Source art lives in `public/brand/` — `program-logo.png` (full lockup) + `program-mark.png` (cropped mark), both derived from the high-res transparent original. The icon pipeline (`npm run icons` → `scripts/generate-icons.mjs`) now regenerates from the mark; the old shield SVGs (`pwa-icon.svg`, `app/icon.svg`) were retired and dropped from `manifest.json` + `layout.tsx`.

### 2026-06-05 — QOTD Fixes: Streak, "Already Answered", & Punctual Notifications (Claude)
*   **QOTD streak no longer stuck at 1:** Fixed a timezone bug in `lib/gamification.ts` where the "last answered" date was parsed as UTC — which in Eastern time lands on the *evening before*, making the streak logic think a weekday was missed every single day and resetting the count to 1. Streaks now increment correctly across consecutive weekdays (and still forgive weekends).
*   **Daily question no longer shows as "already answered":** The dashboard's QOTD completion check (`hooks/useDashboardData.ts`) matched only on the question ID, so if today's daily question had been seen before inside a normal practice block, it skipped straight to the reactions screen. It now requires the attempt to have been logged *as the QOTD* (`is_qotd = true`).
*   **Build fix:** Reordered `.abortSignal()` before `.maybeSingle()` in `lib/qotd.ts` so the project type-checks and deploys cleanly (a leftover from the June 3 hardening pass that was blocking a clean build).
*   **Punctual notifications via Supabase pg_cron:** Replaced the late-firing free crons with a Supabase `pg_cron` schedule (`migrate_qotd_pgcron.sql`) that fires the 8:00 AM and 12:30 PM QOTD pushes on time — the old GitHub Actions / Vercel crons were "best effort" and routinely ran 5-20+ minutes late. Verified live (test push returned 200 "...notifications processed"). The two redundant schedulers (`.github/workflows/push-notifications.yml` + the `crons` block in `vercel.json`) were **removed** so pg_cron is the single source of truth. `CRON_SECRET` was rotated as part of this.

### 2026-06-03 — PWA Icon Updated to Shield Logo (Claude)
*   **Home-screen icon now matches the in-app shield:** Replaced the old open-book PWA icon with the `AbfmShield` crest (the same logo shown on the Login and Dashboard headers). Rewrote the source art in [pwa-icon.svg](file:///c:/Users/jcarb/.gemini/antigravity/scratch/FMC%20Board%20Question%20App%20V2/public/icons/pwa-icon.svg) and regenerated `icon-192x192.png` and `icon-512x512.png`.
*   **iPhone "Add to Home Screen" icon added:** Generated a flattened `public/icons/apple-touch-icon.png` (180×180, no transparency) and wired an `icons` block into [layout.tsx](file:///c:/Users/jcarb/.gemini/antigravity/scratch/FMC%20Board%20Question%20App%20V2/app/layout.tsx) plus an SVG entry in [manifest.json](file:///c:/Users/jcarb/.gemini/antigravity/scratch/FMC%20Board%20Question%20App%20V2/public/manifest.json), so iOS shows the shield instead of a page screenshot.
*   **Reusable generator:** Added `sharp` (devDependency) and [generate-icons.mjs](file:///c:/Users/jcarb/.gemini/antigravity/scratch/FMC%20Board%20Question%20App%20V2/scripts/generate-icons.mjs), runnable via `npm run icons`, to regenerate every PNG from the SVG whenever the logo changes.

### 2026-06-02 — Refresh-Hang Root Cause Fixed (Claude)
*   **Infinite spinner on refresh — actual root cause fixed:** Logged-in users could get stuck on "Initializing FMC BRQ App..." after a page refresh. Root cause was in `app/page.tsx`: the `onAuthStateChange` callback `await`ed a Supabase query (`loadProfile`) *inside* the callback. Supabase's own docs (auth-js v2.105.4, `GoTrueClient.js`) explicitly warn this deadlocks the auth lock and stalls `getSession()` on load — which matches the earlier "zero requests firing / never reached the wire" observation.
*   **Fix:** Made the callback non-async, skip the redundant `INITIAL_SESSION` event (already handled by `init()`), and defer `loadProfile` via `setTimeout(0)` per Supabase guidance. No `lock` overrides involved — this deliberately avoids the prior add/remove churn on `lib/supabase.ts`.

### 2026-06-02 — App Loading Stability & QOTD Refinements (Antigravity)
*   **App Loading — `lock` override removed (did NOT fully resolve the hang):** Removed a custom `lock` override in `lib/supabase.ts` that interfered with Supabase GoTrue's native `navigator.locks` mechanism. *NOTE (Claude, same day): this alone did not fix the infinite-spinner-on-refresh; the real cause was the `onAuthStateChange` deadlock in `app/page.tsx` — see the Claude entry above.*
*   **QOTD Auto-Submit:** Updated `QuizEngine.tsx` so that selecting an answer for the Question of the Day instantly triggers the quiz submission and transitions to the completion screen, removing the need for users to manually click "Submit Answer" (which appeared broken since explanations are hidden for QOTDs) and then "Close".
*   **QOTD Duplicate Prevention:** Updated `Dashboard.tsx` to force an immediate background data refresh whenever the user returns to the dashboard from the Quiz Engine. This immediately updates the "Take QOTD" card to the "Review Selection" card, preventing users from retaking the QOTD and accidentally submitting duplicate attempts.

### 2026-06-01 — Year-over-Year Curriculum Manager (Antigravity)
*   **Academic Year Filtering:** The Curriculum Manager now groups blocks by Academic Year with a tabbed interface.
*   **Block Duplication:** Admins can duplicate blocks from one year to another using the new "Copy" action, carrying over title, filters, and question counts while clearing scheduled dates.
*   **Infrastructure:** Push notifications scheduling was fully migrated to GitHub Actions for exact-minute reliability, bypassing Vercel Hobby limits.
*   **Stability:** Disabled Supabase `multiTab` auth sync to completely resolve PWA navigator lock freezes.

### 2026-05-29 — Spaced Repetition & Live Capacity Filters (Antigravity)
*   **Live Capacity Filter:** The Custom Block builder now displays exactly how many questions match your filters in real-time. If you request more questions than are available in your pool, the "Generate Block" button safely disables to prevent errors.
*   **Incorrects Only (Spaced Repetition):** Residents can now easily create targeted review blocks out of their previously missed questions, with full visibility into how many incorrect questions they have accumulated.
*   **Notification Reliability:** Shifted the Vercel cron schedules earlier (7:30 AM and 12:00 PM) to account for queueing delays, ensuring push notifications arrive closer to the intended 8:00 AM and 12:25 PM marks.
*   **Release Time Text Alignment:** Aligned all user-facing text from "12:25 PM" to "12:30 PM" across `QuizEngine.tsx` and `Dashboard.tsx` to set correct expectations for push notification delays.
*   **QOTD Inline Explanation Fix:** Disabled the immediate "study mode" inline explanations specifically for the daily QOTD so that residents don't accidentally reveal the correct answer and explanation right after selecting their choice.

### 2026-05-28 — Phase 5: Advanced Analytics & Reporting (Antigravity)
*   **Question-Level Analytics:** Added `selected_index` tracking to `question_attempts` to record exactly which distractor options residents are choosing. The Trend Analysis Heatmap in the Admin Console now visualizes this data, highlighting common "trap" options (over 20% selection rate).
*   **Admin Reporting Tab:** Created a new "Export & PDF" tab within the Admin Console. Admins can now download a CSV spreadsheet containing the performance and on-time rates of all active residents, or generate a clean, printable PDF report summarizing cohort performance.
*   **Advisor Email Summaries:** Added an "Email Advisors" button on the All Residents view that aggregates performance data grouped by assigned advisor and generates a pre-filled `mailto:` link. Also added a localized "Email Report" button for faculty under the "My Advisees" tab.
*   **System Stability:** Prevented socket leakage and hanging loading states by introducing `AbortController` cancellation for unmounted components in `Dashboard.tsx` and background data fetches.
*   **QOTD Clean-up:** Removed the confusing "Finish Block" button from QOTD result screens, replacing it with a simple "Close" button. QOTDs no longer show misleading "On-Time" checkmarks since they are not assigned blocks.

### 2026-05-26 — Logout Fix, Notification Logs, QOTD History, App Badging, & UI Improvements (Antigravity)
*   **Logout Button Fix:** Wrapped `supabase.auth.signOut()` in a 5-second timeout inside [page.tsx](file:///c:/Users/jcarb/.gemini/antigravity/scratch/FMC%20Board%20Question%20App%20V2/app/page.tsx) and added a fallback `catch` block that clears all `sb-*` localStorage keys and reloads the page to ensure users can recover from stuck auth states.
*   **QOTD Notification Cron Robustness:** Completely overhauled [qotd-morning/route.ts](file:///c:/Users/jcarb/.gemini/antigravity/scratch/FMC%20Board%20Question%20App%20V2/app/api/cron/qotd-morning/route.ts) and [qotd-noon/route.ts](file:///c:/Users/jcarb/.gemini/antigravity/scratch/FMC%20Board%20Question%20App%20V2/app/api/cron/qotd-noon/route.ts) to validate VAPID keys early, perform strict null checks on push subscription endpoints (to prevent crashes on bad payloads), and return detailed JSON summaries with `{ sent, failed, expired, skipped }` counts. Added `[qotd-morning]` and `[qotd-noon]` structured prefixes to all logs.
*   **QOTD History Tab (New Feature):** Added a paginated "Past QOTDs" tab to the post-noon QOTD results view. It features a compact card-based history (up to a 3-month rolling window) displaying the question, the correct answer, cohort correctness stats, and resident reaction tallies. Implemented in [QotdHistory.tsx](file:///c:/Users/jcarb/.gemini/antigravity/scratch/FMC%20Board%20Question%20App%20V2/components/QotdHistory.tsx) and wired in [QuizEngine.tsx](file:///c:/Users/jcarb/.gemini/antigravity/scratch/FMC%20Board%20Question%20App%20V2/components/QuizEngine.tsx) using the data fetches in [qotd.ts](file:///c:/Users/jcarb/.gemini/antigravity/scratch/FMC%20Board%20Question%20App%20V2/lib/qotd.ts).
*   **Release Time Text Alignment:** Aligned all user-facing text from "12:00 PM" / "noon" to "12:25 PM" across [QuizEngine.tsx](file:///c:/Users/jcarb/.gemini/antigravity/scratch/FMC%20Board%20Question%20App%20V2/components/QuizEngine.tsx) and [Dashboard.tsx](file:///c:/Users/jcarb/.gemini/antigravity/scratch/FMC%20Board%20Question%20App%20V2/components/Dashboard.tsx) to match the actual timed results release schedule.
*   **QOTD Clock Start Date Reset:** Adjusted the academic year QOTD starting logic in [qotd.ts](file:///c:/Users/jcarb/.gemini/antigravity/scratch/FMC%20Board%20Question%20App%20V2/lib/qotd.ts) to set the start date to **May 21st, 2026** (the launch date) for the current academic year, preventing burning through sequential questions for pre-launch dates.
*   **PWA App Badging API Integration:** Implemented the Web App Badging API (`navigator.setAppBadge(1)` / `navigator.clearAppBadge()`) inside [sw.js](file:///c:/Users/jcarb/.gemini/antigravity/scratch/FMC%20Board%20Question%20App%20V2/public/sw.js) and [page.tsx](file:///c:/Users/jcarb/.gemini/antigravity/scratch/FMC%20Board%20Question%20App%20V2/app/page.tsx) to support native app icon badge counts for push notifications, which automatically clear upon opening the app.
*   **QOTD Return Button & UI Clean-up:** Added an "X" close button next to the QOTD tab bar for quick return to the dashboard, and removed redundant/duplicated "Back to Dashboard" buttons from the QOTD tabs in [QuizEngine.tsx](file:///c:/Users/jcarb/.gemini/antigravity/scratch/FMC%20Board%20Question%20App%20V2/components/QuizEngine.tsx).
*   **Security & RLS bypass for Push Count:** Implemented a backend security bypass to fetch the correct active push subscription count safely for admin dashboard views.

### 2026-05-25 — Auth RLS Fix & Notifications Timing (Antigravity)
*   **Registration Security API Bypass:** Fixed an issue where new residents could not register because the recent database lockdown prevented unauthenticated users from reading the `authorized_roster` table. Created a secure backend API (`/api/auth/verify-roster`) to perform the verification server-side without exposing the entire roster to the public internet.
*   **QOTD Precision Timing:** Shifted the daily Question of the Day availability and push notifications from 12:00 PM EST to 12:25 PM EDT to perfectly synchronize with the residency's timed Slack notification workflow. Updated the `vercel.json` cron schedules to UTC equivalents.
*   **Session Recovery Red Screen:** Resolved a silent hang condition on app startup caused by corrupted `localStorage` auth tokens from previous bugs. The app now intercepts the silent failure and explicitly displays a red "App Failed to Start" screen with a manual **Reset Session** button to clear the bad token and restore functionality.
*   **Feedback Integration:** Added dedicated "Feedback" (mailto:) buttons to both the main dashboard header and the Quiz Engine's correct answer screen. The email dynamically pre-populates with the target address and subject line (including the Question ID/Block name if applicable).

### 2026-05-21 — Stability Hardening & Review Experience (Antigravity)
*   **"My Performance" Button Crash**: Safely patched a hidden bug in the leaderboard rank calculation logic that caused the app to crash when a user on the leaderboard hadn't fully configured their email address.
*   **Infinite Admin Console Spinner**: Disabled automatic retries for the core admin data fetches. Now, if the network drops or times out, it stops spinning immediately and provides a manual "Retry" option instead of hanging for 2 minutes.
*   **QOTD Dashboard Loading Issue**: Isolated the QOTD server query into its own fail-safe block. If the QOTD takes too long to load, the dashboard will gracefully skip it and load the rest of the blocks and stats normally without breaking.
*   **"Review Weak Areas" Comprehensive Info**: Updated the Resident Review modal to pull in the rich interface from the standard Quiz Engine—including the deep explanation breakdown ("Logic & Evidence") and quick access buttons to Open Evidence, Board Prep Gem, and the Review Topic Material drive folder.

### 2026-05-21 — Gamification & Stability (Antigravity)
*   **Gamification**: Introduced the "100/200/300/400/500/1k Club" badge system and "Hot Streak" tracking to the Dashboard to increase resident engagement.
*   **Quality of Life**: Added a password visibility toggle (Eye/EyeOff) to all login and profile screens. Added visual roles/designations (e.g. Faculty, Fellow) to the dashboard.
*   **Infinite Spinner Fixes**: Added hard timeout wrappers (`withTimeout`) across `useAdminData.ts`, `ResidentReview.tsx`, and the QOTD loader to prevent the app from hanging silently when Supabase auth or the network drops.
*   **Cron Security**: Locked down the `/api/cron/qotd-morning` and `qotd-noon` routes by strictly enforcing the `CRON_SECRET` auth header, stopping random web crawlers and build jobs from sending unwanted push notifications.

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

