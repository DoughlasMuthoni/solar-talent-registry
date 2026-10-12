import { describe, expect, it } from "vitest";
import { RULES_V1, daysUntil, scoreApplication, type ScoringInput, type ScoringRules } from "./rules";

const NOW = new Date(2026, 9, 7, 15, 0); // 7 Oct 2026, 15:00 local
const long = (n: number) => "x".repeat(n + 1);

/** Eligible, every criterion maxed → 100. */
const full = (over: Partial<ScoringInput> = {}): ScoringInput => ({
  track: "EPRA_LICENSED",
  qualifications: [],
  epraClass: "T3",
  licenceNumber: "EPRA/SPVT/1",
  licenceExpiresOn: "2027-06-30",
  licenceVerificationConsent: true,
  yearsExperience: 10,
  largestPvKwp: 500,
  categoryCount: 6,
  inverters: long(20),
  batteries: long(20),
  loggerExperience: long(25),
  highVoltage: true,
  voltageExperience: long(25),
  certifications: long(20),
  referees: [long(20), long(20), long(20)],
  travel: "NATIONAL",
  largestProject: long(50),
  ...over,
});
/** Technical section at its minimum (6/40) → non-experience points = 36. */
const lowTech: Partial<ScoringInput> = { inverters: "", batteries: "", loggerExperience: "", highVoltage: false, voltageExperience: "", certifications: "" };
const score = (i: ScoringInput) => scoreApplication(i, RULES_V1, NOW);

describe("scoreApplication (rules v1)", () => {
  it("scores a fully evidenced candidate 100 → priority review", () => {
    const r = score(full());
    expect(r.total).toBe(100);
    expect(r.parts).toEqual({ experience: 30, technical: 40, verification: 30 });
    expect(r.status).toBe("PRIORITY_REVIEW");
    expect(r.rulesVersion).toBe(1);
  });

  it.each([
    [full({ yearsExperience: 5, largestPvKwp: 0, categoryCount: 0 }), 80, "PRIORITY_REVIEW"],
    [full({ yearsExperience: 4.5, largestPvKwp: 0, categoryCount: 0 }), 79, "STANDARD_REVIEW"],
    [full({ ...lowTech, yearsExperience: 5, largestPvKwp: 70, categoryCount: 6 }), 65, "STANDARD_REVIEW"],
    [full({ ...lowTech, yearsExperience: 5, largestPvKwp: 60, categoryCount: 6 }), 64, "NEEDS_CLARIFICATION"],
    [full({ ...lowTech, yearsExperience: 5, largestPvKwp: 0, categoryCount: 2 }), 50, "NEEDS_CLARIFICATION"],
    [full({ ...lowTech, yearsExperience: 4.5, largestPvKwp: 0, categoryCount: 2 }), 49, "BELOW_THRESHOLD"],
  ] as const)("routes score boundary #%# correctly", (input, total, status) => {
    const r = score(input);
    expect(r.total).toBe(total);
    expect(r.status).toBe(status);
  });

  it("scores a minimal eligible application 9 → below threshold", () => {
    const r = score({
      track: "EPRA_LICENSED", qualifications: [],
      epraClass: "T1", licenceNumber: "L1", licenceExpiresOn: "2027-01-01", licenceVerificationConsent: true,
      yearsExperience: 0, largestPvKwp: 0, categoryCount: 0, inverters: "", batteries: "", loggerExperience: null,
      voltageExperience: null, highVoltage: false, certifications: null, referees: [], travel: "COUNTY", largestProject: "",
    });
    expect(r.total).toBe(9); // inverters 3 + batteries 3 + travel 1 + project 2
    expect(r.status).toBe("BELOW_THRESHOLD");
  });

  it.each<[Partial<ScoringInput>, string]>([
    [{ epraClass: "NONE" }, "No EPRA solar PV licence class (T1–T3)"],
    [{ epraClass: null }, "No EPRA solar PV licence class (T1–T3)"],
    [{ licenceNumber: "   " }, "No licence number"],
    [{ licenceVerificationConsent: false }, "No consent to verify the licence"],
    [{ licenceExpiresOn: null }, "No valid licence expiry date"],
    [{ licenceExpiresOn: "31/12/2027" }, "No valid licence expiry date"],
    [{ licenceExpiresOn: "2026-10-06" }, "Licence expired 1 day ago"],
    [{ licenceExpiresOn: "2026-09-07" }, "Licence expired 30 days ago"],
  ])("eligibility gate overrides any score: %o", (over, issue) => {
    const r = score(full(over));
    expect(r.total).toBe(100);
    expect(r.eligible).toBe(false);
    expect(r.status).toBe("INELIGIBLE_LICENCE");
    expect(r.eligibilityIssues).toContain(issue);
  });

  it("treats a licence expiring today as valid and yesterday as expired", () => {
    expect(daysUntil("2026-10-07", NOW)).toBe(0);
    expect(daysUntil("2026-10-06", NOW)).toBe(-1);
    expect(score(full({ licenceExpiresOn: "2026-10-07" })).eligible).toBe(true);
    expect(score(full({ licenceExpiresOn: "2026-10-06" })).eligible).toBe(false);
  });

  it("flags expiring licences within 0–90 days only", () => {
    expect(score(full({ licenceExpiresOn: "2027-01-05" })).expiring).toBe(true); // 90 days
    expect(score(full({ licenceExpiresOn: "2027-01-06" })).expiring).toBe(false); // 91
    expect(score(full({ licenceExpiresOn: "2026-10-06" })).expiring).toBe(false); // expired
  });

  it("never produces NaN from bad numbers", () => {
    const r = score(full({ yearsExperience: Number.NaN, largestPvKwp: -40, categoryCount: -1 }));
    expect(Number.isFinite(r.total)).toBe(true);
    expect(r.parts.experience).toBe(0);
  });

  it("needs both the high-voltage claim and the evidence", () => {
    expect(score(full({ highVoltage: false })).parts.technical).toBe(32);
    expect(score(full({ voltageExperience: "short" })).parts.technical).toBe(32);
  });

  it("does not reward whitespace padding", () => {
    expect(score(full({ certifications: " ".repeat(40) })).parts.technical).toBe(32);
  });

  it("explains every point in the breakdown", () => {
    const r = score(full());
    const sum = r.breakdown.reduce((s, b) => s + b.points, 0);
    expect(sum).toBe(100);
    expect(r.breakdown.every((b) => b.points <= b.max)).toBe(true);
    expect(r.breakdown.map((b) => b.key)).toContain("referee3");
  });
});

