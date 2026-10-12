import type { QualificationLevel, Track } from "@/generated/prisma/enums";

/** Pure reference data for the two application tracks and formal qualifications. No I/O. */

export const TRACK: Record<Track, { label: string; short: string; description: string }> = {
  EPRA_LICENSED: {
    label: "EPRA-licensed solar technician",
    short: "EPRA licensed",
    description: "I hold an EPRA solar PV technician licence (T1, T2 or T3).",
  },
  QUALIFIED: {
    label: "Qualified solar technician",
    short: "Qualified",
    description: "I have a solar or electrical certificate, diploma or degree, but no EPRA licence yet.",
  },
};

/** Lowest to highest. OTHER (e.g. short courses) never meets a minimum level on its own. */
export const QUALIFICATION_LEVEL: Record<QualificationLevel, { label: string; rank: number }> = {
  TRADE_TEST: { label: "NITA trade test (Grade I–III)", rank: 1 },
  ARTISAN: { label: "Artisan certificate", rank: 1 },
  CERTIFICATE: { label: "Certificate (TVET / KNEC / CDACC)", rank: 2 },
  DIPLOMA: { label: "Diploma", rank: 3 },
  HIGHER_DIPLOMA: { label: "Higher National Diploma", rank: 4 },
  DEGREE: { label: "Degree (BSc / BEng / BTech)", rank: 5 },
  OTHER: { label: "Other course or training", rank: 0 },
};

export const QUALIFICATION_LEVELS = Object.keys(QUALIFICATION_LEVEL) as QualificationLevel[];

export const meetsLevel = (level: QualificationLevel, minimum: QualificationLevel) =>
  QUALIFICATION_LEVEL[level].rank >= Math.max(1, QUALIFICATION_LEVEL[minimum].rank);

export const MAX_QUALIFICATIONS = 3;

/** Turns `?track=qualified` on an advert link into a preselected track. */
export function trackFromParam(v: string | string[] | undefined): Track | undefined {
  const s = (Array.isArray(v) ? v[0] : v)?.toLowerCase();
  if (s === "qualified" || s === "q") return "QUALIFIED";
  if (s === "epra" || s === "licensed" || s === "licenced") return "EPRA_LICENSED";
  return undefined;
}
