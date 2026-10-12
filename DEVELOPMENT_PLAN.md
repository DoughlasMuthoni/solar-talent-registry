# Solar Talent Registry: Development Plan

_Drafted 2026-10-07. **Phase 0 complete (2026-10-07)**; Phase 1 not started._

## Where we are

A working single-file prototype (`solar-recruitment-app/solar-talent-registry.html`) that demonstrates the full workflow:
- a 5-step application form
- rule-based scoring and routing
- a recruiter dashboard with filters, a detail drawer and manual EPRA verification
- CSV/JSON export and import

After Phase 0 it is rebranded to Waterlift Solar, hardened against XSS and CSV injection, has optional `localStorage` saving and has scoring tests. It still has no backend, authentication, file uploads or audit trail. The README is explicit that it must not hold live personal data.

## Goal

A production applicant-tracking system for solar technicians in Kenya that:
1. Takes applications through one public link (mobile-first, low bandwidth).
2. Supports a human-run EPRA verification queue.
3. Triages candidates with transparent, versioned scoring that a human always reviews.
4. Complies with the Kenya Data Protection Act 2019.

---

## Phase 0: Harden the prototype (about 2–3 days)

The prototype is used for demos and stakeholder feedback, so it should be correct and safe first.

| # | Task | Status |
|---|------|--------|
| 0.1 | Remove the stale root copy with the injected Kaspersky script. | ✅ Moved out of the project (not committed, so the tracking URL is not in git history). |
| 0.2 | `git init` + baseline commit. | ✅ |
| 0.3 | `esc()` on every interpolated value. | ✅ Plus `sanitize()` normalises every record from the form, import or storage. |
| 0.4 | CSV formula-injection guard. | ✅ `csvCell()`. The CSV now also includes score and status, and has a UTF-8 BOM so Excel reads the encoding. |
| 0.5 | Unique IDs. | ✅ Max sequence + 1; duplicates are renumbered on merge. |
| 0.6 | Validate import; Replace / Merge choice. | ✅ An in-page dialog reports how many records are valid and how many were skipped. |
| 0.7 | Split "Not eligible". | ✅ **Ineligible (licence)** vs **Below threshold**, in the filter, badges and Automation view. |
| 0.8 | Optional `localStorage` saving + "Clear local data". | ✅ Opt-in, in Privacy & controls. Off by default. |
| 0.9 | Polish and accessibility. | ✅ Theme icon on load, theme remembered, separate JSON backup button, drawer focus trap + focus return, Escape handling. |
| 0.10 | Testable scoring + tests. | ✅ Pure `<script id="scoring">` block, with 8 tests in `tests/scoring.test.mjs`. |
| 0.11 | Rebrand to Waterlift Solar. | ✅ Navy/sky/orange tokens (contrast-checked), inline theme-aware wordmark, favicon, orange CTA and progress bar. |

**Bugs found and fixed along the way:**
- **Expired licences passed the eligibility gate.** A licence that expired yesterday still counted as valid, because `Math.ceil` of a negative fraction is `-0` and `-0 >= 0` is true. `daysTo` now compares calendar days.
- **"Continue" and "Submit application" both showed on every form step,** because `.btn{display}` overrode the `hidden` attribute.
- **The candidate drawer was cramped,** with licence numbers and dates wrapping mid-word.
- **Imported `years` / `largestPv` values that weren't numbers produced a NaN score.**

**Verification:** `node --test solar-recruitment-app/tests` (8/8 pass) plus 31 end-to-end browser checks in headless Edge covering the form flow, XSS payloads, CSV output, import merge/replace, persistence, focus trap, both themes and mobile width.

**Exit criteria:** ✅ fixes verified in the browser; ✅ scoring tests pass; ⏳ stakeholders sign off on the form fields and scoring weights, and the client approves the recreated logo.

## Phase 1: Production foundation (about 2 weeks)

**Recommended stack** (a single TypeScript codebase keeps a small team fast):
- **React 19 + Next.js (App Router) + TypeScript** for both the candidate portal and the recruiter app, with route handlers / server actions as the API.
- **UI: Tailwind CSS v4 + shadcn/ui + lucide-react.** shadcn/ui is built on Radix, so focus trapping, keyboard handling and ARIA come built in. Supporting libraries: react-hook-form + Zod (forms), TanStack Table (candidate table), Sonner (toasts), next-themes (light/dark), Recharts via shadcn `Chart` (analytics).
- **PostgreSQL on Supabase** with **Prisma 7** via `@prisma/adapter-pg`. MySQL was used briefly on 2026-10-07; the user then chose **Vercel + Supabase** "for better performance".
- **Auth:** Supabase Auth, email only. **One role: Admin.**
- **Auth**: a managed provider (Clerk, Auth0 or Supabase Auth) for staff. Candidates use magic link or phone OTP only.
- **Object storage**: S3-compatible, private buckets, signed URLs, malware scanning on upload.
- **Hosting**: Vercel or a container on AWS/GCP. Choose a region with data-transfer obligations in mind (see Phase 5).
- **CI**: GitHub Actions running lint, typecheck, unit tests and Playwright end-to-end tests.

