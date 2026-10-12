import "server-only";
import type { ScreeningStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { scoringInclude, toScoringInput } from "./from-application";
import { scoreApplication, type ScoringRules } from "./rules";

export const OPEN_STAGES_FILTER = { stage: { notIn: ["REJECTED", "WITHDRAWN"] as ("REJECTED" | "WITHDRAWN")[] } };

export async function loadOpenForScoring() {
  return db.application.findMany({ where: OPEN_STAGES_FILTER, include: scoringInclude });
}

export function statusCounts(statuses: ScreeningStatus[]) {
  const counts: Record<ScreeningStatus, number> = { PRIORITY_REVIEW: 0, STANDARD_REVIEW: 0, NEEDS_CLARIFICATION: 0, BELOW_THRESHOLD: 0, INELIGIBLE_LICENCE: 0 };
  for (const s of statuses) counts[s]++;
  return counts;
}

/** Writes a new ScoreRun per application with the given rule set (history is kept; nothing is overwritten). */
export async function rescoreWith(ruleSet: { id: string; rules: ScoringRules }, applicationIds?: string[]) {
  const apps = applicationIds
    ? await db.application.findMany({ where: { id: { in: applicationIds } }, include: scoringInclude })
    : await loadOpenForScoring();
  const now = new Date();
  const rows = apps.map((a) => {
    const r = scoreApplication(toScoringInput(a), ruleSet.rules, now);
    return {
      applicationId: a.id,
      ruleSetId: ruleSet.id,
      experience: r.parts.experience,
      technical: r.parts.technical,
      verification: r.parts.verification,
      total: r.total,
      eligible: r.eligible,
      status: r.status,
      breakdown: { items: r.breakdown, eligibilityIssues: r.eligibilityIssues },
    };
  });
  for (let i = 0; i < rows.length; i += 200) await db.scoreRun.createMany({ data: rows.slice(i, i + 200) });
  return rows.length;
}
