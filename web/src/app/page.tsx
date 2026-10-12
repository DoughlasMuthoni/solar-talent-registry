import Link from "next/link";
import { BadgeCheckIcon, MapPinIcon, ShieldCheckIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

const POINTS = [
  { icon: BadgeCheckIcon, title: "Licensed and qualified", body: "EPRA T1–T3 licensed technicians, and qualified solar technicians with a certificate, diploma or degree." },
  { icon: MapPinIcon, title: "All 47 counties", body: "Regional and nationwide roles for installation, maintenance and solar pumping." },
  { icon: ShieldCheckIcon, title: "Fair, human review", body: "Automated screening only sorts applications. A recruiter makes every decision." },
];

export default function Home() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <Logo variant="wordmark" className="w-36" priority />
        <ThemeToggle />
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center gap-12 px-4 py-10 text-center sm:py-16">
        <Logo variant="full" className="w-full max-w-md" priority />
        <div className="flex max-w-2xl flex-col gap-4">
          <h1 className="text-3xl font-extrabold sm:text-4xl">Join the Waterlift Solar technician network</h1>
          <p className="text-muted-foreground text-lg">
            We are recruiting EPRA-licensed and qualified solar PV technicians across Kenya. Apply once and we will match you to projects in your region.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild variant="brand" size="lg" className="h-11 px-6 text-base">
            <Link href="/apply">Apply as a technician</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-11 px-6 text-base">
            <Link href="/dashboard">Recruiter dashboard</Link>
          </Button>
        </div>
        <p className="text-muted-foreground -mt-6 text-sm">
          Already applied?{" "}
          <Link href="/status" className="text-link font-medium underline underline-offset-2">
            Check your application
          </Link>
        </p>
        <ul className="grid w-full gap-4 text-left sm:grid-cols-3">
          {POINTS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="bg-card flex flex-col gap-2 rounded-xl border p-5">
              <Icon className="text-primary size-5" />
              <h2 className="font-semibold">{title}</h2>
              <p className="text-muted-foreground text-sm">{body}</p>
            </li>
          ))}
        </ul>
      </main>

      <footer className="text-muted-foreground px-4 py-6 text-center text-xs">
        Waterlift Solar · Equitable access to solar energy and borehole drilling
      </footer>
    </div>
  );
}
