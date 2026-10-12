import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeNext } from "@/lib/auth/safe-next";
import { authConfigured } from "@/lib/auth/supabase";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Admin sign-in", robots: { index: false } };

const ERRORS: Record<string, string> = {
  link: "That link is invalid or has expired. Request a new one.",
  "not-admin": "This account does not have admin access.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <Logo variant="wordmark" className="w-44" priority />
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-xl">Admin sign-in</CardTitle>
            <CardDescription>Solar Talent Registry</CardDescription>
          </CardHeader>
          <CardContent>
            {authConfigured ? (
              <Suspense>
                <Form searchParams={searchParams} />
              </Suspense>
            ) : (
              <div className="flex flex-col gap-4 text-sm">
                <p className="text-muted-foreground">
                  Sign-in is not connected yet. Add the Supabase keys to the environment (see <code>.env.example</code>).
                </p>
                {process.env.NODE_ENV !== "production" && (
                  <Button asChild>
                    <Link href="/dashboard">Continue as development admin</Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

async function Form({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  const error = typeof sp.error === "string" ? (ERRORS[sp.error] ?? null) : null;
  return <LoginForm next={next} initialError={error} />;
}
