"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, Loader2Icon, ShieldCheckIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { supabaseBrowser } from "@/lib/auth/supabase-browser";

/** Second sign-in step: the 6-digit code from the admin's authenticator app. */
export default function MfaChallengePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const sb = supabaseBrowser();
    const { data: factors, error: listErr } = await sb.auth.mfa.listFactors();
    const factor = factors?.totp?.[0];
    if (listErr || !factor) {
      setBusy(false);
      return setError("Your session has expired. Sign in again.");
    }
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.replace(/\s/g, "") });
    setBusy(false);
    if (error) return setError("That code didn't match. Use the current 6-digit code from your authenticator app.");
    const next = new URLSearchParams(window.location.search).get("next");
    router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <Logo variant="wordmark" className="w-44" priority />
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-xl">Enter your code</CardTitle>
            <CardDescription>Open your authenticator app and enter the 6-digit code for Waterlift.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={verify} className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="code">6-digit code</FieldLabel>
                <Input id="code" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} className="text-lg tracking-widest" />
              </Field>
              {error && (
                <p role="alert" className="bg-destructive-soft text-destructive flex items-start gap-2 rounded-lg p-3 text-sm">
                  <AlertCircleIcon className="mt-0.5 size-4 shrink-0" /> {error}
                </p>
              )}
              <Button type="submit" size="lg" className="h-11" disabled={busy || code.replace(/\s/g, "").length !== 6}>
                {busy ? <Loader2Icon className="animate-spin" /> : <ShieldCheckIcon />} Verify
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
