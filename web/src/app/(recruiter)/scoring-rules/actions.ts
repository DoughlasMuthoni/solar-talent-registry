"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ScreeningStatus } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { toScoringInput } from "@/lib/scoring/from-application";
import { loadOpenForScoring, rescoreWith, statusCounts } from "@/lib/scoring/rescore";
import { RULES_V1, scoreApplication, type ScoringRules } from "@/lib/scoring/rules";
import { scoringRulesSchema } from "@/lib/scoring/rules-schema";

type Counts = ReturnType<typeof statusCounts>;
export type PreviewResult =
  | { ok: true; total: number; current: Counts; draft: Counts; changed: number }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function validate(input: unknown) {
  const p = scoringRulesSchema.safeParse(input);
  if (p.success) return { ok: true as const, rules: p.data as ScoringRules };
  const fieldErrors: Record<string, string> = {};
  for (const i of p.error.issues) fieldErrors[i.path.join(".")] ??= i.message;
  return { ok: false as const, error: "Some values need attention.", fieldErrors };
}

async function activeRules(): Promise<ScoringRules> {
  const a = await db.scoringRuleSet.findFirst({ where: { active: true }, orderBy: { version: "desc" } });
  return (a?.rules as unknown as ScoringRules) ?? RULES_V1;
}

/** Dry run: how would open applications be routed under the draft rules? Nothing is saved. */
export async function previewRules(input: unknown): Promise<PreviewResult> {
  await requireAdmin();
  const v = validate(input);
  if (!v.ok) return v;
  const [apps, current] = await Promise.all([loadOpenForScoring(), activeRules()]);
  const now = new Date();
  let changed = 0;
  const before: ScreeningStatus[] = [];
  const after: ScreeningStatus[] = [];
  for (const a of apps) {
    const inp = toScoringInput(a);
    const b = scoreApplication(inp, current, now).status;
    const d = scoreApplication(inp, v.rules, now).status;
    before.push(b);
    after.push(d);
    if (b !== d) changed++;
  }
  return { ok: true, total: apps.length, current: statusCounts(before), draft: statusCounts(after), changed };
}

const publishSchema = z.object({ notes: z.string().trim().min(5, "Say briefly what changed and why").max(1000), rescore: z.boolean() });

export async function publishRules(input: { rules: unknown; notes: string; rescore: boolean }) {
  const admin = await requireAdmin();
  const v = validate(input.rules);
  if (!v.ok) return v;
  const meta = publishSchema.safeParse({ notes: input.notes, rescore: input.rescore });
  if (!meta.success) return { ok: false as const, error: meta.error.issues[0].message };

  const latest = await db.scoringRuleSet.findFirst({ orderBy: { version: "desc" }, select: { version: true } });
  const version = (latest?.version ?? 0) + 1;
  const rules = { ...v.rules, version };
  const created = await db.$transaction(async (tx) => {
    await tx.scoringRuleSet.updateMany({ where: { active: true }, data: { active: false } });
    const rs = await tx.scoringRuleSet.create({ data: { version, rules, active: true, notes: meta.data.notes, createdById: admin.id } });
    await tx.auditEvent.create({
      data: { actorId: admin.id, action: "scoring.published", entityType: "ScoringRuleSet", entityId: rs.id, metadata: { version, rescore: meta.data.rescore } },
    });
    return rs;
  });
  const rescored = meta.data.rescore ? await rescoreWith({ id: created.id, rules }) : 0;
  refresh();
  return { ok: true as const, version, rescored };
}
