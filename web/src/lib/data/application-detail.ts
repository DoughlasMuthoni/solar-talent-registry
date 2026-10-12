import "server-only";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import type { ConsentKind, EpraClass, InstallCategory, ScreeningStatus, SocialSource, Stage, Travel, VerificationStatus } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { daysUntil, type BreakdownItem } from "@/lib/scoring/rules";

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

export type TimelineItem =
  | { kind: "note"; id: string; at: string; who: string; body: string }
  | { kind: "stage"; id: string; at: string; who: string; from: Stage; to: Stage; reason: string | null }
  | { kind: "event"; id: string; at: string; who: string | null; action: string }
  | { kind: "email"; id: string; at: string; subject: string; status: "SENT" | "SKIPPED" | "FAILED"; body: string | null; who: string | null };

export type ApplicationDetail = Awaited<ReturnType<typeof getApplicationDetail>>;

/** Everything the admin detail page shows, as plain serialisable data. Admin-only. */
export async function getApplicationDetail(id: string) {
  await connection();
  await requireAdmin();

  const a = await db.application.findUnique({
    where: { id },
    include: {
      candidate: { include: { consents: { orderBy: { grantedAt: "asc" } } } },
      licence: { include: { verifiedBy: { select: { name: true } } } },
      qualifications: { orderBy: { position: "asc" }, include: { verifiedBy: { select: { name: true } } } },
      categories: true,
      referees: { orderBy: { position: "asc" } },
      scoreRuns: { orderBy: { createdAt: "desc" }, take: 1, include: { ruleSet: { select: { version: true } } } },
      notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
      stageChanges: { orderBy: { createdAt: "desc" }, include: { actor: { select: { name: true } } } },
      documents: { orderBy: { uploadedAt: "asc" } },
      assessments: { orderBy: { scheduledAt: "desc" }, include: { assessor: { select: { name: true } } } },
    },
  });
  if (!a) notFound();

  const events = await db.auditEvent.findMany({
    where: {
      entityType: "Application",
      entityId: id,
      action: { in: ["application.submitted", "licence.verified", "qualification.verified", "score.recalculated", "candidate.withdrew", "candidate.erasure_requested", "document.viewed", "assessment.scheduled", "assessment.recorded"] },
    },
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { name: true } } },
    take: 50,
  });

  const emails = await db.emailLog.findMany({ where: { applicationId: id }, orderBy: { createdAt: "desc" }, take: 50, include: { sentBy: { select: { name: true } } } });
  const run = a.scoreRuns[0];
  const breakdown = (run?.breakdown ?? null) as { items?: BreakdownItem[]; eligibilityIssues?: string[] } | null;
  const expires = day(a.licence?.expiresOn);

  const timeline: TimelineItem[] = [
    ...a.notes.map((n) => ({ kind: "note" as const, id: n.id, at: n.createdAt.toISOString(), who: n.author.name, body: n.body })),
    ...a.stageChanges.map((s) => ({
      kind: "stage" as const,
      id: s.id,
      at: s.createdAt.toISOString(),
      who: s.actor?.name ?? (s.byCandidate ? "Candidate" : "System"),
      from: s.fromStage,
      to: s.toStage,
      reason: s.reason,
    })),
    ...events.map((e) => ({ kind: "event" as const, id: e.id, at: e.createdAt.toISOString(), who: e.actor?.name ?? null, action: e.action })),
    ...emails.map((m) => ({ kind: "email" as const, id: m.id, at: m.createdAt.toISOString(), subject: m.subject, status: m.status, body: m.body, who: m.sentBy?.name ?? null })),
  ].sort((x, y) => y.at.localeCompare(x.at));

  return {
    id: a.id,
    reference: a.reference,
    stage: a.stage as Stage,
    submittedAt: a.submittedAt.toISOString(),
    source: a.source as SocialSource,
    track: a.track,
    utmCampaign: a.utmCampaign,
    candidate: {
      fullName: a.candidate.fullName,
      email: a.candidate.email,
      phone: a.candidate.phone,
      town: a.candidate.town,
      county: a.candidate.county,
      region: a.candidate.region,
      travel: a.candidate.travel as Travel,
      isDemo: a.candidate.isDemo,
      consents: a.candidate.consents.map((c) => ({ kind: c.kind as ConsentKind, version: c.noticeVersion, at: c.grantedAt.toISOString(), withdrawn: iso(c.withdrawnAt) })),
    },
    licence: a.licence && {
      epraClass: a.licence.epraClass as EpraClass,
      number: a.licence.number,
      expiresOn: expires,
      daysToExpiry: daysUntil(expires, new Date()),
      issueNote: a.licence.issueNote,
      status: a.licence.status as VerificationStatus,
      verifiedBy: a.licence.verifiedBy?.name ?? null,
      verifiedAt: iso(a.licence.verifiedAt),
      evidenceNote: a.licence.evidenceNote,
    },
    qualifications: a.qualifications.map((q) => ({
      id: q.id,
      position: q.position,
      level: q.level,
      field: q.field,
      institution: q.institution,
      yearCompleted: q.yearCompleted,
      certificateNumber: q.certificateNumber,
      status: q.status as VerificationStatus,
      verifiedBy: q.verifiedBy?.name ?? null,
      verifiedAt: iso(q.verifiedAt),
      evidenceNote: q.evidenceNote,
    })),
    experience: {
      years: Number(a.yearsExperience),
      largestPvKwp: Number(a.largestPvKwp),
      largestInverterKw: a.largestInverterKw === null ? null : Number(a.largestInverterKw),
      largestBatteryKwh: a.largestBatteryKwh === null ? null : Number(a.largestBatteryKwh),
      categories: a.categories.map((c) => c.category as InstallCategory),
      largestProject: a.largestProject,
    },
    technical: {
      inverters: a.inverters,
      batteries: a.batteries,
      logger: a.loggerExperience,
      voltage: a.voltageExperience,
      certifications: a.certifications,
      highVoltage: a.highVoltage,
      energyAuditor: a.energyAuditor,
    },
    referees: a.referees.map((r) => ({ position: r.position, details: r.details })),
    assessments: a.assessments.map((x) => ({
      id: x.id,
      type: x.type,
      status: x.status,
      scheduledAt: x.scheduledAt.toISOString(),
      location: x.location,
      result: x.result,
      score: x.score,
      notes: x.notes,
      assessor: x.assessor?.name ?? null,
    })),
    documents: a.documents.map((d) => ({ id: d.id, kind: d.kind, fileName: d.fileName, sizeBytes: d.sizeBytes, uploadedAt: d.uploadedAt.toISOString() })),
    score: run && {
      total: run.total,
      status: run.status as ScreeningStatus,
      eligible: run.eligible,
      rulesVersion: run.ruleSet.version,
      at: run.createdAt.toISOString(),
      parts: { experience: Number(run.experience), technical: Number(run.technical), verification: Number(run.verification) },
      items: breakdown?.items ?? [],
      eligibilityIssues: breakdown?.eligibilityIssues ?? [],
    },
    timeline,
    /** When this snapshot was taken — lets the page compare dates without impure calls during render. */
    asOf: new Date().toISOString(),
    erasureRequested: events.some((e) => e.action === "candidate.erasure_requested"),
  };
}
