import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { Attribution } from "@/lib/attribution";
import { db } from "@/lib/db";
import { PRIVACY_NOTICE_VERSION } from "@/lib/privacy";
import { countyCode, regionOf } from "@/lib/reference/kenya";
import { scoringInclude, toScoringInput } from "@/lib/scoring/from-application";
import { RULES_V1, scoreApplication, type ScoringRules } from "@/lib/scoring/rules";
import type { Application } from "@/lib/validation/application";

/** The active rule set; creates v1 on first use so a fresh database still scores. */
async function activeRuleSet() {
  const active = await db.scoringRuleSet.findFirst({ where: { active: true }, orderBy: { version: "desc" } });
  if (active) return { id: active.id, rules: active.rules as unknown as ScoringRules };
  const created = await db.scoringRuleSet.upsert({
    where: { version: RULES_V1.version },
    update: { active: true },
    create: { version: RULES_V1.version, rules: RULES_V1, active: true, notes: "Created automatically on first submission." },
  });
  return { id: created.id, rules: created.rules as unknown as ScoringRules };
}

const pad = (n: number) => String(n).padStart(4, "0");
const toDate = (iso: string | undefined) => (iso ? new Date(`${iso}T00:00:00Z`) : null);

/**
 * Persist a validated application, score it, and audit it — all in one transaction.
 * Idempotent on `submissionKey`: a retried submit returns the original reference.
 */
export async function createApplication(input: Application, attribution: Attribution, submissionKey: string) {
  const existing = await db.application.findUnique({ where: { submissionKey }, select: { id: true, reference: true } });
  if (existing) return { reference: existing.reference, applicationId: existing.id };

  // The qualified track is for technicians without an EPRA licence; ignore any licence fields left in the form.
  const epraClass = input.track === "QUALIFIED" ? "NONE" : (input.epraClass ?? "NONE");
  const ruleSet = await activeRuleSet();
  const now = new Date();

  try {
    return await db.$transaction(async (tx) => {
      // Email is unverified, so a repeat applicant's stored details are never overwritten from a public form.
      const prior = await tx.candidate.findUnique({ where: { email: input.email } });
      const candidate =
        prior ??
        (await tx.candidate.create({
          data: {
            fullName: input.fullName,
            email: input.email,
            phone: input.phone,
            town: input.town,
            county: input.county,
            region: regionOf(input.county),
            travel: input.travel,
            engagement: input.engagement,
          },
        }));

      const licence = await tx.licence.create({
        data: {
          candidateId: candidate.id,
          epraClass,
          number: epraClass === "NONE" ? null : (input.licenceNumber ?? null),
          expiresOn: epraClass === "NONE" ? null : toDate(input.licenceExpiresOn),
          issueNote: input.licenceIssue ?? null,
        },
      });

      await tx.consentRecord.createMany({
        data: [
          { candidateId: candidate.id, kind: "RECRUITMENT_PROCESSING", noticeVersion: PRIVACY_NOTICE_VERSION },
          { candidateId: candidate.id, kind: "LICENCE_VERIFICATION", noticeVersion: PRIVACY_NOTICE_VERSION },
          ...(input.talentPoolConsent
            ? [{ candidateId: candidate.id, kind: "TALENT_POOL" as const, noticeVersion: PRIVACY_NOTICE_VERSION }]
            : []),
        ],
      });

      const app = await tx.application.create({
        data: {
          reference: `PENDING-${submissionKey}`.slice(0, 32),
          submissionKey,
          candidateId: candidate.id,
          licenceId: licence.id,
          track: input.track,
          source: attribution.source,
          utmSource: attribution.utmSource,
          utmMedium: attribution.utmMedium,
          utmCampaign: attribution.utmCampaign,
          yearsExperience: input.yearsExperience,
          largestPvKwp: input.largestPvKwp,
          largestInverterKw: input.largestInverterKw ?? null,
          largestBatteryKwh: input.largestBatteryKwh ?? null,
          largestProject: input.largestProject,
          inverters: input.inverters,
          batteries: input.batteries,
          loggerExperience: input.loggerExperience ?? null,
          voltageExperience: input.voltageExperience ?? null,
          certifications: input.certifications ?? null,
          energyAuditor: input.energyAuditor,
          highVoltage: input.highVoltage,
          qualifications: {
            create: input.qualifications.map((q, i) => ({
              position: i + 1,
              level: q.level,
              field: q.field,
              institution: q.institution,
              yearCompleted: q.yearCompleted,
              certificateNumber: q.certificateNumber ?? null,
            })),
          },
          categories: { create: [...new Set(input.categories)].map((category) => ({ category })) },
          referees: {
            create: [input.referee1, input.referee2, input.referee3]
              .filter((d): d is string => Boolean(d))
              .map((details, i) => ({ position: i + 1, details })),
          },
        },
      });

      const reference = `${countyCode(input.county)}-${input.track === "QUALIFIED" ? "Q" : epraClass === "NONE" ? "NA" : epraClass}-${pad(app.number)}`;
      const full = await tx.application.update({ where: { id: app.id }, data: { reference }, include: scoringInclude });

      const result = scoreApplication(toScoringInput(full), ruleSet.rules, now);
      await tx.scoreRun.create({
        data: {
          applicationId: app.id,
          ruleSetId: ruleSet.id,
          experience: result.parts.experience,
          technical: result.parts.technical,
          verification: result.parts.verification,
          total: result.total,
          eligible: result.eligible,
          status: result.status,
          breakdown: { items: result.breakdown, eligibilityIssues: result.eligibilityIssues },
        },
      });

      const contactChanges = prior
        ? (["fullName", "phone", "town", "county"] as const).filter((k) => prior[k] !== input[k])
        : [];
      await tx.auditEvent.create({
        data: {
          action: "application.submitted",
          entityType: "Application",
          entityId: app.id,
          metadata: {
            reference,
            source: attribution.source,
            track: input.track,
            repeatApplicant: Boolean(prior),
            // Submitted values that differ from the stored candidate record, for an admin to review.
            ...(contactChanges.length ? { contactChanges: Object.fromEntries(contactChanges.map((k) => [k, input[k]])) } : {}),
          },
        },
      });

      return { reference, applicationId: app.id };
    // Generous limits: a slow link (e.g. local dev from Kenya to Frankfurt) must never lose an application.
    }, { maxWait: 10_000, timeout: 20_000 });
  } catch (e) {
    // Two concurrent submits with the same key: the loser returns the winner's reference.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const again = await db.application.findUnique({ where: { submissionKey }, select: { id: true, reference: true } });
      if (again) return { reference: again.reference, applicationId: again.id };
    }
    throw e;
  }
}
