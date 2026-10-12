import type { EpraClass, QualificationLevel, ScreeningStatus, Track, Travel } from "@/generated/prisma/enums";
import { QUALIFICATION_LEVEL, meetsLevel } from "@/lib/qualifications";

/**
 * Preliminary screening rules. Pure: no I/O, no Date.now() — pass `now` in.
 * Rules are data so admins can publish a new version (ScoringRuleSet) without a deploy;
 * every ScoreRun records the version it used.
 */

/** Award `points` when the text is longer than `minChars`, otherwise `fallback`. */
export type TextRule = { minChars: number; points: number; fallback: number };

export type ScoringRules = {
  version: number;
  experience: {
    pointsPerYear: number;
    yearsCap: number;
    pvKwpPerPoint: number;
    pvCap: number;
    pointsPerCategory: number;
    categoriesCap: number;
  };
  technical: {
    inverters: TextRule;
    batteries: TextRule;
    logger: TextRule;
    /** Only awarded when the candidate also claims high-voltage experience. */
    highVoltage: TextRule;
    certifications: TextRule;
  };
  verification: {
    referees: [TextRule, TextRule, TextRule];
    travel: Record<Travel, number>;
    largestProject: TextRule;
  };
  thresholds: { priority: number; standard: number; clarify: number };
  expiringWithinDays: number;
  /** Eligibility gate for the "Qualified solar technician" track. Missing in rule sets saved before tracks existed. */
  qualifiedTrack?: { minLevel: QualificationLevel };
};

/** Used when a stored rule set predates tracks: any formal qualification (trade test / artisan or above). */
export const DEFAULT_QUALIFIED_TRACK = { minLevel: "ARTISAN" } as const satisfies ScoringRules["qualifiedTrack"];

/** v1 — carried over unchanged from the stakeholder prototype. */
export const RULES_V1: ScoringRules = {
  version: 1,
  experience: { pointsPerYear: 2, yearsCap: 10, pvKwpPerPoint: 10, pvCap: 8, pointsPerCategory: 2, categoriesCap: 12 },
  technical: {
    inverters: { minChars: 20, points: 8, fallback: 3 },
    batteries: { minChars: 20, points: 8, fallback: 3 },
    logger: { minChars: 25, points: 8, fallback: 0 },
    highVoltage: { minChars: 25, points: 8, fallback: 0 },
    certifications: { minChars: 20, points: 8, fallback: 0 },
  },
  verification: {
    referees: [
      { minChars: 20, points: 8, fallback: 0 },
      { minChars: 20, points: 8, fallback: 0 },
      { minChars: 20, points: 4, fallback: 0 },
    ],
    travel: { NATIONAL: 5, REGION: 3, COUNTY: 1 },
    largestProject: { minChars: 50, points: 5, fallback: 2 },
  },
  thresholds: { priority: 80, standard: 65, clarify: 50 },
  expiringWithinDays: 90,
  qualifiedTrack: DEFAULT_QUALIFIED_TRACK,
};

export type ScoringInput = {
  track: Track;
  qualifications: { level: QualificationLevel }[];
  epraClass: EpraClass | null;
  licenceNumber: string | null;
  /** Calendar date, "YYYY-MM-DD". */
  licenceExpiresOn: string | null;
  licenceVerificationConsent: boolean;
  yearsExperience: number;
  largestPvKwp: number;
  categoryCount: number;
  inverters: string;
  batteries: string;
  loggerExperience: string | null;
  voltageExperience: string | null;
  highVoltage: boolean;
  certifications: string | null;
  referees: string[];
  travel: Travel;
  largestProject: string;
};

export type Section = "experience" | "technical" | "verification";
export type BreakdownItem = { section: Section; key: string; label: string; points: number; max: number };

export type ScoreResult = {
  rulesVersion: number;
  total: number;
  parts: Record<Section, number>;
  breakdown: BreakdownItem[];
  eligible: boolean;
  /** Which eligibility checks failed, in plain language, for the recruiter. */
  eligibilityIssues: string[];
  status: ScreeningStatus;
  daysToExpiry: number | null;
  expiring: boolean;
};

/** Whole calendar days from `now` (local date) to `isoDate`. Today = 0, yesterday = -1. */
export function daysUntil(isoDate: string | null, now: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate ?? "");
  if (!m) return null;
  const target = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}

