import "server-only";
import { connection } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { OPEN_STAGES_FILTER } from "@/lib/scoring/rescore";
import { RULES_V1, type ScoringRules } from "@/lib/scoring/rules";

export async function getScoringOverview() {
  await connection();
  await requireAdmin();
  const [sets, openApplications] = await Promise.all([
    db.scoringRuleSet.findMany({
      orderBy: { version: "desc" },
      include: { createdBy: { select: { name: true } }, _count: { select: { scoreRuns: true } } },
    }),
    db.application.count({ where: OPEN_STAGES_FILTER }),
  ]);
  const active = sets.find((s) => s.active);
  return {
    active: { version: active?.version ?? 1, rules: (active?.rules as unknown as ScoringRules) ?? RULES_V1 },
    openApplications,
    history: sets.map((s) => ({
      id: s.id,
      version: s.version,
      active: s.active,
      notes: s.notes,
      createdBy: s.createdBy?.name ?? "System",
      createdAt: s.createdAt.toISOString(),
      scoreRuns: s._count.scoreRuns,
    })),
  };
}
