import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdminForMfaSetup } from "@/lib/auth/session";
import { TwoFactorSetup } from "./two-factor-setup";

export const metadata: Metadata = { title: "Account security", robots: { index: false } };

export default function SecurityPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-10">
      <Logo variant="wordmark" className="w-40" />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <Content />
      </Suspense>
    </main>
  );
}

async function Content() {
  const admin = await requireAdminForMfaSetup();
  if (admin.mfa === "challenge") {
    // Has an authenticator but hasn't verified this session — the code prompt is elsewhere.
    const { redirect } = await import("next/navigation");
    redirect("/login/mfa");
  }
  const on = admin.mfa === "ok" && !admin.devBypass;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Two-factor authentication</CardTitle>
        <CardDescription>
          {on
            ? "Your admin account is protected with an authenticator app."
            : "Admin accounts can see candidates' personal data, so a second step is required: a code from an app on your phone."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {admin.devBypass ? (
          <p className="text-muted-foreground text-sm">Development mode without Supabase — two-factor applies once sign-in is connected.</p>
        ) : (
          <TwoFactorSetup alreadyOn={on} />
        )}
        {on && (
          <Link href="/dashboard" className="text-link inline-flex w-fit items-center gap-1 text-sm underline-offset-2 hover:underline">
            <ArrowLeftIcon className="size-4" /> Back to dashboard
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
