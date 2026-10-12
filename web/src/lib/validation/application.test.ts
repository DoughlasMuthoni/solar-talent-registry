import { describe, expect, it } from "vitest";
import { applicationSchema, kenyanPhone, type ApplicationInput } from "./application";

const valid: ApplicationInput = {
  fullName: "Test Technician",
  phone: "0712 345 678",
  email: "tech@example.test",
  town: "Thika",
  county: "Kiambu",
  travel: "REGION",
  engagement: "ANY",
  track: "EPRA_LICENSED",
  qualifications: [],
  epraClass: "T2",
  licenceNumber: "EPRA/SPVT/123",
  licenceExpiresOn: "2027-06-30",
  licenceVerificationConsent: true,
  yearsExperience: 6,
  largestPvKwp: 120,
  categories: ["HYBRID", "INSTITUTIONAL"],
  largestProject: "120 kWp hybrid system at a school; I led commissioning.",
  inverters: "Victron Quattro 15kVA x4",
  batteries: "Pylontech US5000 48V LFP",
  energyAuditor: false,
  highVoltage: false,
  referee1: "Jane Doe, Site Engineer, Org A, +254700000001",
  referee2: "John Doe, Project Manager, Org B, +254700000002",
  recruitmentConsent: true,
  talentPoolConsent: false,
};

const issues = (input: ApplicationInput) => {
  const r = applicationSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
};

describe("kenyanPhone", () => {
  it.each(["0712345678", "0712 345 678", "712345678", "254712345678", "+254 712-345-678", "0112345678"])(
    "normalises %s to E.164",
    (raw) => expect(kenyanPhone.parse(raw)).toMatch(/^\+254[17]\d{8}$/),
  );
  it.each(["12345", "0812345678", "+1 555 123 4567", ""])("rejects %s", (raw) => {
    expect(kenyanPhone.safeParse(raw).success).toBe(false);
  });
});

describe("applicationSchema", () => {
  it("accepts a complete application and normalises it", () => {
    const r = applicationSchema.parse(valid);
    expect(r.phone).toBe("+254712345678");
    expect(r.referee3).toBeUndefined();
  });

  it("requires licence number and expiry for licensed classes", () => {
    expect(issues({ ...valid, licenceNumber: "", licenceExpiresOn: "" })).toEqual(
      expect.arrayContaining(["licenceNumber", "licenceExpiresOn"]),
    );
  });

  const qualification = { level: "DIPLOMA", field: "Electrical engineering", institution: "Kisumu National Polytechnic", yearCompleted: 2020 } as const;

  it("lets qualified-track applicants apply without a licence, but with a qualification", () => {
    const unlicensed = { ...valid, track: "QUALIFIED", epraClass: "NONE", licenceNumber: "", licenceExpiresOn: "" } as const;
    expect(issues({ ...unlicensed, qualifications: [qualification] })).toEqual([]);
    expect(issues(unlicensed)).toEqual(["qualifications"]);
  });

  it("does not need a licence class on the qualified track (the field is hidden there)", () => {
    const noClass = { ...valid, epraClass: undefined };
    expect(issues({ ...noClass, track: "QUALIFIED", licenceNumber: "", licenceExpiresOn: "", qualifications: [qualification] })).toEqual([]);
  });

  it("asks EPRA-track applicants for a licence class", () => {
    expect(issues({ ...valid, epraClass: "NONE", licenceNumber: "", licenceExpiresOn: "" })).toEqual(["epraClass"]);
  });

  it("lets EPRA-track applicants add qualifications too, and validates them", () => {
    expect(issues({ ...valid, qualifications: [qualification] })).toEqual([]);
    expect(issues({ ...valid, qualifications: [{ ...qualification, yearCompleted: 1900, field: "" }] })).toEqual(
      expect.arrayContaining(["qualifications.0.yearCompleted", "qualifications.0.field"]),
    );
    expect(issues({ ...valid, qualifications: [qualification, qualification, qualification, qualification] })).toEqual(["qualifications"]);
  });

  it("requires a track", () => {
    expect(issues({ ...valid, track: undefined as never })).toContain("track");
  });

  it("requires both consents", () => {
    expect(issues({ ...valid, licenceVerificationConsent: false as true, recruitmentConsent: false as true })).toEqual(
      expect.arrayContaining(["licenceVerificationConsent", "recruitmentConsent"]),
    );
  });

  it("requires evidence when high-voltage experience is claimed", () => {
    expect(issues({ ...valid, highVoltage: true })).toContain("voltageExperience");
  });

  it("rejects unknown counties and negative quantities", () => {
    expect(issues({ ...valid, county: "Atlantis" as "Kiambu", largestPvKwp: -5 })).toEqual(
      expect.arrayContaining(["county", "largestPvKwp"]),
    );
  });
});

describe("step schemas", () => {
  it("enforce cross-field licence rules without later steps filled in", async () => {
    const { licenceStep } = await import("./application");
    const r = licenceStep.safeParse({ track: "EPRA_LICENSED", qualifications: [], epraClass: "T2", licenceNumber: "", licenceExpiresOn: "", licenceVerificationConsent: true });
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.path.join("."))).toEqual(["licenceNumber", "licenceExpiresOn"]);
  });

  it("enforce the high-voltage evidence rule on the technical step alone", async () => {
    const { technicalStep } = await import("./application");
    const r = technicalStep.safeParse({ inverters: "Victron Quattro 15kVA", batteries: "Pylontech US5000", energyAuditor: false, highVoltage: true });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0].path).toEqual(["voltageExperience"]);
  });
});
