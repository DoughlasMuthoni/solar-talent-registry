import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CheckCircle2Icon, CircleIcon, CircleDotIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ToneBadge } from "@/components/tone-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Stage } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { verifyStatusToken } from "@/lib/status-token";
import { CandidateControls } from "./candidate-controls";

// The token is in the URL: never leak it to other sites via Referer, never index the page.
export const metadata: Metadata = { title: "Your application", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** What candidates see — plain language, no internal scores or screening labels. */
const PUBLIC_STAGE: Record<Stage, { label: string; step: number; tone: "info" | "success" | "neutral" | "danger" }> = {
  NEW: { label: "Received — under review", step: 1, tone: "info" },
  TECHNICAL_ASSESSMENT: { label: "Assessment stage", step: 2, tone: "info" },
  PRACTICAL_ASSESSMENT: { label: "Assessment stage", step: 2, tone: "info" },
  REFERENCE_CHECKS: { label: "Reference checks", step: 3, tone: "info" },
  APPROVED_POOL: { label: "Approved — in our technician pool", step: 4, tone: "success" },
  REJECTED: { label: "Not progressing at this time", step: 0, tone: "neutral" },
  WITHDRAWN: { label: "Withdrawn", step: 0, tone: "neutral" },
};
const STEPS = ["Application received", "Licence/qualification check & assessment", "Reference checks", "Approved pool"];

const fmt = (d: Date) => new Intl.DateTimeFormat("en-KE", { dateStyle: "long", timeZone: "Africa/Nairobi" }).format(d);

export default function StatusViewPage({ searchParams }: PageProps<"/status/view">) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-10">
      <Logo variant="wordmark" className="w-40" />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" aria-label="Loading your application" />}>
        <View searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function View({ searchParams }: { searchParams: PageProps<"/status/view">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const id = verifyStatusToken(token);
  const app = id
    ? await db.application.findUnique({ where: { id }, include: { candidate: { select: { fullName: true } }, licence: { select: { status: true } }, qualifications: { select: { status: true } } } })
    : null;

  if (!app) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">This link has expired</CardTitle>
          <CardDescription>Status links are valid for 30 days. Request a new one with your reference number and email.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/status">Get a new link</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const erasureRequested = (await db.auditEvent.count({ where: { entityType: "Application", entityId: app.id, action: "candidate.erasure_requested" } })) > 0;
  const s = PUBLIC_STAGE[app.stage];
  const closed = app.stage === "WITHDRAWN" || app.stage === "REJECTED";

  return (
    <Card>
      <CardHeader>
        <CardDescription className="font-mono">{app.reference}</CardDescription>
        <CardTitle className="text-xl">Hello {app.candidate.fullName.split(" ")[0]}</CardTitle>
        <p className="text-muted-foreground text-sm">Applied {fmt(app.submittedAt)}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <span className="text-muted-foreground text-sm">Current status</span>
          <ToneBadge tone={s.tone} className="self-start text-sm">
            {s.label}
          </ToneBadge>
        </div>
        {!closed && (
          <ol className="flex flex-col gap-3">
            {STEPS.map((label, i) => {
              const n = i + 1;
              const Icon = n < s.step ? CheckCircle2Icon : n === s.step ? CircleDotIcon : CircleIcon;
              return (
                <li key={label} className={`flex items-center gap-3 text-sm ${n <= s.step ? "text-foreground" : "text-muted-foreground"}`}>
                  <Icon className={`size-5 ${n < s.step ? "text-success" : n === s.step ? "text-primary" : ""}`} aria-hidden />
                  <span>
                    {label}
                    {n === s.step && <span className="sr-only"> (current step)</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        {app.licence?.status === "VERIFIED" && <p className="text-sm">✓ Your EPRA licence has been verified.</p>}
        {app.qualifications.some((q) => q.status === "VERIFIED") && <p className="text-sm">✓ Your qualifications have been verified.</p>}
        <p className="text-muted-foreground text-sm">A person reviews every application. We will contact you by phone or email about next steps.</p>
        <CandidateControls token={token} canWithdraw={!closed} erasureRequested={erasureRequested} />
      </CardContent>
    </Card>
  );
}