describe("qualified track", () => {
  const unlicensed = { epraClass: "NONE", licenceNumber: null, licenceExpiresOn: null } as const;
  const score = (over: Partial<ScoringInput>, rules = RULES_V1) => scoreApplication(full({ track: "QUALIFIED", ...unlicensed, ...over }), rules, NOW);

  it("replaces the licence gate with a qualification gate", () => {
    const r = score({ qualifications: [{ level: "DIPLOMA" }] });
    expect(r.eligible).toBe(true);
    expect(r.status).toBe("PRIORITY_REVIEW");
    expect(r.total).toBe(100);
  });

  it.each<[Partial<ScoringInput>, string]>([
    [{ qualifications: [] }, "No qualification at Artisan certificate level or above"],
    [{ qualifications: [{ level: "OTHER" }] }, "No qualification at Artisan certificate level or above"],
    [{ qualifications: [{ level: "DEGREE" }], licenceVerificationConsent: false }, "No consent to verify qualifications"],
  ])("is ineligible without a qualifying credential: %o", (over, issue) => {
    const r = score(over);
    expect(r.status).toBe("INELIGIBLE_LICENCE");
    expect(r.eligibilityIssues).toEqual([issue]);
  });

  it("honours a stricter minimum level from the rule set", () => {
    const rules = { ...RULES_V1, qualifiedTrack: { minLevel: "DIPLOMA" as const } };
    expect(score({ qualifications: [{ level: "CERTIFICATE" }] }, rules).eligible).toBe(false);
    expect(score({ qualifications: [{ level: "CERTIFICATE" }, { level: "HIGHER_DIPLOMA" }] }, rules).eligible).toBe(true);
  });

  it("falls back to the default minimum for rule sets saved before tracks", () => {
    const legacy: ScoringRules = { ...RULES_V1, qualifiedTrack: undefined };
    expect(score({ qualifications: [{ level: "TRADE_TEST" }] }, legacy).eligible).toBe(true);
  });

  it("still gates EPRA-track applicants on the licence even if they list qualifications", () => {
    const r = scoreApplication(full({ ...unlicensed, qualifications: [{ level: "DEGREE" }] }), RULES_V1, NOW);
    expect(r.eligible).toBe(false);
  });
});
