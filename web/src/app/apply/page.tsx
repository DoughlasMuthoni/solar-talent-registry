import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeftIcon, ClockIcon, ShieldCheckIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { attributionFromParams } from "@/lib/attribution";
import { trackFromParam } from "@/lib/qualifications";
import { uploadsEnabled } from "@/lib/uploads";
import { ApplicationForm } from "./application-form";

const TITLE = "Now hiring: solar PV technicians";
const DESCRIPTION =
  "Join Waterlift Solar's technician network across Kenya. Apply in about 10 minutes on your phone — EPRA-licensed (T1–T3) and qualified solar technicians welcome.";

export const metadata: Metadata = {
  title: "Apply — solar PV technicians",
  description: DESCRIPTION,
  // What Facebook, WhatsApp, LinkedIn, X etc. show when the advert link is shared.
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", siteName: "Waterlift Solar" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function ApplyPage({ searchParams }: PageProps<"/apply">) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <Link href="/" aria-label="Waterlift Solar home">
          <Logo variant="wordmark" className="w-32 sm:w-36" priority />
        </Link>
        <ThemeToggle />
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 pb-12">
        <Link href="/" className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm">
          <ArrowLeftIcon className="size-4" /> Back
        </Link>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-extrabold sm:text-3xl">Solar PV technician application</h1>
          <p className="text-muted-foreground">Tell us about your licence or qualifications and your installation experience. It takes about 10 minutes.</p>
          <p className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon className="size-4" /> Saves as you go
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheckIcon className="size-4" /> Reviewed by a person
            </span>
          </p>
        </div>
        <Suspense fallback={<Skeleton className="h-[34rem] rounded-xl" aria-label="Loading application form" />}>
          <FormWithAttribution searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function FormWithAttribution({ searchParams }: { searchParams: PageProps<"/apply">["searchParams"] }) {
  const params = await searchParams;
  return <ApplicationForm attribution={attributionFromParams(params)} uploadsEnabled={uploadsEnabled()} defaultTrack={trackFromParam(params.track)} />;
}
