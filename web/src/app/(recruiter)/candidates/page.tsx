import type { Metadata } from "next";
import { Suspense } from "react";
import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listApplications } from "@/lib/data/applications";
import { CandidatesTable } from "./candidates-table";

export const metadata: Metadata = { title: "Candidates" };

export default function CandidatesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Candidates</h1>
          <p className="text-muted-foreground text-sm">Filter, sort and open an application to verify, assess and decide.</p>
        </div>
        <Button asChild variant="outline">
          {/* Plain <a>: a file download, not a client-side navigation. Each export is audited. */}
          <a href="/candidates/export" download>
            <DownloadIcon /> Export CSV
          </a>
        </Button>
      </div>
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" aria-label="Loading candidates" />}>
        <Candidates />
      </Suspense>
    </div>
  );
}

async function Candidates() {
  return <CandidatesTable rows={await listApplications()} />;
}
