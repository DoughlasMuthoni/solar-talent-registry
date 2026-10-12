import type { Prisma } from "@/generated/prisma/client";
import type { ScoringInput } from "./rules";

/** The relations scoring needs. Use with `include` when loading an application to score. */
export const scoringInclude = {
  licence: true,
  qualifications: { orderBy: { position: "asc" } },
  referees: { orderBy: { position: "asc" } },
  categories: true,
  candidate: { include: { consents: true } },
} satisfies Prisma.ApplicationInclude;

export type ApplicationForScoring = Prisma.ApplicationGetPayload<{ include: typeof scoringInclude }>;

/** Calendar date stored as DATE → "YYYY-MM-DD" (DATE columns come back as UTC midnight). */
const isoDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

export function toScoringInput(a: ApplicationForScoring): ScoringInput {
  const consent = a.candidate.consents.some((c) => c.kind === "LICENCE_VERIFICATION" && !c.withdrawnAt);
  return {
    track: a.track,
    qualifications: a.qualifications.map((q) => ({ level: q.level })),
    epraClass: a.licence?.epraClass ?? null,
    licenceNumber: a.licence?.number ?? null,
    licenceExpiresOn: isoDate(a.licence?.expiresOn),
    licenceVerificationConsent: consent,
    yearsExperience: Number(a.yearsExperience),
    largestPvKwp: Number(a.largestPvKwp),
    categoryCount: a.categories.length,
    inverters: a.inverters,
    batteries: a.batteries,
    loggerExperience: a.loggerExperience,
    voltageExperience: a.voltageExperience,
    highVoltage: a.highVoltage,
    certifications: a.certifications,
    referees: a.referees.map((r) => r.details),
    travel: a.candidate.travel,
    largestProject: a.largestProject,
  };
}