### Status (2026-10-07): built in `web/`; final checks pending

| Task | Status |
|---|---|
| Scaffold | ✅ Next.js 16.4, React 19.3, TypeScript, Tailwind v4, ESLint, Turbopack, Cache Components |
| Database | ✅ MySQL/MariaDB with Prisma 7.10. Dedicated database and least-privilege user. 14 tables, snake_case mapped. Initial migration applied. |
| Data model | ✅ All entities below, plus `ScoringRuleSet` (versioned rules), `StageChange` (pipeline history with reasons) and `ApplicationCategory` |
| Scoring module | ✅ `src/lib/scoring/rules.ts`: rules as data (v1 = prototype weights), a per-rule breakdown, and plain-language eligibility issues. 22 Vitest tests, including the expired-licence regression. |
| Validation | ✅ Zod schema per form step; Kenyan phone numbers normalised to E.164; licence number and expiry required for T1–T3. 16 tests. |
| Design system | ✅ shadcn (Radix, nova). Brand tokens with every text pair ≥4.5:1 and input borders ≥3:1, an orange `brand` button, `ToneBadge`, a theme-aware `<Logo>`, Montserrat headings and the app icon. |
| Screens | ✅ Landing page; `/apply` (a "what you'll need" page; the form is Phase 2); recruiter sidebar layout; dashboard (KPIs, pipeline, screening mix, expiring licences); candidates data table (search, filters, sort) |
| Seed | ✅ 6 fictional candidates, scored by the real rules module |
| Safety | ✅ `src/proxy.ts` blocks recruiter routes in production until sign-in exists |
| Verification | ✅ Typecheck, lint (one known TanStack/React Compiler warning) and 38 unit tests pass. All pages were browser-checked in light and dark mode and at mobile width, with no console errors; this check fixed a theme-toggle hydration mismatch and a lint error in `use-mobile`. ⏳ `npm run build` has not been run yet. |
| Environments / secrets / CI | ⏳ Waiting on the hosting decision (open question 6) |
| Staff authentication | ⏳ Moved to the start of Phase 3. Provider decision needed. |

Original task list:
1. Repo scaffold, environments (dev/staging/prod), secrets management.
2. Data model:
   - `Candidate`
   - `Application` (versioned submissions)
   - `Licence` (class, number, expiry, verification status, verifier, verified_at, evidence)
   - `Experience`, `Referee`, `Document`
   - `ScoreRun` (rule version, parts, total, status)
   - `PipelineStage`, `Note`
   - `AuditEvent`
   - `User` / `Role` (recruiter, assessor, admin)
   - `ConsentRecord`
3. Port the counties/regions reference data and the scoring rules as a **pure, versioned module** that reuses the Phase 0 test cases.
4. Design system:
   - `npx shadcn init`, then put the **Waterlift Solar brand tokens** from `CLAUDE.md` into `globals.css` (light + `.dark`), including a `--brand-orange` token and the text-safe orange/sky shades.
   - Add the components: `sidebar card button badge input select textarea checkbox form progress sheet dialog alert-dialog popover calendar table sonner chart`.
   - Add Badge variants for success, warning (amber) and danger, kept distinct from brand orange.
   - Carry over the prototype's accessibility rules: 44px touch targets and reduced motion.
   - Copy `assets/brand/*.svg` into `public/brand/`. Build a `<Logo variant="full|wordmark|mark">` component that picks the light or `-dark` file from the `next-themes` theme. Use `waterlift-mark.svg` for the favicon and app icon. Get client approval of the recreated logo.

   Prototype → component map:

   | Prototype | shadcn/ui |
   |---|---|
   | Sidebar + mobile menu | `Sidebar` |
   | Dashboard number tiles, panels | `Card` |
   | 5-step application form | `Form`, `Input`, `Select`, `Textarea`, `Checkbox`, `Progress` |
   | Licence expiry field | `Calendar` + `Popover` |
   | Candidate table + filters | Data table (TanStack Table) |
   | Candidate detail drawer | `Sheet` |
   | Status badges | `Badge` (custom variants) |
   | Toast | `Sonner` |
   | Score ring, pipeline, analytics | `Chart` |
   | Import confirmation | `AlertDialog` |

