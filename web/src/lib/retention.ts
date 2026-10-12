/**
 * Data-retention policy (Kenya DPA 2019 — storage limitation). Agreed 2026-10-08:
 *  - Closed applications (rejected / withdrawn) are erased 12 months after they closed.
 *  - Candidates with an active talent-pool consent are kept up to 24 months after closing.
 *  - Open applications and approved-pool technicians are never auto-erased.
 * Pure: decides only; the daily cron performs the erasure.
 */
export const RETENTION_MONTHS = 12;
export const TALENT_POOL_MONTHS = 24;

export type RetentionInput = {
  /** Every application the candidate has: stage + when it closed (last stage change into a closed stage). */
  applications: { stage: string; closedAt: Date | null }[];
  talentPoolConsent: boolean;
  now: Date;
};

const CLOSED = new Set(["REJECTED", "WITHDRAWN"]);

function addMonths(d: Date, months: number) {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + months);
  return r;
}

export function shouldErase({ applications, talentPoolConsent, now }: RetentionInput): boolean {
  if (applications.length === 0) return false;
  // Any open or approved application keeps the candidate.
  if (applications.some((a) => !CLOSED.has(a.stage))) return false;
  const lastClosed = Math.max(...applications.map((a) => a.closedAt?.getTime() ?? 0));
  if (!lastClosed) return false; // closed but date unknown — keep and let a human decide
  const keepUntil = addMonths(new Date(lastClosed), talentPoolConsent ? TALENT_POOL_MONTHS : RETENTION_MONTHS);
  return now.getTime() >= keepUntil.getTime();
}
