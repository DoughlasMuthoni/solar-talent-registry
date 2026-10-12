import type {
  EpraClass,
  InstallCategory,
  ScreeningStatus,
  SocialSource,
  Stage,
  Travel,
  VerificationStatus,
} from "@/generated/prisma/enums";

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

export const SCREENING_STATUS: Record<ScreeningStatus, { label: string; tone: Tone; hint: string }> = {
  PRIORITY_REVIEW: { label: "Priority review", tone: "success", hint: "Score 80–100 · priority human review and technical test" },
  STANDARD_REVIEW: { label: "Standard review", tone: "info", hint: "Score 65–79 · standard evidence review" },
  NEEDS_CLARIFICATION: { label: "Needs clarification", tone: "warning", hint: "Score 50–64 · request missing documents" },
  BELOW_THRESHOLD: { label: "Below threshold", tone: "danger", hint: "Score under 50 · human checks before any adverse action" },
  // Enum name predates tracks: it now means the track's credential gate (licence or qualification) failed.
  INELIGIBLE_LICENCE: { label: "Ineligible (credentials)", tone: "danger", hint: "Licence or qualification gate failed · confirm with the candidate first" },
};

export const STAGE: Record<Stage, string> = {
  NEW: "New application",
  TECHNICAL_ASSESSMENT: "Technical assessment",
  PRACTICAL_ASSESSMENT: "Practical assessment",
  REFERENCE_CHECKS: "Reference checks",
  APPROVED_POOL: "Approved pool",
  REJECTED: "Rejected after review",
  WITHDRAWN: "Withdrawn",
};

export const VERIFICATION: Record<VerificationStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending", tone: "warning" },
  VERIFIED: { label: "Verified", tone: "success" },
  NOT_FOUND: { label: "Not on register", tone: "danger" },
  MISMATCH: { label: "Mismatch", tone: "danger" },
  EXPIRED: { label: "Expired", tone: "danger" },
};

/** Wording for qualification checks (there is no register, so no "Expired"). */
export const QUALIFICATION_VERIFICATION: Record<Exclude<VerificationStatus, "EXPIRED">, string> = {
  PENDING: "Pending",
  VERIFIED: "Verified",
  NOT_FOUND: "Could not confirm",
  MISMATCH: "Details don’t match",
};

export const SOURCE: Record<SocialSource, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  LINKEDIN: "LinkedIn",
  X: "X (Twitter)",
  TIKTOK: "TikTok",
  WHATSAPP: "WhatsApp",
  YOUTUBE: "YouTube",
  DIRECT: "Direct / unknown",
  OTHER: "Other link",
};

export const EPRA_CLASS: Record<EpraClass, string> = { T1: "T1", T2: "T2", T3: "T3", NONE: "No licence" };

export const TRAVEL: Record<Travel, string> = { COUNTY: "Within county", REGION: "Across region", NATIONAL: "Nationwide" };

export const CATEGORY: Record<InstallCategory, string> = {
  RESIDENTIAL: "Residential",
  INSTITUTIONAL: "Institutional",
  COMMERCIAL_INDUSTRIAL: "Commercial / industrial",
  SOLAR_PUMPING: "Solar pumping",
  HYBRID: "Hybrid",
  GRID_TIED: "Grid-tied",
};