## Phase 2: Candidate portal (about 2 weeks)

### Status (2026-10-07): core flow done and tested end to end

| Item | Status |
|---|---|
| 1. Public 5-step form + shared Zod validation | ✅ Mobile-first, per-step validation (cross-field rules included), first-error focus, consent checkboxes |
| 2. Save and resume | ✅ On the candidate's own device (localStorage autosave; consents never restored). ⏳ Cross-device resume needs email/SMS (Phase 4). |
| 3. Document uploads | ⏳ Needs the Supabase Storage bucket (private, signed URLs). The `Document` table is ready. |
| 4. Privacy notice + separate consents | ✅ `/privacy` **draft**, with `[placeholders]` for the DPO to complete. Recruitment, licence-verification and optional talent-pool consents are recorded with the notice version. |
| 5. Confirmation | ✅ On-screen reference (e.g. `KIA-T2-0007`) and next steps. ⏳ Email/SMS copy is Phase 4. |
| 6. Candidate self-service | ⏳ Needs verified candidate identity (magic link / OTP), so it moves to Phase 4. |
| Social advert attribution | ✅ `?src=` / `utm_*` → `SocialSource`, a dashboard "Where applicants come from" card, a Source filter, and a social share card using the real logo |
| Abuse protection | ✅ Server re-validation, honeypot, idempotent `submissionKey`, and repeat emails never overwrite stored candidate data. ⏳ Rate limiting once on Vercel (e.g. Upstash or Vercel firewall). |
| Verification | ✅ 56 unit tests. A 20-step browser test on a phone-sized screen covers validation, draft restore, submit, scoring, attribution, the share card and console errors. |

**Bug found by the browser test and fixed:** a field's error message only cleared when the field lost focus, i.e. when the candidate tapped Continue. The resulting layout shift made the tap miss the button.

Original task list:

1. Public multi-step form (same 5 steps), with server-side validation using Zod schemas shared with the client.
2. Save-and-resume drafts (magic link / OTP), designed for patchy mobile connections.
3. Document uploads: EPRA licence copy, certificates, project photos. Size and type limits, virus scanning.
4. Privacy notice before data collection. Recruitment consent kept separate from optional talent-pool consent.
5. Confirmation email/SMS with the application reference.
6. Candidate self-service: view status, correct data, withdraw, request deletion.

## Phase 3: Admin workspace (about 3 weeks)

### Status (2026-10-07): built and tested locally; Supabase sign-in waiting on the project

| Item | Status |
|---|---|
| 1. Access control | ✅ One **Admin** role (user decision). Supabase Auth email + password, password reset, invite flow (`npm run admin:invite`), `/account/password`. `requireAdmin()` in every page, data read, action and export. ⏳ Needs real testing once the Supabase project exists; dev uses a clearly flagged stand-in admin. |
| 2. Candidate list | ✅ Search and filters (region, class, screening, source), sorting, links to detail. Server-side pagination can wait until volume needs it. |
| 3. Candidate detail | ✅ Per-rule score breakdown with eligibility issues, evidence, referees, contact, consents, notes, stage changes (reason required for adverse moves), timeline |
| 4. EPRA verification | ✅ Per candidate: register result + evidence note, verifier and time recorded, expiry countdown. ⏳ A dedicated queue view and 90/30/0-day reminders come with Phase 4 messaging. |
| 5. Assessments | ⏳ Pipeline stages cover them for now; structured test results are next. |
| 6. Reference checks | ⏳ The `Referee.contactedAt` / `outcome` fields exist; the UI is next. |
| 7. Audit trail | ✅ Submissions, verifications, stage changes, re-scores, exports and admin invites |
| 8. Exports | ✅ Admin-only CSV, audited, formula-injection safe |
| 9. Rule versions | ✅ Re-score with the active `ScoringRuleSet`; every score keeps its version. ⏳ An admin editor for new versions is next. |
| Verification | ✅ 72 unit tests; a 14-step admin browser test (verification and stage rules enforced, notes, re-score, export, 404, sign-out, no console errors) |

Original task list:

1. Role-based access: recruiters, assessors, admins.
2. Candidate list with server-side search, filters, pagination and saved views.
3. Candidate detail page:
   - score breakdown showing which rule produced each point
   - document viewer
   - notes
   - stage changes, each requiring a reason for adverse moves
4. **EPRA verification queue**: assign, check against the public register, record the outcome with evidence. Expiry reminders at 90/30/0 days.
5. Assessment tracking: technical test and practical test scheduling, results, assessor sign-off.
6. Reference checks workflow.
7. Audit trail on every view, export, score change, verification and status change.
8. Exports restricted by role and logged.
9. Admin: edit scoring weights and thresholds as a new **rule version**. Past scores keep the version they were calculated with.

