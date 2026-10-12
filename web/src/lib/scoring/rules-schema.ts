import { z } from "zod";
import { QualificationLevel } from "@/generated/prisma/enums";
import type { ScoringRules, TextRule } from "./rules";

/** Validation for admin-edited rule sets. Pure; shared by the editor (client) and the publish action (server). */
const pts = z.number({ error: "Enter a number" }).int("Whole numbers only").min(0, "Can't be negative").max(100, "100 or less");
const chars = z.number({ error: "Enter a number" }).int("Whole numbers only").min(0).max(2000);

const textRule = z
  .object({ minChars: chars, points: pts, fallback: pts })
  .refine((r) => r.fallback <= r.points, { path: ["fallback"], message: "Fallback can't exceed full points" });

export const scoringRulesSchema = z
  .object({
    version: z.number().int().min(1),
    experience: z.object({
      pointsPerYear: z.number().min(0).max(100),
      yearsCap: pts,
      pvKwpPerPoint: z.number().positive("Must be above 0").max(100_000),
      pvCap: pts,
      pointsPerCategory: z.number().min(0).max(100),
      categoriesCap: pts,
    }),
    technical: z.object({ inverters: textRule, batteries: textRule, logger: textRule, highVoltage: textRule, certifications: textRule }),
    verification: z.object({
      referees: z.tuple([textRule, textRule, textRule]),
      travel: z.object({ COUNTY: pts, REGION: pts, NATIONAL: pts }),
      largestProject: textRule,
    }),
    thresholds: z.object({ priority: pts, standard: pts, clarify: pts }),
    expiringWithinDays: z.number().int().min(1).max(365),
    qualifiedTrack: z.object({ minLevel: z.enum(QualificationLevel).exclude(["OTHER"]) }).optional(),
  })
  .superRefine((r, ctx) => {
    const { priority, standard, clarify } = r.thresholds;
    if (!(priority > standard && standard > clarify)) {
      ctx.addIssue({ code: "custom", path: ["thresholds"], message: "Thresholds must go Priority > Standard > Clarification" });
    }
    if (maxPoints(r as ScoringRules).total < priority) {
      ctx.addIssue({ code: "custom", path: ["thresholds", "priority"], message: "No candidate could reach Priority with these weights" });
    }
  });

const textMax = (r: TextRule) => r.points;

/** Highest achievable points per section with these rules (score is capped at 100). */
export function maxPoints(r: ScoringRules) {
  const experience = r.experience.yearsCap + r.experience.pvCap + r.experience.categoriesCap;
  const t = r.technical;
  const technical = textMax(t.inverters) + textMax(t.batteries) + textMax(t.logger) + textMax(t.highVoltage) + textMax(t.certifications);
  const v = r.verification;
  const verification = v.referees.reduce((s, x) => s + x.points, 0) + Math.max(...Object.values(v.travel)) + v.largestProject.points;
  return { experience, technical, verification, total: Math.min(100, experience + technical + verification), raw: experience + technical + verification };
}
