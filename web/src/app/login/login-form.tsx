"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, Loader2Icon, MailCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { supabaseBrowser } from "@/lib/auth/supabase-browser";

export function LoginForm({ next, initialError }: { next: string; initialError: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [resetSent, setResetSent] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      // Same message for unknown email and wrong password, so accounts can't be enumerated.
      setError("Email or password is incorrect.");
      return;
    }
    // Second step: an admin with an authenticator must enter a code before anything else.
    const { data: aal } = await supabaseBrowser().auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      router.replace(`/login/mfa?next=${encodeURIComponent(next)}`);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function forgot() {
    if (!email) {
      setError("Enter your email address first, then choose “Forgot password”.");
      return;
    }
    setBusy(true);
    await supabaseBrowser().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?type=recovery&next=/account/password`,
    });
    setBusy(false);
    setResetSent(true); // Always shown, whether or not the account exists.
  }

  return (
    <form onSubmit={signIn} className="flex flex-col gap-5">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
      </FieldGroup>
      {error && (
        <p role="alert" className="bg-destructive-soft text-destructive flex items-start gap-2 rounded-lg p-3 text-sm">
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}
      {resetSent && (
        <p role="status" className="bg-secondary text-secondary-foreground flex items-start gap-2 rounded-lg p-3 text-sm">
          <MailCheckIcon className="mt-0.5 size-4 shrink-0" /> If that email belongs to an admin, a reset link is on its way.
        </p>
      )}
      <Button type="submit" size="lg" disabled={busy} className="h-11">
        {busy && <Loader2Icon className="animate-spin" />} Sign in
      </Button>
      <Button type="button" variant="link" onClick={forgot} disabled={busy} className="self-center">
        Forgot password?
      </Button>
    </form>
  );
}
