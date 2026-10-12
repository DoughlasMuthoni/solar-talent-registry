import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ToneBadge } from "@/components/tone-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatNairobi } from "@/lib/nairobi-time";

export const metadata: Metadata = { title: "Assessments" };

const TYPE = { TECHNICAL: "Technical", PRACTICAL: "Practical" } as const;

export default function AssessmentsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Assessments</h1>
        <p className="text-muted-foreground text-sm">Technical and practical assessments. Schedule and record results from each candidate’s page.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" aria-label="Loading assessments" />}>
        <Lists />
      </Suspense>
    </div>
  );
}

async function Lists() {
  await connection();
  await requireAdmin();
  const now = new Date();
  const include = { application: { select: { id: true, reference: true, candidate: { select: { fullName: true, town: true } } } } } as const;
  const [upcoming, awaiting, recent] = await Promise.all([
    db.assessment.findMany({ where: { status: "SCHEDULED", scheduledAt: { gte: now } }, orderBy: { scheduledAt: "asc" }, include, take: 100 }),
    db.assessment.findMany({ where: { status: "SCHEDULED", scheduledAt: { lt: now } }, orderBy: { scheduledAt: "asc" }, include, take: 100 }),
    db.assessment.findMany({ where: { status: { not: "SCHEDULED" } }, orderBy: { completedAt: "desc" }, include, take: 50 }),
  ]);

  type Row = (typeof upcoming)[number];
  const table = (rows: Row[], empty: string, showResult = false) =>
    rows.length === 0 ? (
      <p className="text-muted-foreground text-sm">{empty}</p>
    ) : (
      <ul className="divide-y">
        {rows.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
            <div className="min-w-0">
              <Link href={`/candidates/${a.application.id}`} className="font-medium hover:underline">
                {a.application.candidate.fullName}
              </Link>
              <span className="text-muted-foreground">
                {" "}
                · {a.application.reference} · {a.application.candidate.town}
              </span>
              <p className="text-muted-foreground text-xs">
                {TYPE[a.type]} · {formatNairobi(a.scheduledAt, false)} · {a.location}
              </p>
            </div>
            {showResult ? (
              a.status === "COMPLETED" ? (
                <ToneBadge tone={a.result === "PASS" ? "success" : "danger"}>
                  {a.result === "PASS" ? "Pass" : "Fail"}
                  {a.score !== null ? ` · ${a.score}/100` : ""}
                </ToneBadge>
              ) : (
                <ToneBadge tone="neutral">{a.status === "NO_SHOW" ? "No-show" : "Cancelled"}</ToneBadge>
              )
            ) : (
              <ToneBadge tone="info">{TYPE[a.type]}</ToneBadge>
            )}
          </li>
        ))}
      </ul>
    );

  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        {[
          ["Upcoming", upcoming.length],
          ["Awaiting result", awaiting.length],
          ["Recorded (latest)", recent.length],
        ].map(([l, n]) => (
          <Card key={l as string} className="gap-1 py-5">
            <CardContent className="flex flex-col gap-1">
              <span className="text-muted-foreground text-sm">{l}</span>
              <span className="font-heading text-3xl font-bold tabular-nums">{n}</span>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className={awaiting.length ? "border-warning" : undefined}>
        <CardHeader>
          <CardTitle>Awaiting result</CardTitle>
          <CardDescription>The time has passed — open the candidate to record the outcome.</CardDescription>
        </CardHeader>
        <CardContent>{table(awaiting, "Nothing waiting. ✓")}</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Upcoming</CardTitle>
        </CardHeader>
        <CardContent>{table(upcoming, "No assessments scheduled. Schedule one from a candidate’s page.")}</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Recent results</CardTitle>
        </CardHeader>
        <CardContent>{table(recent, "No results recorded yet.", true)}</CardContent>
      </Card>
    </>
  );
}
