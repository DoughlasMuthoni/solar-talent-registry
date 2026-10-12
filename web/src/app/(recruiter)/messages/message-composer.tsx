"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2Icon, SendIcon, UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EPRA_CLASS, SCREENING_STATUS, STAGE } from "@/lib/labels";
import { MAX_BULK_RECIPIENTS, MESSAGE_TEMPLATES } from "@/lib/message-templates";
import { TRACK } from "@/lib/qualifications";
import { REGION_NAMES } from "@/lib/reference/kenya";
import { countAudience, sendToApplication, sendToAudience } from "./actions";

type Audience = { stage: string; region: string; track: string; epraClass: string; status: string };

/** Message body editor with templates. Used for one candidate (applicationId) or a filtered group. */
export function MessageComposer({ applicationId, candidateName }: { applicationId?: string; candidateName?: string }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>({ stage: "all", region: "all", track: "all", epraClass: "all", status: "all" });
  const [count, setCount] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const single = Boolean(applicationId);

  useEffect(() => {
    if (single) return;
    let cancelled = false;
    countAudience(audience).then((r) => !cancelled && setCount(r.ok ? r.count : null));
    return () => {
      cancelled = true;
    };
  }, [audience, single]);

  const filter = (key: keyof Audience, label: string, options: [string, string][]) => (
    <Field>
      <FieldLabel htmlFor={`aud-${key}`} className="text-xs">
        {label}
      </FieldLabel>
      <Select
        value={audience[key]}
        onValueChange={(v) => {
          setConfirming(false);
          setAudience((a) => ({ ...a, [key]: v }));
        }}
      >
        <SelectTrigger id={`aud-${key}`} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any</SelectItem>
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );

  function send() {
    start(async () => {
      const r = single ? await sendToApplication({ applicationId: applicationId!, subject, body }) : await sendToAudience({ audience, subject, body });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const parts = [r.sent && `${r.sent} sent`, r.skipped && `${r.skipped} not sent (email not configured)`, r.failed && `${r.failed} failed`].filter(Boolean);
      (r.failed ? toast.warning : toast.success)(parts.join(" · ") || "Done");
      setConfirming(false);
      if (!r.failed) {
        setSubject("");
        setBody("");
      }
    });
  }

  const tooMany = !single && count !== null && count > MAX_BULK_RECIPIENTS;

  return (
    <div className="flex flex-col gap-4">
      {!single && (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {filter("stage", "Stage", Object.entries(STAGE))}
            {filter("region", "Region", REGION_NAMES.map((r) => [r, r]))}
            {filter("track", "Track", Object.entries(TRACK).map(([k, v]) => [k, v.short]))}
            {filter("epraClass", "Licence class", Object.entries(EPRA_CLASS))}
            {filter("status", "Screening", Object.entries(SCREENING_STATUS).map(([k, v]) => [k, v.label]))}
          </div>
          <p className={`flex items-center gap-2 text-sm ${tooMany ? "text-destructive" : "text-muted-foreground"}`}>
            <UsersIcon className="size-4" />
            {count === null ? "Counting…" : `${count} candidate${count === 1 ? "" : "s"} match`}
            {tooMany && ` — narrow to ${MAX_BULK_RECIPIENTS} or fewer`}
            {audience.stage === "all" && " (rejected and withdrawn are excluded unless you pick that stage)"}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {MESSAGE_TEMPLATES.map((t) => (
          <Button
            key={t.id}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSubject(t.subject);
              setBody(t.body);
              setConfirming(false);
            }}
          >
            {t.label}
          </Button>
        ))}
      </div>
      <Field>
        <FieldLabel htmlFor={`msg-subject-${applicationId ?? "bulk"}`}>Subject</FieldLabel>
        <Input id={`msg-subject-${applicationId ?? "bulk"}`} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={180} />
      </Field>
      <Field>
        <FieldLabel htmlFor={`msg-body-${applicationId ?? "bulk"}`}>Message</FieldLabel>
        <Textarea id={`msg-body-${applicationId ?? "bulk"}`} rows={8} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} />
        <FieldDescription>
          <code>{"{{name}}"}</code> becomes {candidateName ? `“${candidateName.split(" ")[0]}”` : "each candidate’s first name"} and <code>{"{{reference}}"}</code> their application reference. Replies go to
          the sender inbox.
        </FieldDescription>
      </Field>

      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
          <span className="mr-auto">{single ? `Send this email to ${candidateName}?` : `Send to ${count} candidate${count === 1 ? "" : "s"}? Each gets a personal copy.`}</span>
          <Button variant="outline" onClick={() => setConfirming(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={send} disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />} Send now
          </Button>
        </div>
      ) : (
        <Button
          className="self-start"
          disabled={pending || subject.trim().length < 3 || body.trim().length < 10 || (!single && (!count || tooMany))}
          onClick={() => setConfirming(true)}
        >
          <SendIcon /> {single ? "Send email" : "Review & send"}
        </Button>
      )}
    </div>
  );
}
