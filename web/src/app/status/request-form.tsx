"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, MailCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { requestStatusLink } from "./actions";

export function StatusRequestForm() {
  const [reference, setReference] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const website = (e.currentTarget.elements.namedItem("website") as HTMLInputElement | null)?.value;
        start(async () => {
          const r = await requestStatusLink({ reference, email, website });
          setMessage({ ok: r.ok, text: r.message });
        });
      }}
    >
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="reference">Reference number</FieldLabel>
          <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. KIA-T2-0007" autoCapitalize="characters" required />
          <FieldDescription>It was shown after you applied and is in your confirmation email.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="email">Email you applied with</FieldLabel>
          <Input id="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
      </FieldGroup>
      {message && (
        <p role="status" className={`flex items-start gap-2 rounded-lg p-3 text-sm ${message.ok ? "bg-secondary text-secondary-foreground" : "bg-destructive-soft text-destructive"}`}>
          {message.ok && <MailCheckIcon className="mt-0.5 size-4 shrink-0" />} {message.text}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} className="h-11">
        {pending && <Loader2Icon className="animate-spin" />} Email me a private link
      </Button>
    </form>
  );
}
