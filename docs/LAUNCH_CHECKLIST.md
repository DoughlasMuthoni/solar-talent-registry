# Launch checklist: Solar Talent Registry

Live: https://careers.waterlift.co.ke · Updated 2026-10-08

## Done ✅

- **App:** 5-step mobile application form, candidate status/withdraw/deletion requests, admin workspace, CSV export.
- **Document uploads:** private bucket `candidate-documents` (5 MB; PDF/JPG/PNG/WebP), live and tested end to end. A disguised executable was rejected, and erasure removes stored files.
- **Hosting:**
  - Vercel `fra1` + Supabase Frankfurt.
  - Daily cron at 05:00 UTC, protected by `CRON_SECRET`. It sends licence reminders and the admin summary, runs retention erasure, and does housekeeping.
- **Security:**
  - Supabase Data API off, RLS on all tables, and public roles revoked.
  - `requireAdmin()` everywhere admin data is touched, and public sign-up off.
  - Security headers: CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy and Permissions-Policy.
  - Rate limits on public endpoints, honeypot, signed status links, and audited exports and document views.
- **Email:** Brevo is sending from info@waterlift.co.ke (sender verified). Every send is logged and de-duplicated in `email_logs`.
- **Privacy:**
  - Versioned consents, `/privacy` notice (contact, region and retention filled in), and a 12/24-month automatic erasure.
  - Admin "Erase candidate data", and the DPIA draft (`docs/DPIA.md`).
- **Tests:**
  - 100+ unit tests.
  - Browser end-to-end tests for the candidate flow (desktop and phone), the admin flow, and Phase 4 status/withdraw/cron.
  - Live-site smoke test.

## Before advertising widely

- [x] **DNS for email (2026-10-08):** Brevo code TXT, `brevo1/brevo2._domainkey` CNAMEs added in cPanel, and DMARC extended with `rua=mailto:rua@dmarc.brevo.com` (policy still `p=none`). waterlift.co.ke is **authenticated** in Brevo.
- [ ] **Privacy sign-off:** data protection lead approves `/privacy` and `docs/DPIA.md`; remove the "draft" wording and bump `PRIVACY_NOTICE_VERSION`.
- [ ] **ODPC:** confirm registration as a data controller.
- [ ] **Processor agreements:** Vercel, Supabase and Brevo DPAs accepted; transfer safeguards recorded.
- [x] **Admin MFA:** authenticator-app codes required for every admin (built in; enrol on first sign-in).
- [ ] **Admin invites through Brevo SMTP:** configure Supabase Auth SMTP (Brevo → SMTP & API → SMTP key; host smtp-relay.brevo.com:587, login shown on that Brevo page) so invite and reset emails reach any address.
- [x] **Custom domain:** `careers.waterlift.co.ke` → Vercel; `NEXT_PUBLIC_SITE_URL` and the Supabase Site URL updated.
- [ ] **Scoring weights:** stakeholders confirm the v1 rules (or publish v2).
- [ ] **Pilot:** run one region first (e.g. Nairobi & South Eastern) and review a week of applications before going national.

## Ongoing operations

| When | What |
|---|---|
| Daily | Check the 08:00 summary email. Verify new licences on the EPRA register. Action any **"Data deletion requested"** badge. |
| Weekly | Review stuck applications; export CSV only when needed (exports are audited). |
| Before 2027-10-08 | **Renew the Brevo API key** (`waterlift-talent-registry (Vercel)`) and update `BREVO_API_KEY` in Vercel. |
| If a key leaks | Supabase: create a new secret key, update `SUPABASE_SERVICE_ROLE_KEY`, delete the old one. Brevo: generate a new key, delete the old. Redeploy. |
| Schema changes | `npm run db:deploy` (uses `DIRECT_URL`) **before** `npx vercel deploy --prod --yes`. |

## Known limitations / accepted risks

- **No antivirus scan of uploads.** File signatures are checked, but admins should open documents with care.
- **Dependency audit:** 4 "high" advisories, all in the Prisma CLI's tooling (`mysql2`, `deepmerge-ts`). They're not part of the running app; npm's suggested fix is a breaking downgrade. Re-check after Prisma updates.
- **WhatsApp/SMS** notifications are not built yet; they need a WhatsApp Business / Africa's Talking account.
- **Candidates can't edit a submitted application** themselves; corrections go by email to info@waterlift.co.ke.
