import "server-only";
import { connection } from "next/server";
import type { EpraClass, QualificationLevel, ScreeningStatus, SocialSource, Stage, Track, VerificationStatus } from "@/generated/prisma/enums";
import { QUALIFICATION_LEVEL } from "@/lib/qualifications";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { daysUntil } from "@/lib/scoring/rules";

/** Serialisable row for the recruiter UI (no Decimal/Date objects cross to the client). */
export type ApplicationRow = {
  id: string;
  reference: string;
  fullName: string;
  town: string;
  county: string;
  region: string;
  track: Track;
  /** Highest qualification level listed, if any. */
  topQualification: QualificationLevel | null;
  /** Verified qualifications / all qualifications. */
  qualificationsVerified: number;
  qualificationsTotal: number;
  epraClass: EpraClass | null;
  licenceStatus: VerificationStatus | null;
  licenceExpiresOn: string | null;
  daysToExpiry: number | null;
  largestPvKwp: number;
  stage: Stage;
  source: SocialSource;
  score: number | null;
  status: ScreeningStatus | null;
  submittedAt: string;
  isDemo: boolean;
};

/** Admin-only (Data Access Layer: the auth check lives with the data, not just the page). */
export async function listApplications(): Promise<ApplicationRow[]> {
  await connection(); // always fresh — admin data must never be served from a prerender
  await requireAdmin();
  const rows = await db.application.findMany({
    orderBy: { submittedAt: "desc" },
    include: {
      candidate: true,
      licence: true,
      qualifications: { select: { level: true, status: true } },
      scoreRuns: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  const now = new Date();
  return rows.map((a) => {
    const expires = a.licence?.expiresOn ? a.licence.expiresOn.toISOString().slice(0, 10) : null;
    const run = a.scoreRuns[0];
    return {
      id: a.id,
      reference: a.reference,
      fullName: a.candidate.fullName,
      town: a.candidate.town,
      county: a.candidate.county,
      region: a.candidate.region,
      track: a.track,
      topQualification: a.qualifications.reduce<QualificationLevel | null>(
        (best, q) => (!best || QUALIFICATION_LEVEL[q.level].rank > QUALIFICATION_LEVEL[best].rank ? q.level : best),
        null,
      ),
      qualificationsVerified: a.qualifications.filter((q) => q.status === "VERIFIED").length,
      qualificationsTotal: a.qualifications.length,
      epraClass: a.licence?.epraClass ?? null,
      licenceStatus: a.licence?.status ?? null,
      licenceExpiresOn: expires,
      daysToExpiry: daysUntil(expires, now),
      largestPvKwp: Number(a.largestPvKwp),
      stage: a.stage,
      source: a.source,
      score: run?.total ?? null,
      status: run?.status ?? null,
      submittedAt: a.submittedAt.toISOString(),
      isDemo: a.candidate.isDemo,
    };
  });
}

export type DashboardSummary = {
  total: number;
  verified: number;
  priority: number;
  byTrack: { track: Track; count: number }[];
  expiringSoon: ApplicationRow[];
  byStage: { stage: Stage; count: number }[];
  byStatus: { status: ScreeningStatus; count: number }[];
  bySource: { source: SocialSource; count: number }[];
  hasDemoData: boolean;
};

const STAGE_ORDER: Stage[] = ["NEW", "TECHNICAL_ASSESSMENT", "PRACTICAL_ASSESSMENT", "REFERENCE_CHECKS", "APPROVED_POOL"];
const STATUS_ORDER: ScreeningStatus[] = ["PRIORITY_REVIEW", "STANDARD_REVIEW", "NEEDS_CLARIFICATION", "BELOW_THRESHOLD", "INELIGIBLE_LICENCE"];

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const rows = await listApplications();
  return {
    total: rows.length,
    // Credentials verified: the licence on the EPRA track, at least one qualification on the qualified track.
    verified: rows.filter((r) => (r.track === "QUALIFIED" ? r.qualificationsVerified > 0 : r.licenceStatus === "VERIFIED")).length,
    byTrack: (["EPRA_LICENSED", "QUALIFIED"] as const).map((track) => ({ track, count: rows.filter((r) => r.track === track).length })),
    priority: rows.filter((r) => r.status === "PRIORITY_REVIEW").length,
    expiringSoon: rows
      .filter((r) => r.daysToExpiry !== null && r.daysToExpiry >= 0 && r.daysToExpiry <= 90)
      .sort((a, b) => a.daysToExpiry! - b.daysToExpiry!),
    byStage: STAGE_ORDER.map((stage) => ({ stage, count: rows.filter((r) => r.stage === stage).length })),
    byStatus: STATUS_ORDER.map((status) => ({ status, count: rows.filter((r) => r.status === status).length })),
    bySource: Object.entries(
      rows.reduce<Record<string, number>>((m, r) => ((m[r.source] = (m[r.source] ?? 0) + 1), m), {}),
    )
      .map(([source, count]) => ({ source: source as SocialSource, count }))
      .sort((a, b) => b.count - a.count),
    hasDemoData: rows.some((r) => r.isDemo),
  };
}
