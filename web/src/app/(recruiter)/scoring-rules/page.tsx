import type { Metadata } from "next";
import { Suspense } from "react";
import { ToneBadge } from "@/components/tone-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getScoringOverview } from "@/lib/data/scoring";
import { RulesEditor } from "./rules-editor";

export const metadata: Metadata = { title: "Scoring rules" };

const fmt = (iso: string) => new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(new Date(iso));

export default function ScoringRulesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Scoring rules</h1>
        <p className="text-muted-foreground text-sm">
          The weights behind the preliminary score. Scores only sort applications — an admin reviews every one and makes every decision.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-[40rem] rounded-xl" aria-label="Loading scoring rules" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const o = await getScoringOverview();
  return (
    <>
      <RulesEditor key={o.active.version} initial={o.active.rules} activeVersion={o.active.version} openApplications={o.openApplications} />
      <Card>
        <CardHeader>
          <CardTitle>Version history</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-muted-foreground text-left text-xs">
                <th className="py-1 font-medium">Version</th>
                <th className="py-1 font-medium">Published</th>
                <th className="py-1 font-medium">By</th>
                <th className="py-1 font-medium">Notes</th>
                <th className="py-1 text-right font-medium">Scores made</th>
              </tr>
            </thead>
            <tbody>
              {o.history.map((h) => (
                <tr key={h.id} className="border-t align-top">
                  <td className="py-2">
                    <span className="font-semibold">v{h.version}</span> {h.active && <ToneBadge tone="success">Active</ToneBadge>}
                  </td>
                  <td className="py-2">{fmt(h.createdAt)}</td>
                  <td className="py-2">{h.createdBy}</td>
                  <td className="text-muted-foreground py-2">{h.notes}</td>
                  <td className="py-2 text-right tabular-nums">{h.scoreRuns}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}
