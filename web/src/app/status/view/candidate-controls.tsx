"use client";

import { useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { requestErasure, withdrawApplication } from "../actions";

export function CandidateControls({ token, canWithdraw, erasureRequested }: { token: string; canWithdraw: boolean; erasureRequested: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Something went wrong.");
      else setConfirming(false);
    });

  return (
    <div className="flex flex-col gap-4">
      {canWithdraw &&
        (confirming ? (
          <div className="flex flex-col gap-3 rounded-lg border p-4">
            <p className="text-sm font-medium">Withdraw your application? This cannot be undone — you would need to apply again.</p>
            <Field>
              <FieldLabel htmlFor="reason">Reason (optional)</FieldLabel>
              <Textarea id="reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" disabled={pending} onClick={() => run(() => withdrawApplication({ token, reason }))}>
                {pending && <Loader2Icon className="animate-spin" />} Yes, withdraw
              </Button>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={pending}>
                Keep my application
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" className="self-start" onClick={() => setConfirming(true)}>
            Withdraw my application
          </Button>
        ))}
      <div className="text-muted-foreground text-sm">
        {erasureRequested ? (
          <p>You have asked us to delete your data. We will confirm by email once it is done.</p>
        ) : (
          <p>
            Want your information deleted?{" "}
            <button type="button" className="text-link underline underline-offset-2" disabled={pending} onClick={() => run(() => requestErasure({ token }))}>
              Request deletion of my data
            </button>
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