const textLen = (v: string | null | undefined) => (v ?? "").trim().length;
const textPoints = (v: string | null | undefined, r: TextRule) => (textLen(v) > r.minChars ? r.points : r.fallback);
const positive = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export function scoreApplication(input: ScoringInput, rules: ScoringRules, now: Date): ScoreResult {
  const { experience: e, technical: t, verification: v } = rules;
  const breakdown: BreakdownItem[] = [];
  const add = (section: Section, key: string, label: string, points: number, max: number) =>
    breakdown.push({ section, key, label, points, max });

  add("experience", "years", "Years of experience", Math.min(positive(input.yearsExperience) * e.pointsPerYear, e.yearsCap), e.yearsCap);
  add("experience", "pv", "Largest PV array", Math.min(positive(input.largestPvKwp) / e.pvKwpPerPoint, e.pvCap), e.pvCap);
  add("experience", "categories", "Installation categories", Math.min(positive(input.categoryCount) * e.pointsPerCategory, e.categoriesCap), e.categoriesCap);

  add("technical", "inverters", "Inverter evidence", textPoints(input.inverters, t.inverters), t.inverters.points);
  add("technical", "batteries", "Battery evidence", textPoints(input.batteries, t.batteries), t.batteries.points);
  add("technical", "logger", "Logger / site audit", textPoints(input.loggerExperience, t.logger), t.logger.points);
  add("technical", "highVoltage", "High-voltage evidence", input.highVoltage ? textPoints(input.voltageExperience, t.highVoltage) : 0, t.highVoltage.points);
  add("technical", "certifications", "Certifications & safety", textPoints(input.certifications, t.certifications), t.certifications.points);

  v.referees.forEach((rule, i) => add("verification", `referee${i + 1}`, `Referee ${i + 1}`, textPoints(input.referees[i], rule), rule.points));
  add("verification", "travel", "Travel availability", v.travel[input.travel] ?? 0, Math.max(...Object.values(v.travel)));
  add("verification", "largestProject", "Largest project detail", textPoints(input.largestProject, v.largestProject), v.largestProject.points);

  const parts: Record<Section, number> = { experience: 0, technical: 0, verification: 0 };
  for (const b of breakdown) parts[b.section] += b.points;
  const total = Math.min(100, Math.round(parts.experience + parts.technical + parts.verification));

  const daysToExpiry = daysUntil(input.licenceExpiresOn, now);
  const eligibilityIssues: string[] = [];
  if (input.track === "QUALIFIED") {
    // Qualified track: a formal qualification at or above the minimum level replaces the licence gate.
    const { minLevel } = rules.qualifiedTrack ?? DEFAULT_QUALIFIED_TRACK;
    if (!input.qualifications.some((q) => meetsLevel(q.level, minLevel))) {
      eligibilityIssues.push(`No qualification at ${QUALIFICATION_LEVEL[minLevel].label} level or above`);
    }
    if (!input.licenceVerificationConsent) eligibilityIssues.push("No consent to verify qualifications");
  } else {
    if (!input.epraClass || input.epraClass === "NONE") eligibilityIssues.push("No EPRA solar PV licence class (T1–T3)");
    if (!input.licenceNumber?.trim()) eligibilityIssues.push("No licence number");
    if (daysToExpiry === null) eligibilityIssues.push("No valid licence expiry date");
    else if (daysToExpiry < 0) eligibilityIssues.push(`Licence expired ${-daysToExpiry} day${daysToExpiry === -1 ? "" : "s"} ago`);
    if (!input.licenceVerificationConsent) eligibilityIssues.push("No consent to verify the licence");
  }
  const eligible = eligibilityIssues.length === 0;

  const { priority, standard, clarify } = rules.thresholds;
  const status: ScreeningStatus = !eligible
    ? "INELIGIBLE_LICENCE"
    : total >= priority ? "PRIORITY_REVIEW"
    : total >= standard ? "STANDARD_REVIEW"
    : total >= clarify ? "NEEDS_CLARIFICATION"
    : "BELOW_THRESHOLD";

  return {
    rulesVersion: rules.version,
    total,
    parts,
    breakdown,
    eligible,
    eligibilityIssues,
    status,
    daysToExpiry,
    expiring: daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= rules.expiringWithinDays,
  };
}
