# Solar Talent Registry — Waterlift Solar (production app)

Recruitment, EPRA licence verification and screening for solar PV technicians in Kenya.

**Stack:**
- React 19 + Next.js 16 (App Router, Cache Components) + TypeScript
- Tailwind CSS v4 + shadcn/ui + lucide-react
- PostgreSQL via Prisma 7 (`@prisma/adapter-pg`)
- Zod 4, react-hook-form, TanStack Table v8 and Vitest

**Hosting:** Vercel (app) + Supabase (Postgres, and Auth for staff).

## Setup with Supabase

1. **Create a Supabase project.** At supabase.com, sign in with the company Google account and create a project. Choose the region deliberately, because the Kenya DPA has rules on transfers abroad; record the region in the privacy notice.
2. **Fill in `web/.env`.** Copy `.env.example` to `.env`, then fill it in from Supabase → **Connect**:
   - `DATABASE_URL`: the **Transaction pooler** string (port 6543), ending in `?pgbouncer=true`.
   - `DIRECT_URL`: the **Session pooler** string (port 5432).
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`: from Project Settings → API. The service-role key is a secret. Never put it in a `NEXT_PUBLIC_` variable or share it in chat.
3. **Install and set up the database:**
   ```bash
   npm install          # also runs prisma generate
   npm run db:deploy    # create the tables
   npm run db:seed      # optional: FICTIONAL demo data
   npm run dev          # http://localhost:3000
   ```
4. **Vercel:** import the Git repository with **Root Directory = `web`**, and add the same environment variables. Set `NEXT_PUBLIC_SITE_URL` to the live domain so social share cards work.

## Deploying (Vercel CLI)

The app is live at https://waterlift-talent-registry.vercel.app.

```bash
cd web
npx vercel deploy --prod --yes      # build + deploy to production (fra1)
npx vercel env ls production        # check env vars
npm run db:deploy                   # apply new migrations to Supabase first, if any
```

`vercel.json` pins the Next.js preset and the Frankfurt region. `.vercelignore` keeps `.env*` and build output out of uploads.

## Email (Brevo) — Phase 4

1. In Brevo, verify a sender (Senders, domains & dedicated IPs). A domain such as `careers@yourdomain` with SPF and DKIM gives the best deliverability.
2. Create an API key (SMTP & API → API keys).
3. Add to `web/.env` and to Vercel (production): `BREVO_API_KEY`, `EMAIL_FROM_ADDRESS`, and optionally `EMAIL_FROM_NAME` and `EMAIL_REPLY_TO`. Redeploy.
4. For admin invite and password-reset emails, set Supabase → Authentication → Emails → SMTP to Brevo's SMTP relay (`smtp-relay.brevo.com:587`, with the Brevo SMTP login and key).

Until then, emails are logged as SKIPPED in `email_logs` (development prints them to the console). The daily job `/api/cron/daily` runs at 05:00 UTC and needs `CRON_SECRET`; status links need `STATUS_LINK_SECRET`.

## Advert links

Every social post links to the same form. The tag records where applicants came from:

| Platform | Link |
|---|---|
| Facebook | `https://<domain>/apply?src=facebook` |
| Instagram | `https://<domain>/apply?src=instagram` |
| LinkedIn | `https://<domain>/apply?src=linkedin` |
| X | `https://<domain>/apply?src=x` |
| TikTok | `https://<domain>/apply?src=tiktok` |
| WhatsApp | `https://<domain>/apply?src=whatsapp` |

Standard `utm_source`, `utm_medium` and `utm_campaign` parameters also work. Results appear on the dashboard under "Where applicants come from".

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run check` | Typecheck, lint and unit tests |
| `npm test` | Vitest unit tests (scoring rules, validation) |
| `npm run db:migrate` | Create and apply a migration after editing `prisma/schema.prisma` (uses `DIRECT_URL`). Then run `npm run db:generate`; Prisma 7 does not regenerate automatically. |
| `npm run db:deploy` | Apply committed migrations (CI / production) |
| `npm run db:seed` | Reload the fictional demo records (safe to re-run) |
| `npm run db:studio` | Browse the database |

## Layout

```
prisma/schema.prisma        Data model (tables mapped to snake_case for Windows/Linux portability)
prisma/seed.ts              Fictional demo data
src/app/page.tsx            Public landing page
src/app/apply/              Public 5-step application form, server action, social share card
src/app/privacy/            Candidate privacy notice (DRAFT — needs review)
src/lib/applications/       Saving + scoring a submission (one transaction)
src/lib/attribution.ts      Advert source tracking (?src= / utm_*)
src/app/(recruiter)/        Recruiter area: sidebar layout, dashboard, candidates
src/proxy.ts                Blocks recruiter routes in production until sign-in exists
src/components/ui/          shadcn components. Edit these directly; they are ours.
src/components/brand/       Theme-aware Waterlift logo
src/lib/scoring/            Pure, versioned screening rules + tests
src/lib/validation/         Zod application schema (shared by client and server) + tests
src/lib/data/               Server-only database reads
src/lib/reference/kenya.ts  Counties → recruitment regions
```

## Important

- **There is no sign-in yet.** In production, `src/proxy.ts` returns 503 for recruiter pages. Do not load real candidate data until authentication (Phase 3) is in place.
- **Scores are preliminary.** A recruiter reviews every outcome, and the UI must keep saying so.
