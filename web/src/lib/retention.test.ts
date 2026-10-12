import { describe, expect, it } from "vitest";
import { rateLimitKey } from "./rate-limit-key";
import { shouldErase } from "./retention";

const NOW = new Date("2027-10-08T00:00:00Z");
const closed = (iso: string, stage = "REJECTED") => ({ stage, closedAt: new Date(iso) });

describe("shouldErase (12 / 24 months)", () => {
  it("erases a rejection closed more than 12 months ago", () => {
    expect(shouldErase({ applications: [closed("2026-10-01T00:00:00Z")], talentPoolConsent: false, now: NOW })).toBe(true);
  });
  it("keeps a rejection closed less than 12 months ago", () => {
    expect(shouldErase({ applications: [closed("2026-11-01T00:00:00Z")], talentPoolConsent: false, now: NOW })).toBe(false);
  });
  it("keeps talent-pool candidates for 24 months", () => {
    expect(shouldErase({ applications: [closed("2026-01-01T00:00:00Z", "WITHDRAWN")], talentPoolConsent: true, now: NOW })).toBe(false);
    expect(shouldErase({ applications: [closed("2025-10-01T00:00:00Z", "WITHDRAWN")], talentPoolConsent: true, now: NOW })).toBe(true);
  });
  it("never erases while any application is open or approved", () => {
    for (const stage of ["NEW", "TECHNICAL_ASSESSMENT", "APPROVED_POOL"]) {
      expect(shouldErase({ applications: [closed("2020-01-01T00:00:00Z"), { stage, closedAt: null }], talentPoolConsent: false, now: NOW })).toBe(false);
    }
  });
  it("uses the most recent closing date across applications", () => {
    expect(shouldErase({ applications: [closed("2020-01-01T00:00:00Z"), closed("2027-06-01T00:00:00Z")], talentPoolConsent: false, now: NOW })).toBe(false);
  });
  it("keeps when the closing date is unknown or there are no applications", () => {
    expect(shouldErase({ applications: [{ stage: "REJECTED", closedAt: null }], talentPoolConsent: false, now: NOW })).toBe(false);
    expect(shouldErase({ applications: [], talentPoolConsent: false, now: NOW })).toBe(false);
  });
});

describe("rateLimitKey", () => {
  it("buckets by window and never contains the raw IP", () => {
    const a = rateLimitKey("apply", "102.0.0.7", 3600, new Date("2026-10-08T10:05:00Z"), "salt");
    const b = rateLimitKey("apply", "102.0.0.7", 3600, new Date("2026-10-08T10:55:00Z"), "salt");
    const c = rateLimitKey("apply", "102.0.0.7", 3600, new Date("2026-10-08T11:01:00Z"), "salt");
    expect(a.key).toBe(b.key);
    expect(a.key).not.toBe(c.key);
    expect(a.key).not.toContain("102.0.0.7");
    expect(a.expiresAt.toISOString()).toBe("2026-10-08T11:00:00.000Z");
  });
});
