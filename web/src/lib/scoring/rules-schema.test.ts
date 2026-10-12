import { describe, expect, it } from "vitest";
import { RULES_V1 } from "./rules";
import { maxPoints, scoringRulesSchema } from "./rules-schema";

const clone = () => structuredClone(RULES_V1);

describe("scoringRulesSchema", () => {
  it("accepts the v1 rules, whose maximum is exactly 100", () => {
    expect(scoringRulesSchema.safeParse(RULES_V1).success).toBe(true);
    expect(maxPoints(RULES_V1)).toMatchObject({ experience: 30, technical: 40, verification: 30, total: 100, raw: 100 });
  });

  it("rejects thresholds out of order", () => {
    const r = clone();
    r.thresholds = { priority: 60, standard: 65, clarify: 50 };
    const res = scoringRulesSchema.safeParse(r);
    expect(res.success).toBe(false);
    expect(res.error!.issues.some((i) => i.message.includes("Priority > Standard"))).toBe(true);
  });

  it("rejects a fallback above full points, negatives and decimals", () => {
    const r = clone();
    r.technical.inverters = { minChars: 20, points: 3, fallback: 8 };
    r.experience.yearsCap = -1;
    r.thresholds.clarify = 49.5;
    const paths = scoringRulesSchema.safeParse(r).error!.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["technical.inverters.fallback", "experience.yearsCap", "thresholds.clarify"]));
  });

  it("flags weights that make Priority unreachable", () => {
    const r = clone();
    r.technical.certifications.points = 0;
    r.technical.logger.points = 0;
    r.technical.highVoltage.points = 0; // max now 76 < 80
    expect(scoringRulesSchema.safeParse(r).error!.issues.some((i) => i.message.includes("No candidate could reach Priority"))).toBe(true);
  });
});
