"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Stage, VerificationStatus } from "@/generated/prisma/enums";
import { QUALIFICATION_VERIFICATION, STAGE, VERIFICATION } from "@/lib/labels";
import { addNote, changeStage, rescore, verifyLicence, verifyQualification, type ActionResult } from "./actions";

function useAction() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<ActionResult>, success: string, onOk?: () => void) =>
    start(async () => {
      setError(null);
      const res = await fn().catch(() => ({ ok: false as const, error: "Could not save. Check your connection and try again." }));
      if (res.ok) {
        toast.success(success);
        onOk?.();
      } else setError(res.error);
    });
  return { pending, error, run };
}

function ErrorText({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-destructive text-sm">
      {error}
    </p>
  ) : null;
}

export function VerifyLicenceForm({ applicationId, status, evidenceNote }: { applicationId: string; status: VerificationStatus; evidenceNote: string | null }) {
  const [value, setValue] = useState<VerificationStatus>(status);
  const [note, setNote] = useState(evidenceNote ?? "");
  const { pending, error, run } = useAction();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => verifyLicence({ applicationId, status: value, evidenceNote: note }), "Licence verification saved");
      }}
    >
      <Field>
        <FieldLabel htmlFor="verify-status">Register check result</FieldLabel>
        <Select value={value} onValueChange={(v) => setValue(v as VerificationStatus)}>
          <SelectTrigger id="verify-status" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(VERIFICATION).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="verify-note">What you saw on the EPRA register</FieldLabel>
        <Textarea id="verify-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Class, status, expiry, date checked." />
        <FieldDescription>Required for every result except Pending.</FieldDescription>
      </Field>
      <ErrorText error={error} />
      <Button type="submit" disabled={pending} className="self-start">
        {pending && <Loader2Icon className="animate-spin" />} Save verification
      </Button>
    </form>
  );
}

/** Qualifications are checked with the institution or examining body (KNEC, NITA, TVET CDACC), not a public register. */
export function VerifyQualificationForm({
  applicationId,
  qualificationId,
  status,
  evidenceNote,
}: {
  applicationId: string;
  qualificationId: string;
  status: VerificationStatus;
  evidenceNote: string | null;
}) {
  const [value, setValue] = useState<VerificationStatus>(status);
  const [note, setNote] = useState(evidenceNote ?? "");
  const { pending, error, run } = useAction();
  const options = Object.entries(QUALIFICATION_VERIFICATION) as [Exclude<VerificationStatus, "EXPIRED">, string][];
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (value === "EXPIRED") return;
        run(() => verifyQualification({ applicationId, qualificationId, status: value, evidenceNote: note }), "Qualification check saved");
      }}
    >
      <Field>
        <FieldLabel htmlFor={`qv-${qualificationId}`}>Check result</FieldLabel>
        <Select value={value} onValueChange={(v) => setValue(v as VerificationStatus)}>
          <SelectTrigger id={`qv-${qualificationId}`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor={`qn-${qualificationId}`}>How you checked it</FieldLabel>
        <Textarea
          id={`qn-${qualificationId}`}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Original certificate seen; confirmed with the college registrar on 12 Oct."
        />
        <FieldDescription>Required for every result except Pending.</FieldDescription>
      </Field>
      <ErrorText error={error} />
      <Button type="submit" variant="outline" disabled={pending} className="self-start">
        {pending && <Loader2Icon className="animate-spin" />} Save check
      </Button>
    </form>
  );
}

export function StageForm({ applicationId, stage }: { applicationId: string; stage: Stage }) {
  const [value, setValue] = useState<Stage>(stage);
  const [reason, setReason] = useState("");
  const { pending, error, run } = useAction();
  const adverse = value === "REJECTED" || value === "WITHDRAWN";
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => changeStage({ applicationId, toStage: value, reason }), `Moved to ${STAGE[value]}`, () => setReason(""));
      }}
    >
      <Field>
        <FieldLabel htmlFor="stage">Pipeline stage</FieldLabel>
        <Select value={value} onValueChange={(v) => setValue(v as Stage)}>
          <SelectTrigger id="stage" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STAGE).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="stage-reason">Reason{adverse ? "" : " (optional)"}</FieldLabel>
        <Textarea id="stage-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        {adverse && <FieldDescription>Required. Recorded in the history; the candidate may ask for it.</FieldDescription>}
      </Field>
      <ErrorText error={error} />
      <Button type="submit" disabled={pending || value === stage} variant={adverse ? "destructive" : "default"} className="self-start">
        {pending && <Loader2Icon className="animate-spin" />} Update stage
      </Button>
    </form>
  );
}

export function NoteForm({ applicationId }: { applicationId: string }) {
  const [body, setBody] = useState("");
  const { pending, error, run } = useAction();
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => addNote({ applicationId, body }), "Note added", () => setBody(""));
      }}
    >
      <FieldLabel htmlFor="note" className="sr-only">
        Add a note
      </FieldLabel>
      <Textarea id="note" rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a note for other admins (calls, documents received, assessment results)…" />
      <ErrorText error={error} />
      <Button type="submit" variant="outline" disabled={pending || !body.trim()} className="self-end">
        {pending && <Loader2Icon className="animate-spin" />} Add note
      </Button>
    </form>
  );
}

export function RescoreButton({ applicationId }: { applicationId: string }) {
  const { pending, error, run } = useAction();
  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => rescore({ applicationId }), "Score recalculated")}>
        {pending ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />} Re-score
      </Button>
      <ErrorText error={error} />
    </div>
  );
}
