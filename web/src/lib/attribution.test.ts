import { describe, expect, it } from "vitest";
import { attributionFromParams, sanitizeAttribution } from "./attribution";

describe("attributionFromParams", () => {
  it.each([
    ["facebook", "FACEBOOK"], ["fb", "FACEBOOK"], ["IG", "INSTAGRAM"], ["linkedin", "LINKEDIN"],
    ["twitter", "X"], ["x", "X"], ["tiktok", "TIKTOK"], ["wa", "WHATSAPP"], ["youtube", "YOUTUBE"],
    ["newsletter", "OTHER"],
  ] as const)("maps utm_source=%s to %s", (raw, source) => {
    expect(attributionFromParams({ utm_source: raw }).source).toBe(source);
  });

  it("accepts the short ?src= form", () => {
    expect(attributionFromParams({ src: "whatsapp" })).toMatchObject({ source: "WHATSAPP", utmSource: "whatsapp" });
  });

  it("treats no parameters as a direct visit", () => {
    expect(attributionFromParams({})).toEqual({ source: "DIRECT", utmSource: null, utmMedium: null, utmCampaign: null });
  });

  it("keeps campaign and medium, normalised", () => {
    const a = attributionFromParams({ utm_source: "fb", utm_medium: "Paid_Social", utm_campaign: "Technicians-2026" });
    expect(a).toEqual({ source: "FACEBOOK", utmSource: "fb", utmMedium: "paid_social", utmCampaign: "technicians-2026" });
  });

  it("strips markup and caps length on untrusted input", () => {
    const a = attributionFromParams({ utm_campaign: `<script>alert(1)</script>${"x".repeat(300)}` });
    expect(a.utmCampaign).not.toMatch(/[<>()]/);
    expect(a.utmCampaign!.length).toBeLessThanOrEqual(100);
  });

  it("uses the first value when a parameter repeats", () => {
    expect(attributionFromParams({ utm_source: ["linkedin", "fb"] }).source).toBe("LINKEDIN");
  });
});

describe("sanitizeAttribution", () => {
  it("recomputes the source instead of trusting the client", () => {
    expect(sanitizeAttribution({ source: "LINKEDIN", utmSource: "fb" }).source).toBe("FACEBOOK");
    expect(sanitizeAttribution("nonsense")).toMatchObject({ source: "DIRECT" });
  });
});
