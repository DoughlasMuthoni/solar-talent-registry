"use client";

import { useState, useTransition } from "react";
import { CalendarPlusIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { recordAssessment, scheduleAssessment } from "./actions";

export function ScheduleAssessmentForm({ applicationId, defaultType }: { applicationId: string; defaultType: "TECHNICAL" | "PRACTICAL" }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"TECHNICAL" | "PRACTICAL">(defaultType);
  const [when, setWhen] = useState("");
  const [location, setLocation] = useState("");
  const [instructions, setInstructions] = useState("");
  const [notify, setNotify] = useState(true);
  const [pending, start] = useTransition();

  if (!open)
    return (
      <Button variant="outline" onClick={() => setOpen(true)} className="self-start">
        <CalendarPlusIcon /> Schedule assessment
      </Button>
    );

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await scheduleAssessment({ applicationId, type, scheduledAt: when, location, instructions, notify });
          if (!r.ok) return void toast.error(r.error);
          toast.success(notify ? "Assessment scheduled · invitation emailed" : "Assessment scheduled");
          setOpen(false);
          setWhen("");
          setLocation("");
          setInstructions("");
        });
      }}
    >
      <RadioGroup value={type} onValueChange={(v) => setType(v as typeof type)} className="flex gap-4">
        <label className="flex items-center gap-2 text-sm">
          <RadioGroupItem value="TECHNICAL" /> Technical
        </label>
        <label className="flex items-center gap-2 text-sm">
          <RadioGroupItem value="PRACTICAL" /> Practical (hands-on)
        </label>
      </RadioGroup>
      <Field>
        <FieldLabel htmlFor={`when-${applicationId}`}>Date & time (Nairobi)</FieldLabel>
        <Input id={`when-${applicationId}`} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required />
      </Field>
      <Field>
        <FieldLabel htmlFor={`where-${applicationId}`}>Location</FieldLabel>
        <Input id={`where-${applicationId}`} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Waterlift yard, Thika Road" required />
      </Field>
      <Field>
        <FieldLabel htmlFor={`instr-${applicationId}`}>Instructions for the candidate (optional)</FieldLabel>
        <Textarea id={`instr-${applicationId}`} rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="What to bring, who to ask for…" />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={notify} onCheckedChange={(v) => setNotify(v === true)} /> Email the invitation to the candidate
      </label>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" />} Schedule
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function RecordResultForm({ assessmentId }: { assessmentId: string }) {
  const [status, setStatus] = useState<"COMPLETED" | "NO_SHOW" | "CANCELLED">("COMPLETED");
  const [result, setResult] = useState<"PASS" | "FAIL" | "">("");
  const [score, setScore] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await recordAssessment({
            assessmentId,
            status,
            result: result || undefined,
            score: score === "" ? undefined : Number(score),
            notes,
          });
          if (!r.ok) return void toast.error(r.error);
          toast.success("Result recorded");
        });
      }}
    >
      <RadioGroup value={status} onValueChange={(v) => setStatus(v as typeof status)} className="flex flex-wrap gap-4">
        {(
          [
            ["COMPLETED", "Took place"],
            ["NO_SHOW", "No-show"],
            ["CANCELLED", "Cancelled"],
          ] as const
        ).map(([v, l]) => (
          <label key={v} className="flex items-center gap-2 text-sm">
            <RadioGroupItem value={v} /> {l}
          </label>
        ))}
      </RadioGroup>
      {status === "COMPLETED" && (
        <div className="flex flex-wrap items-end gap-3">
          <RadioGroup value={result} onValueChange={(v) => setResult(v as "PASS" | "FAIL")} className="flex gap-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <RadioGroupItem value="PASS" /> Pass
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <RadioGroupItem value="FAIL" /> Fail
            </label>
          </RadioGroup>
          <Field className="w-28">
            <FieldLabel htmlFor={`score-${assessmentId}`} className="text-xs">
              Score /100 (optional)
            </FieldLabel>
            <Input id={`score-${assessmentId}`} type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} />
          </Field>
        </div>
      )}
      <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Assessor notes (what went well, gaps, safety observations)" aria-label="Assessor notes" />
      <Button type="submit" size="sm" disabled={pending || (status === "COMPLETED" && !result)} className="self-start">
        {pending && <Loader2Icon className="animate-spin" />} Save result
      </Button>
    </form>
  );
}