## Phase 4: Communications and integrations (about 1–2 weeks)

### Status (2026-10-07): built, tested and live; emails switch on when Brevo is connected

| Item | Status |
|---|---|
| Email service | ✅ Brevo transactional API (`src/lib/email/send.ts`). Every attempt goes into `email_logs`; a `dedupeKey` makes scheduled emails idempotent; with no `BREVO_API_KEY` sends are logged as SKIPPED and never fail the app. ⏳ Needs a Brevo account, a verified sender and an API key. |
| Application confirmation | ✅ Sent with `after()`, so it never delays or fails a submission. Includes the reference and a private status link. |
| Candidate self-service | ✅ `/status` → emailed HMAC-signed link valid 30 days (`src/lib/status-token.ts`) → `/status/view`: plain-language progress, withdraw, request data deletion (DPA). The reply is identical for unknown details; links are limited to 3 per hour; the page sends no referrer and isn't indexed. |
| Licence-expiry reminders | ✅ Daily Vercel Cron `/api/cron/daily` (05:00 UTC = 08:00 EAT), protected by `CRON_SECRET`. Only the nearest milestone is sent (90/30/7/0 days), each once per licence. |
| Admin daily summary | ✅ New applications, priority reviews, pending verifications and licences expiring within 30 days, once per admin per day. |
| Admin timeline | ✅ Shows emails (sent, skipped or failed), candidate withdrawals and deletion requests (with a red "Data deletion requested" badge). |
| WhatsApp / SMS | ⏳ Not started (needs a WhatsApp Business / Africa's Talking account). |
| Admin invitations via Brevo SMTP | ⏳ Connect Brevo SMTP in Supabase Auth so invite and reset emails work for any address. |
| Document uploads | ⏳ Supabase Storage. Needs the user's agreement to use the service-role key server-side. |
| Verification | ✅ 98 unit tests; a 13-step browser test (submit → status link → view → re-request → tamper rejected → withdraw → deletion request → cron auth and run); all test data deleted |

**Fixed during testing:** application saves now allow a 20 s transaction (Prisma's default is 5 s). Over a slow link the save could time out (P2028) and lose the application.

Original task list:

1. Transactional email (Postmark, SES or Resend) with templates per pipeline stage.
2. WhatsApp Business API (Meta Cloud API or Africa's Talking) for status updates and reminders, opt-in only.
3. Calendar invites for assessments (Google/Microsoft).
4. Optional SMS fallback (Africa's Talking).
5. Dashboard analytics: funnel by region and class, time-to-verify, expiring licences, regional coverage gaps.

## Phase 5: Compliance, security and launch (about 1–2 weeks, overlaps Phases 3–4)

1. **Kenya Data Protection Act 2019**:
   - register as a data controller/processor with the ODPC
   - complete a DPIA (automated screening of applicants is high-risk processing)
   - check the cross-border transfer rules for the hosting region
2. Retention policy, with automated deletion for unsuccessful candidates after N months.
3. Human review guaranteed before any adverse decision, plus a contest/appeal workflow.
4. Security:
   - encryption at rest and in transit
   - backups with a tested restore
   - rate limiting and bot protection on the public form
   - dependency scanning
   - external penetration test before go-live
5. Accessibility audit (WCAG 2.2 AA) and testing on low-end Android devices over 3G.
6. Pilot in one region (for example Nairobi & South Eastern), then roll out nationally.

## Rough timeline

| Weeks | Work |
|-------|------|
| 0–0.5 | Phase 0 |
| 1–2 | Phase 1 |
| 3–4 | Phase 2 |
| 5–7 | Phase 3 |
| 8–9 | Phase 4 + Phase 5 |
| 10 | Pilot |

Assumes 1–2 developers. Phases 2 and 3 can run in parallel with two developers.

## Open questions for stakeholders

1. Who owns the scoring weights, and who must approve a rule change?
2. Are the scoring proxies acceptable? Text length (>20/25/50 chars) currently stands in for evidence quality, which is easy to game. Should the scores come from assessor ratings instead?
3. Do T1/T2/T3 classes map to different role requirements (for example, minimum class per project size)?
4. Retention period for unsuccessful and talent-pool candidates?
5. Is there any chance of an authorised EPRA data feed, or does verification stay manual?
6. Budget and preference for hosting region, WhatsApp provider and auth provider?
7. Expected application volume per month? This decides whether we need queueing and bulk-review tooling.
