# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**Solar Talent Registry** for **Waterlift Solar** ("Equitable access to solar energy and borehole drilling"). It is a recruitment, EPRA-licence-verification and screening tool for solar PV technicians in Kenya.

- **`web/` is the product**, a production Next.js app. **Read `web/AGENTS.md` and `web/README.md` before working there.**
- **`solar-recruitment-app/` is the HTML prototype.** It is **only a reference** for workflow, fields, scoring rules and copy. Don't port its markup, and don't invest further in it unless asked.

See `DEVELOPMENT_PLAN.md` for phases.

## Production app (`web/`)

- **Stack:**
  - React 19 + **Next.js 16.4** (App Router, **Cache Components on**, Turbopack) + TypeScript
  - **Tailwind CSS v4** + **shadcn/ui** (Radix, "nova" preset) + **lucide-react**
  - **PostgreSQL via Prisma 7.10** (`@prisma/adapter-pg`). Production: **Vercel + Supabase** (Supabase Auth for staff).
  - Zod 4, react-hook-form, TanStack Table **v8** (shadcn's data-table pattern; v9 changed the API), Sonner, next-themes, Vitest
- **Next.js 16 differs from older versions.** Check `web/node_modules/next/dist/docs/` before using an API:
  - `middleware` is now `src/proxy.ts`.
  - `params`, `searchParams`, `cookies()` and `headers()` are async.
  - With Cache Components, every database read must call `await connection()` (see `src/lib/data/`) and render inside `<Suspense>`. Alternatively use `"use cache"` + `cacheLife` for data that is safe to share.
- **Prisma 7:**
  - The config lives in `web/prisma.config.ts`, not the schema.
  - The client is generated to `src/generated/prisma` (gitignored; created by `postinstall`). Import it from `@/generated/prisma/client`, or `/enums` for browser-safe enums.
  - `migrate dev` does **not** regenerate the client; run `npm run db:generate` after schema changes.
  - Prisma blocks destructive commands from AI agents unless the user consents. Always ask.
- **Decisions (2026-10-07):**
  - Hosting is Vercel + Supabase Postgres. The user will create both accounts themselves with their Google profile.
  - Staff sign in with **Supabase Auth, email only** (no Google or Microsoft).
  - There is **one role: Admin**.
  - Candidates arrive from **social-media ad links** to `/apply`; see Attribution below.
- **Live deployment (2026-10-07):**
  - **App:** https://careers.waterlift.co.ke (CNAME in cPanel → Vercel; also waterlift-talent-registry.vercel.app). Vercel project `waterlift-talent-registry`, deployed with the Vercel CLI from `web/` (`npx vercel deploy --prod --yes`), functions in `fra1`.
  - **Admin 2FA (TOTP) is mandatory:** `requireAdmin()` redirects to `/account/security` (enrol) or `/login/mfa` (code) until the session is aal2. Only those two pages use `requireAdminForMfaSetup()`. Lost phone → delete the factor in Supabase → Authentication → Users.
  - **Database:** Supabase project in the WATERLIFT SOLAR LIMITED org (Frankfurt).
  - **Supabase settings:**
    - Data API is **off**, RLS is on, and anon/authenticated have no grants. Keep it that way: the app never uses supabase-js for data.
    - Public sign-up is off; admins are invite-only.
    - Site URL is the live address; the redirect allow-list has the live address and `localhost:3000`.
  - **Migrations against production:** `npm run db:deploy` (uses `DIRECT_URL`). Don't seed demo data into production.
- **Database:**
  - `DATABASE_URL` is the runtime connection (Supabase transaction pooler, port 6543). `DIRECT_URL` is for migrations (port 5432). `SHADOW_DATABASE_URL` is only for local Postgres.
  - See `web/.env.example`.
  - Every model has `@@map("snake_case_plural")`.
  - Until the Supabase dev project exists, local dev runs on a **PGlite** server (Postgres compiled to WebAssembly) on 127.0.0.1:54330 (shadow on 54331), started from the session scratchpad.
  - Prisma's migration engine can't talk to PGlite. Generate migration SQL with `prisma migrate diff --from-empty|--from-migrations … --to-schema prisma/schema.prisma --script` and apply it with a pg client.
  - On Supabase, use the normal `npm run db:migrate` / `db:deploy`.
- **Old local MySQL:** no longer used. The development machine's MySQL server also hosts **other unrelated databases**: never touch them, and never grant global privileges.
- **Candidate applications (Phase 2):**
  - **Form:** `/apply` → `src/app/apply/application-form.tsx`. It is a 5-step react-hook-form with per-step Zod validation via `APPLICATION_STEPS[i].schema`.
  - **Cross-field rules** live on the step schemas too, because Zod skips object refinements while any field in the object is invalid.
  - **Draft autosave:** answers are saved in localStorage on the candidate's own device. Consents are never restored from a draft.
  - **Submission:** the server action `src/app/apply/actions.ts` is public, so it re-validates everything, has a honeypot field and returns only `{reference}`.
  - **Saving:** `src/lib/applications/create.ts` writes the candidate, licence, consents (with `PRIVACY_NOTICE_VERSION`), the application, its score run and an audit event in one transaction. It is idempotent on `submissionKey`.
  - **Repeat applicants:** a repeat email **never overwrites** the stored candidate. Contact differences go into the audit metadata instead.
  - **Field errors** are cleared the moment the person edits the field. Otherwise the error only clears on blur, the layout shifts, and the tap on "Continue" misses the button.
- **Two tracks (2026-10-08):** `Application.track` is `EPRA_LICENSED` or `QUALIFIED` ("Qualified solar technician": certificate/diploma/degree/NITA trade test, no EPRA licence).
  - Qualifications (`qualifications` table, up to 3 per application) can be listed on either track. Admins check each one with the institution or examining body (`verifyQualification`, note required).
  - Scoring is shared, and only the eligibility gate differs: EPRA track = valid licence, qualified track = a qualification at `rules.qualifiedTrack.minLevel` or above (default Artisan; rule sets saved before tracks fall back to `DEFAULT_QUALIFIED_TRACK`). Failing either gate gives `INELIGIBLE_LICENCE`, labelled "Ineligible (credentials)".
  - Level ranks and labels live in `src/lib/qualifications.ts`. `?track=qualified` on an advert link preselects the track. Qualified references look like `KIS-Q-0034`.
  - `epraClass` is optional in the form schema and required only on the EPRA track, because the field is hidden on the qualified track.
- **Attribution:**
  - Share links take the form `/apply?src=facebook` or `?utm_source=fb&utm_campaign=…`.
  - `src/lib/attribution.ts` normalises them into the `SocialSource` enum, and the server re-derives the source.
  - The dashboard shows "Where applicants come from".
  - `src/app/apply/opengraph-image.tsx` is the social share card.
- **Phase 4 (messaging):**
  - All email goes through `sendEmail()` (`src/lib/email/send.ts`, Brevo API). Templates in `templates.ts` are pure and escape every value.
  - Use a `dedupeKey` for anything scheduled.
  - Candidate emails go out via `after()`.
  - Status links are HMAC tokens (`STATUS_LINK_SECRET`). Never show candidates internal scores or screening labels.
  - The daily job is `src/app/api/cron/daily` (Vercel Cron, `CRON_SECRET`).
  - Long transactions over a slow link need explicit `{ maxWait, timeout }`.
- **Phase 5 (security, retention, documents):**
  - **Headers:** security headers and a static CSP in `next.config.ts`. `connect-src` allows only self and Supabase; adding another browser-side host needs a CSP change.
  - **Rate limits:** `rateLimit()` (`src/lib/rate-limit.ts`, Postgres `rate_limits`, hashed IPs, fails open).
  - **Retention:** `shouldErase()` (12/24 months) runs in the daily cron, and `eraseCandidate()` handles admin and retention erasure. Erasure leaves only a PII-free audit entry.
  - **Documents:** the private bucket `candidate-documents` is reached server-side with `@supabase/storage-js` (`src/lib/storage.ts`), **not** full supabase-js, whose realtime module needs Node 22.
  - **Upload flow:** signed upload URL → browser uploads → `finalizeUploads()` re-checks the file signature on submit. Admin views go through `/candidates/[id]/documents/[docId]` (60-second signed URL, audited).
  - **Keys:** `SUPABASE_SERVICE_ROLE_KEY` is a dedicated, revocable Supabase secret key for Vercel. It is server-only and must never get a `NEXT_PUBLIC_` prefix.
  - **Compliance docs:** `docs/DPIA.md` and `docs/LAUNCH_CHECKLIST.md`.
- **Admin tools (2026-10-08):**
  - **`/assessments`:** technical and practical assessments. Schedule and record results from the candidate page. Scheduling moves the stage forward only and can email an invitation (`ASSESSMENT_INVITE`). Times are entered and shown in Nairobi time (`src/lib/nairobi-time.ts`, UTC+3, formatted from parts for ICU stability).
  - **`/messages`:** messages to a filtered group (max 100 per send, because Brevo's free plan allows 300 a day) or to one candidate. Templates are in `src/lib/message-templates.ts`, with `{{name}}` and `{{reference}}` placeholders. Admin messages store the text and sender in `email_logs`. The page also has the full email log.
  - **`/scoring-rules`:** an editor validated by `scoringRulesSchema`. Preview is a dry run over open applications. Publishing creates the next `ScoringRuleSet` version and can optionally re-score everything through `rescoreWith()`; old ScoreRuns keep their version.
  - **When adding an admin route,** also add it to the `proxy.ts` matcher, so expired sessions refresh there.
- **Privacy:** `/privacy` is a **draft** notice with `[bracketed]` placeholders, pending review by Waterlift's data protection lead. Bump `PRIVACY_NOTICE_VERSION` in `src/lib/privacy.ts` whenever that text or the consent wording changes.
- **Domain code is pure and tested:**
  - `src/lib/scoring/rules.ts`: versioned `ScoringRules`, with `scoreApplication(input, rules, now)` returning a per-rule breakdown plus plain-language eligibility issues.
  - `src/lib/validation/application.ts`: Zod schema per form step, shared by client and server.
  - `src/lib/reference/kenya.ts`: counties and regions.
  - Keep these files free of I/O.
- **Admin authentication (Phase 3):**
  - `src/lib/auth/session.ts` → `requireAdmin()`. **Every admin page, data function (`src/lib/data/*`), route handler and server action calls it.** This is the security boundary.
  - Admin means a verified Supabase session (`getUser()`, never `getSession()`) **plus** an active `users` row with the same id and role `ADMIN`.
  - `src/proxy.ts` only refreshes the Supabase cookie and redirects signed-out visitors. In production without Supabase env vars, it returns 503.
  - **Without Supabase env vars in development only,** `requireAdmin()` falls back to the seeded demo admin. The sidebar shows a "Development admin" warning when this happens.
  - **Invite admins** with `npm run admin:invite -- email "Name"` (service-role key). Email links land on `/auth/confirm` → `/account/password`.
  - `safeNext()` blocks open redirects through `?next=`.
- **Admin workspace:**
  - `/candidates/[id]` shows the score breakdown, licence verification (an evidence note is required), pipeline stage (a reason is required for Rejected/Withdrawn), notes, re-score and history.
  - Actions live in `candidates/[id]/actions.ts`. Each one validates with Zod, writes an `AuditEvent` and calls `refresh()`.
  - `/candidates/export` produces an audited CSV through `src/lib/csv.ts`, which neutralises spreadsheet formulas.
  - Client components that read the URL (`usePathname`) must sit inside `<Suspense>` under Cache Components; see `app-sidebar.tsx`.
- **UI conventions:**
  - Use the `brand` button variant (orange) for at most one main CTA per screen.
  - Status pills are `ToneBadge` with labels from `src/lib/labels.ts`.
  - Logo: `<Logo variant="full|wordmark|mark" />`.
  - shadcn components live in `src/components/ui/`; edit them there rather than wrapping them.
  - shadcn now uses the `cn` package (from shadcn-ui) in place of `clsx`/`tailwind-merge`.

## Brand and colour (sampled from the original Waterlift Solar logo PNG)

| Role | Hex | Notes |
|---|---|---|
| Brand navy | `#2E2A65` | "WATER" wordmark. Light-mode `--primary`. 12.8:1 on white. |
| Brand orange | `#EF7F22` | "SOLAR" + lightning bolt. Highlight/CTA fill only, with navy text `#1F1D4A` on it (5.8:1). **Never use as text on white (2.7:1).** For orange text use `#B4560C` (4.9:1). |
| Brand sky blue | `#2CACE1` | Water drop, "LIFT", waves. Focus ring, info, charts. **Never use as text on white (2.6:1).** For links/info text use `#0B6E9E` (5.6:1). |

Design tokens (shadcn variable names). Define them once in `globals.css` for light, plus `.dark`:

```
light: --background #F7F8FC  --foreground #1B1940  --card #FFFFFF
       --primary #2E2A65 / --primary-foreground #FFFFFF
       --secondary #E3F4FB / --secondary-foreground #0B6E9E
       --muted #EEF0F7 / --muted-foreground #5B5F7A   --border #DDE0EC   --ring #0B6E9E (sky #2CACE1 is only 2.6:1 on white — fails the 3:1 focus-indicator minimum)
       --brand-orange #EF7F22 / --brand-orange-foreground #1F1D4A   --brand-orange-text #B4560C
       --chart-1 #2E2A65 --chart-2 #2CACE1 --chart-3 #EF7F22 --chart-4 #7A76B8 --chart-5 #8FD3F0
dark:  --background #12112B  --foreground #EDEEF7  --card #1B1A3D
       --primary #2CACE1 / --primary-foreground #12112B
       --brand-orange #F59A4A / --brand-orange-foreground #12112B
       --muted-foreground #A9A6D9   --border rgba(237,238,247,.12)   --ring #2CACE1
```

Rules:
- Navy is for primary actions, the sidebar's active state and headings. Orange is used sparingly: the single main CTA per screen ("Apply now", "Submit application"), the active form step and highlights. Sky blue is for focus, links, info and data.
- Keep shadcn's own `--accent` a subtle neutral tint (it drives hover states). Brand orange lives in the separate `--brand-orange` token.
- Status colours must stay distinct from brand orange: success green (`#276B2B` light — `#2E7D32` fails on its tint), warning **amber/yellow** (not orange), danger red. The values actually in use are in the prototype `:root` tokens.
- Logo files are in `assets/brand/`. They are SVGs with transparent backgrounds, and all text has been converted to outlines, so they don't depend on any installed font. Use them in place of the PNGs.

  | File | Use |
  |---|---|
  | `waterlift-logo.svg` / `-dark.svg` | Full logo with tagline and waves: login, landing page, emails, PDFs. Minimum width about 320px, below which the tagline becomes unreadable. |
  | `waterlift-wordmark.svg` / `-dark.svg` | "WATERLIFT SOLAR" only: sidebar, header, anything under 320px. |
  | `waterlift-mark.svg` | The drop with the "A" (square): favicon, app icon, collapsed sidebar. The same file works on both themes. |

  - The `-dark` variants turn the navy "WATER" and tagline white. Switch on the app theme (`next-themes`) rather than `prefers-color-scheme`, so the theme toggle is respected.
  - These are a **recreation** of the original PNG, drawn in Montserrat Black / ExtraBold Italic (OFL font, outlines only). The client should approve them before production use. They use the original brand colours (`#2E2A65`, `#2CACE1`, `#EF7F22`), not the brighter colours in the AI-generated images.
  - To regenerate, run `assets/brand/make_logo.py <fonts_dir> <out_dir>`. It needs `fonttools` and `uharfbuzz`, plus `Montserrat[wght].ttf` and `Montserrat-Italic[wght].ttf` from google/fonts.
  - `logo-preview.png` shows every variant on light and dark backgrounds.

## Layout

```
Rectuiter/
├── CLAUDE.md
├── DEVELOPMENT_PLAN.md
├── assets/brand/                       # SVG logos (light/dark, wordmark, mark) + generator — USE THESE
├── Waterlift Solar Logo with Waves.png # Raster with artifacts — do not use
├── ChatGPT Image … PM-{1,2,3}.png      # AI-redrawn logo on solid black/charcoal/navy — social/banner only
└── solar-recruitment-app/
    ├── README.md                       # Feature list + production recommendations
    ├── solar-talent-registry.html      # The prototype — the only app file
    └── tests/scoring.test.mjs          # Scoring rule tests (node:test)
```

Git repository: public on GitHub (DoughlasMuthoni/solar-talent-registry), branch `main`. The repo is public, so never commit secrets, account names or server details. The local `master` branch keeps the pre-publication history and is not pushed. No package manager, build step or linter.

## Running and testing

- **Run:** open `solar-recruitment-app/solar-talent-registry.html` in a modern browser. It needs internet for two CDN assets:
  - Satoshi font — `api.fontshare.com`
  - Lucide icons — `unpkg.com/lucide@0.468.0` (UMD, global `lucide`). Call `iconRefresh()` after injecting any `<i data-lucide>` markup.
- **Test:** `node --test solar-recruitment-app/tests` (Node 20+, no install). The test reads the `<script id="scoring">` block out of the HTML and runs it in `vm`, so that block must stay **pure**: no DOM access and no references to the app script.
- Data lives in memory (`candidates`) unless the recruiter turns on "Save records in this browser" (Privacy & controls). That stores records in `localStorage` (`wls.str.candidates.v1`); preferences, including the theme, are under `wls.str.prefs.v1`.

## Prototype architecture (single HTML file)

- **CSS** (one minified `<style>` block): design tokens on `:root` / `[data-theme="dark"]`, using the Waterlift brand palette (see Brand and colour). Prototype token names: `--primary`, `--accent` (brand orange, CTA only), `--accent-on`, `--ring`, `--logo-ink`, `--danger-on`, `--surface-*`, `--s1..s12` spacing, `--text-*` fluid type. Breakpoints at 1050px and 760px. Respects `prefers-reduced-motion`. `[hidden]{display:none!important}` is required because `.btn` sets `display`.
- **Logo**: the sidebar inlines `assets/brand/waterlift-wordmark.svg`, with the navy paths given `class="ink"` and filled from `--logo-ink`, so one SVG serves both themes. The favicon is `waterlift-mark.svg` as a data URI. If the brand files change, regenerate both.
- **Views**: `<section class="view" id="…">` for `dashboard`, `candidates`, `application`, `automation`, `privacy`; switched by `goView(id)`. Buttons use `data-view` (sidebar) or `data-go` (anywhere).
- **JS**, two inline scripts, no framework:
  1. `<script id="scoring">` — pure: `STATUS`, `num()`, `daysTo(date, now)`, `scoreCandidate(c, now)` → `{score, parts, status, eligible, expiring}`. Scores are **recomputed on every render and never stored**.
  2. App script. Helpers `$` / `$$` wrap `querySelector` / `querySelectorAll`. Key functions:
     - `sanitize(r)` / `sanitizeAll(list)` normalise any record (form, import, localStorage) to the record shape. **Every record entering `candidates` goes through `sanitize`.**
     - `makeId`, `nextSeq` and `assignIds(list, existing)` keep IDs unique; duplicates are renumbered.
     - `esc()`: **every value interpolated into `innerHTML` must go through it.**
     - `csvCell()` quotes cells and prefixes `= + - @ 	 
` with `'` to block formula injection. The side effect is that phone numbers export as `'+254…`.
     - Rendering and drawer: `renderCandidates()` (also calls `updateStats()`), `openCandidate(id)` / `closeDrawer()`.
     - Focus and dialogs: `trapFocus()`, `openModal` / `closeModal` (import dialog), and a global `keydown` handler for Escape and Tab.
     - Storage: `save()` writes to `localStorage` only when `prefs.persist`; `store.*` wraps `localStorage` in try/catch.
     - Form and demo data: `formObject()`, `updateStep()`, `validStep()`, `demo()`.
- **Reference data**: `counties` (all 47) and `regionMap` (7 recruitment regions → counties). `regionOf(county)` derives `region`. `STAGES`, `CLASSES` and `TRAVEL` are the allowed enum values.

### Candidate record shape

`id` (`<COUNTY3>-<CLASS>-<NNNN>`, letters only from the county), `fullName, phone, email, town, county, region, travel (county|region|national)`, `epraClass (T1|T2|T3|None), licenceNumber, expiry (YYYY-MM-DD), engagement, licenceIssue, verifyConsent`, `years, largestPv (kWp), largestInv (kW), largestBattery (kWh)` (numbers ≥0), `categories[], largestProject`, `inverters, batteries, logger, voltage, certifications, energyAuditor (yes|no), highVoltage (yes|no)`, `ref1, ref2, ref3, privacyConsent`, recruiter fields `verified, stage (STAGES), created`, and `demo` for fictional records. Booleans must be exactly `true`.

### Scoring rules (keep `tests/scoring.test.mjs` and the `#automation` view copy in sync if you change these)

- **Eligibility gate (pass/fail):** EPRA class T1–T3, non-blank licence number, expiry today or later (calendar-day comparison via `daysTo`), verification consent given. Failing it gives **`Ineligible (licence)`** regardless of score.
- **Experience (max 30):** years×2 (≤10), largestPv/10 (≤8), categories×2 (≤12).
- **Technical (max 40):** inverters and batteries 8 each if >20 chars, else 3; logger 8 if >25 chars; high-voltage 8 if `yes` and voltage text >25 chars; certifications 8 if >20 chars.
- **Verification/mobility (max 30):** ref1 and ref2 8 each, ref3 4 (if >20 chars); travel national 5 / region 3 / county 1; largestProject 5 if >50 chars, else 2.
- **Routing:** ≥80 Priority review · 65–79 Standard review · 50–64 Needs clarification · <50 **Below threshold**.
- `expiring` = licence expires in 0–90 days.

## Conventions and constraints

- Keep the prototype a **single self-contained file** that opens from disk. No build tools, no new CDN dependencies without good reason.
- Match the existing style: compact/minified CSS and JS, CSS custom properties for every colour and spacing value, and fully support both light and dark themes.
- Accessibility: 44px min touch targets, labelled inputs, `:focus-visible`, `aria-live` toast. Keep these.
- The UI must keep saying that scoring is **preliminary** and that **human review** is required before any adverse decision. This is a product and legal requirement, not just copy.
- Never add real personal data to demo records. Demo data must stay obviously fictional (`example.test` emails, `DEMO/` licence numbers, "not a real person" referees).
- Domain terms: **EPRA** = Energy and Petroleum Regulatory Authority (Kenya). Solar PV technician licence classes are **T1 / T2 / T3** (T3 is the highest). Applicants are verified manually against EPRA's public register; there is no API.
- Privacy context: Kenya **Data Protection Act 2019** / ODPC. The prototype must not be used for live personal data.

## Known limitations (as of 2026-10-07)

- Phase 0 is complete; see `DEVELOPMENT_PLAN.md`. The prototype is still in-memory or `localStorage` only, with no auth, uploads or audit trail. That is by design until Phase 1.
- Scoring uses text length as a proxy for evidence quality, which is easy to game (open stakeholder question).
