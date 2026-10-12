"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { supabaseBrowser } from "@/lib/auth/supabase-browser";

/** Set or change password — reached from an invitation or password-reset email (session already established). */
export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 12) return setError("Use at least 12 characters.");
    if (password !== confirm) return setError("The two passwords do not match.");
    setBusy(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.updateUser({ password });
    setBusy(false);
    if (error) return setError("Could not save the password. Open the email link again and retry.");
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <Logo variant="wordmark" className="w-44" />
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-xl">Set your password</CardTitle>
            <CardDescription>For your Solar Talent Registry admin account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={save} className="flex flex-col gap-5">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="password">New password</FieldLabel>
                  <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  <FieldDescription>At least 12 characters. A passphrase of several words works well.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="confirm">Confirm password</FieldLabel>
                  <Input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                </Field>
              </FieldGroup>
              {error && (
                <p role="alert" className="bg-destructive-soft text-destructive flex items-start gap-2 rounded-lg p-3 text-sm">
                  <AlertCircleIcon className="mt-0.5 size-4 shrink-0" /> {error}
                </p>
              )}
              <Button type="submit" size="lg" disabled={busy} className="h-11">
                {busy && <Loader2Icon className="animate-spin" />} Save password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
