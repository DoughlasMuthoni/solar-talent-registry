"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon, Loader2Icon, ShieldCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { supabaseBrowser } from "@/lib/auth/supabase-browser";

type Enrollment = { factorId: string; qr: string; secret: string };

/** Set up an authenticator app (TOTP). Mandatory for admins; codes are free (no SMS). */
export function TwoFactorSetup({ alreadyOn }: { alreadyOn: boolean }) {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(alreadyOn);

  useEffect(() => {
    if (alreadyOn) return;
    let cancelled = false;
    (async () => {
      const sb = supabaseBrowser();
      // Remove half-finished attempts so a fresh QR code can be issued.
      const { data: factors } = await sb.auth.mfa.listFactors();
      for (const f of factors?.all ?? []) if (f.status !== "verified") await sb.auth.mfa.unenroll({ factorId: f.id });
      const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: `Authenticator ${Date.now()}` });
      if (cancelled) return;
      if (error || !data) return setError("Could not start set-up. Reload the page to try again.");
      setEnrollment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    })();
    return () => {
      cancelled = true;
    };
  }, [alreadyOn]);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!enrollment) return;
    setBusy(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.mfa.challengeAndVerify({ factorId: enrollment.factorId, code: code.replace(/\s/g, "") });
    setBusy(false);
    if (error) return setError("That code didn't match. Use the current 6-digit code from the app (they change every 30 seconds).");
    setDone(true);
    router.replace("/dashboard");
    router.refresh();
  }

  if (done)
    return (
      <div className="flex flex-col gap-3">
        <p className="text-success flex items-center gap-2 font-medium">
          <CheckCircle2Icon className="size-5" /> Two-factor authentication is on.
        </p>
        <p className="text-muted-foreground text-sm">Each sign-in asks for the 6-digit code from your authenticator app. If you lose your phone, ask another admin to reset it in Supabase (Authentication → Users → your account → MFA factors).</p>
      </div>
    );

  return (
    <div className="flex flex-col gap-5">
      <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-sm">
        <li>Install an authenticator app on your phone (Google Authenticator, Microsoft Authenticator or similar — free).</li>
        <li>Scan the QR code below with the app (or type the key).</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      {enrollment ? (
        <div className="flex flex-wrap items-start gap-5">
          {/* eslint-disable-next-line @next/next/no-img-element -- Supabase returns an SVG data URI */}
          <img src={enrollment.qr} alt="QR code for your authenticator app" width={176} height={176} className="rounded-lg border bg-white p-2" />
          <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
            <span className="text-muted-foreground">Can&apos;t scan? Enter this key in the app:</span>
            <code className="bg-muted rounded-md px-2 py-1 font-mono text-xs break-all select-all">{enrollment.secret}</code>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2Icon className="size-4 animate-spin" /> Preparing your QR code…
        </p>
      )}
      <form onSubmit={verify} className="flex flex-col gap-3">
        <Field>
          <FieldLabel htmlFor="totp">6-digit code</FieldLabel>
          <Input id="totp" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} className="w-40 text-lg tracking-widest" />
          <FieldDescription>Codes refresh every 30 seconds.</FieldDescription>
        </Field>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy || !enrollment || code.replace(/\s/g, "").length !== 6} className="self-start">
          {busy ? <Loader2Icon className="animate-spin" /> : <ShieldCheckIcon />} Turn on two-factor
        </Button>
      </form>
    </div>
  );
}
