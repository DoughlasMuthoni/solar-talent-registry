import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRightIcon, CalendarClockIcon, InfoIcon } from "lucide-react";
import { ToneBadge } from "@/components/tone-badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboardSummary } from "@/lib/data/applications";
import { SCREENING_STATUS, SOURCE, STAGE } from "@/lib/labels";
import { TRACK } from "@/lib/qualifications";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Technician pipeline across all Kenyan regions.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/candidates">
            View candidates <ArrowRightIcon />
          </Link>
        </Button>
      </div>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

async function DashboardContent() {
  const s = await getDashboardSummary();
  const maxStage = Math.max(1, ...s.byStage.map((x) => x.count));
  const maxStatus = Math.max(1, ...s.byStatus.map((x) => x.count));

  return (
    <>
      {s.hasDemoData && (
        <p className="bg-secondary text-secondary-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
          <InfoIcon className="size-4 shrink-0" /> Showing fictional demo records from the development seed.
        </p>
      )}

      <section aria-label="Key figures" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Applications"
          value={s.total}
          note={s.byTrack.map((x) => `${x.count} ${TRACK[x.track].short}`).join(" · ")}
        />
        <Stat label="Credentials verified" value={s.verified} note="Licence or qualification confirmed" />
        <Stat label="Priority review" value={s.priority} note="Score 80+ and eligible" />
        <Stat label="Licences expiring" value={s.expiringSoon.length} note="Within 90 days" />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pipeline</CardTitle>
            <CardDescription>Applications at each assessment stage.</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              rows={s.byStage.map((x) => ({ key: x.stage, label: STAGE[x.stage], value: x.count }))}
              max={maxStage}
              barClass="bg-primary"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preliminary screening</CardTitle>
            <CardDescription>Latest automated score per application. A recruiter reviews every outcome.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {s.byStatus.map(({ status, count }) => {
                const meta = SCREENING_STATUS[status];
                return (
                  <li key={status} title={meta.hint} className="grid grid-cols-[minmax(0,11rem)_1fr_2rem] items-center gap-3">
                    <ToneBadge tone={meta.tone} className="justify-self-start">
                      {meta.label}
                    </ToneBadge>
                    <Meter value={count} max={maxStatus} barClass="bg-brand-sky" />
                    <span className="text-right text-sm font-semibold tabular-nums">{count}</span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Where applicants come from</CardTitle>
          <CardDescription>Applications by advert channel, from the ?src= / utm_source tag on each share link.</CardDescription>
        </CardHeader>
        <CardContent>
          {s.bySource.length === 0 ? (
            <p className="text-muted-foreground text-sm">No applications yet.</p>
          ) : (
            <BarList
              rows={s.bySource.map((x) => ({ key: x.source, label: SOURCE[x.source], value: x.count }))}
              max={Math.max(1, ...s.bySource.map((x) => x.count))}
              barClass="bg-chart-1"
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClockIcon className="text-muted-foreground size-4" /> Licences expiring within 90 days
          </CardTitle>
          <CardDescription>Ask these technicians for renewal evidence before assigning work.</CardDescription>
          <CardAction>
            <Button asChild variant="ghost" size="sm">
              <Link href="/candidates">All candidates</Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {s.expiringSoon.length === 0 ? (
            <p className="text-muted-foreground text-sm">No licences expire in the next 90 days.</p>
          ) : (
            <ul className="divide-y">
              {s.expiringSoon.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span>
                    <Link href={`/candidates/${r.id}`} className="font-medium underline-offset-2 hover:underline">
                      {r.fullName}
                    </Link>{" "}
                    <span className="text-muted-foreground">
                      · {r.reference} · {r.town}
                    </span>
                  </span>
                  <ToneBadge tone={r.daysToExpiry! <= 30 ? "danger" : "warning"}>
                    {r.daysToExpiry === 0 ? "Expires today" : `${r.daysToExpiry} days left`}
                  </ToneBadge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Stat({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <Card className="gap-1 py-5">
      <CardContent className="flex flex-col gap-1">
        <span className="text-muted-foreground text-sm">{label}</span>
        <span className="font-heading text-3xl font-bold tabular-nums">{value}</span>
        <span className="text-muted-foreground text-xs">{note}</span>
      </CardContent>
    </Card>
  );
}

function Meter({ value, max, barClass }: { value: number; max: number; barClass: string }) {
  return (
    <div className="bg-muted h-2 overflow-hidden rounded-full" aria-hidden>
      <div className={`h-full rounded-full ${barClass}`} style={{ width: `${(value / max) * 100}%` }} />
    </div>
  );
}

function BarList({ rows, max, barClass }: { rows: { key: string; label: string; value: number }[]; max: number; barClass: string }) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.key} title={`${r.label}: ${r.value}`} className="grid grid-cols-[minmax(0,11rem)_1fr_2rem] items-center gap-3 text-sm">
          <span className="truncate">{r.label}</span>
          <Meter value={r.value} max={max} barClass={barClass} />
          <span className="text-right font-semibold tabular-nums">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-label="Loading dashboard">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}
