# Data Protection Impact Assessment: Solar Talent Registry

**Controller:** Waterlift Solar Limited · **Contact:** info@waterlift.co.ke
**System:** https://waterlift-talent-registry.vercel.app
**Status:** DRAFT prepared with the development team on 2026-10-08. It must be reviewed and signed off by Waterlift Solar's data protection lead before candidates are recruited at scale.
**Law:** Kenya Data Protection Act, 2019 (DPA), and the Data Protection (General) Regulations, 2021.

## 1. Why a DPIA is needed

The system processes job applicants' personal data and uses **automated preliminary scoring** to sort applications. Automated evaluation of people in a recruitment context is likely to be "high risk" under s.31 of the DPA, so we assess it before launch.

## 2. Description of the processing

| Item | Detail |
|---|---|
| Purpose | Recruit licensed solar PV technicians across Kenya: collect applications, verify EPRA licences, assess experience, contact referees, and track candidates through assessment. |
| Data subjects | Applicants (solar technicians); their referees (name, role, contact as supplied by the applicant); Waterlift admin staff. |
| Personal data | Name, phone, email, town/county; EPRA licence class, number and expiry; work history and equipment experience; training/certificates; referee details; optional uploaded documents (licence copy, certificates); advert source (e.g. "facebook"); consent records; status history. **No** national ID numbers, financial or health data are requested. |
| Sources | Directly from the applicant via the public form. The EPRA public register is checked manually by an admin. |
| Recipients | Waterlift admins only (single Admin role, email + password sign-in, public sign-up disabled). Processors: Vercel (app hosting), Supabase (database, auth, file storage), Brevo (transactional email). |
| Location | Database and files: Supabase, **EU, Frankfurt (eu-central-1)**. App functions: Vercel `fra1` (Frankfurt). Email: Brevo (EU). |
| Retention | Closed (rejected/withdrawn) applications are **automatically erased 12 months after closing**; with talent-pool consent, after **24 months**. Open and approved-pool records are kept while relevant. See `web/src/lib/retention.ts`. |

## 3. Lawful basis and consent

- **Consent (s.30(1)(a))**, recorded per candidate with the version of the notice they saw (`consent_records`, currently `PRIVACY_NOTICE_VERSION = 2026-10-draft-2`):
  - recruitment processing (required)
  - licence verification (required)
  - talent pool (optional)
- A privacy notice (`/privacy`) is shown before submission.
- Referees' data is provided by the applicant. Contact referees only for the stated purpose, and tell them where their details came from.

## 4. Necessity and proportionality

- **Data minimisation:** only fields needed to assess technical suitability are collected. No ID numbers, date of birth, gender, photos of people, or other sensitive data.
- **Automated decisions:** the score is **preliminary and explainable** (a per-rule breakdown is shown to admins). **No decision is made automatically.**
  - A person reviews every application.
  - Rejections require a written reason, recorded in the history.
  - Candidates are told this in the notice and on the form, and can ask for an explanation or reconsideration.
- **Candidates never see internal scores or screening labels.** The status page shows plain-language progress only.

## 5. Data subject rights: how they are met

| Right | Mechanism |
|---|---|
| Information | `/privacy` notice; consent wording on the form; confirmation email. |
| Access / status | Private, signed status link (30 days) by email via `/status`. |
| Withdraw consent / application | "Withdraw my application" on the status page; recorded as a candidate-made stage change. |
| Erasure | "Request deletion of my data" on the status page flags the record. An admin uses **Erase candidate data**, which deletes everything (files, emails, notes, scores) and leaves only a PII-free log entry. Retention erasure runs daily. |
| Rectification | By email to info@waterlift.co.ke. An admin updates the record. (Self-service correction is a future improvement.) |
| Object / complain | By email; the ODPC complaint route is stated in the notice. |

**Response time:** handle erasure and access requests within the statutory period. Check the "Data deletion requested" badge daily.

## 6. Risks and mitigations

| Risk | Likelihood / impact | Mitigations in place |
|---|---|---|
| Unauthorised access to candidate data | Medium / High | Supabase Data API **disabled**. RLS on every table. Public roles revoked. App connects server-side only. Every admin page, read, action and export checks `requireAdmin()`. Public sign-up off. Admin access to documents uses 60-second signed links, and every view is audited. |
| Leaked secrets | Low / High | Secrets are only in Vercel env (marked sensitive) and the local `.env` (gitignored). A dedicated, revocable Supabase key for the server. The Brevo key expires 2027-10-08. |
| Malicious uploads | Medium / Medium | Type and size limits (PDF/JPG/PNG/WebP, ≤5 MB, ≤6 files). The real file signature is checked server-side; mismatches are deleted. Private bucket. Abandoned uploads are deleted after 24 h. **No antivirus scan yet**; admins should treat files with care. |
| Spam / bulk fake applications | Medium / Low | Honeypot field, per-IP rate limits (application 30/h, status link 10/h, upload 60/h; IPs stored only as keyed hashes), idempotent submissions. |
| Unfair automated screening | Medium / Medium | Human review of every application. Transparent, versioned rules. Text length is labelled as only a proxy. Reasons required for rejections. |
| Cross-border transfer (EU hosting) | — | EU (GDPR) jurisdiction chosen deliberately. **Action:** record the transfer safeguard as required by DPA Part VI, using the providers' DPAs/SCCs. |
| Over-retention | Medium / Medium | Automatic 12/24-month erasure; bounded daily job. |
| Account compromise of an admin | Low / High | Strong passwords (min 12). **Recommended:** enable MFA in Supabase Auth for admins before scaling. |
| Email deliverability / misdirected email | Low / Medium | Emails go only to the address on the application. Status links are signed and expire. waterlift.co.ke is authenticated in Brevo (DKIM and DMARC). |

## 7. Actions before full launch

1. Data protection lead reviews this DPIA and the `/privacy` text, then removes the "draft" label and bumps the notice version.
2. Register with the ODPC as a data controller, if not already registered.
3. Sign or accept data processing agreements with Vercel, Supabase and Brevo, and record the cross-border transfer safeguards.
4. ~~Add the Brevo DNS records for waterlift.co.ke~~. Done 2026-10-08; the domain is authenticated (DKIM + DMARC). DMARC aggregate reports now go to Brevo (`rua`); policy unchanged (`p=none`).
5. Enable MFA for admin accounts.
6. Decide on antivirus scanning for uploaded documents (or keep "view with care").
7. Brief admins: review every application, write rejection reasons, action deletion requests promptly.

## 8. Sign-off

| Role | Name | Date | Decision |
|---|---|---|---|
| Data protection lead | | | |
| Management | | | |
