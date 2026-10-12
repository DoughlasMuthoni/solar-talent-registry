/**
 * Version of the candidate privacy notice + consent wording. Stored on every ConsentRecord.
 * Bump it whenever /privacy or the consent checkbox text changes.
 * DRAFT — must be reviewed by Waterlift Solar's data protection lead before launch (Kenya DPA 2019).
 */
export const PRIVACY_NOTICE_VERSION = "2026-10-draft-3";

export const CONSENT_TEXT = {
  licenceVerification:
    "I consent to Waterlift Solar verifying my EPRA licence against the public register and my qualifications with the issuing institution or examining body.",
  recruitment:
    "I confirm the information is accurate and consent to Waterlift Solar processing it for recruitment, including qualification and project verification, contacting my referees, and automated preliminary screening that a person reviews.",
  talentPool: "Keep my details in Waterlift Solar's talent pool for future roles for up to 24 months (optional).",
} as const;
