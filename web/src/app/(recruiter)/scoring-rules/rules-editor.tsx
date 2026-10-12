"use client";

import { useMemo, useState, useTransition } from "react";
import { EyeIcon, Loader2Icon, RotateCcwIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";
import { ToneBadge } from "@/components/tone-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { QualificationLevel, ScreeningStatus } from "@/generated/prisma/enums";
import { QUALIFICATION_LEVEL, QUALIFICATION_LEVELS } from "@/lib/qualifications";
import { SCREENING_STATUS } from "@/lib/labels";
import { DEFAULT_QUALIFIED_TRACK, type ScoringRules, type TextRule } from "@/lib/scoring/rules";
import { maxPoints, scoringRulesSchema } from "@/lib/scoring/rules-schema";
import { previewRules, publishRules, type PreviewResult } from "./actions";

type Path = (string | number)[];
const get = (o: unknown, p: Path): unknown => p.reduce<unknown>((x, k) => (x as Record<string | number, unknown>)?.[k], o);
function set<T>(o: T, p: Path, v: unknown): T {
  const copy = structuredClone(o) as Record<string | number, unknown>;
  let cur = copy;
  p.slice(0, -1).forEach((k) => (cur = cur[k] as Record<string | number, unknown>));
  cur[p[p.length - 1]] = v;
  return copy as T;
}

const TEXT_RULES: { path: Path; label: string }[] = [
  { path: ["technical", "inverters"], label: "Inverter evidence" },
  { path: ["technical", "batteries"], label: "Battery evidence" },
  { path: ["technical", "logger"], label: "Logger / site audit" },
  { path: ["technical", "highVoltage"], label: "High-voltage work (only if claimed)" },
  { path: ["technical", "certifications"], label: "Certifications & safety" },
];
const VERIF_TEXT: { path: Path; label: string }[] = [
  { path: ["verification", "referees", 0], label: "Referee 1" },
  { path: ["verification", "referees", 1], label: "Referee 2" },
  { path: ["verification", "referees", 2], label: "Referee 3" },
  { path: ["verification", "largestProject"], label: "Largest project description" },
];
const STATUS_ORDER: ScreeningStatus[] = ["PRIORITY_REVIEW", "STANDARD_REVIEW", "NEEDS_CLARIFICATION", "BELOW_THRESHOLD", "INELIGIBLE_LICENCE"];

export function RulesEditor({ initial: stored, activeVersion, openApplications }: { initial: ScoringRules; activeVersion: number; openApplications: number }) {
  // Rule sets saved before tracks existed have no qualified-track gate; show the default they score with.
  const initial = useMemo<ScoringRules>(() => ({ ...stored, qualifiedTrack: stored.qualifiedTrack ?? DEFAULT_QUALIFIED_TRACK }), [stored]);
  const [rules, setRules] = useState<ScoringRules>(initial);
  const [preview, setPreview] = useState<Extract<PreviewResult, { ok: true }> | null>(null);
  const [notes, setNotes] = useState("");
  const [rescore, setRescore] = useState(true);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const max = maxPoints(rules);
  const check = useMemo(() => scoringRulesSchema.safeParse(rules), [rules]);
  const errors: Record<string, string> = { ...serverErrors };
  if (!check.success) for (const i of check.error.issues) errors[i.path.join(".")] ??= i.message;
  const dirty = JSON.stringify(rules) !== JSON.stringify(initial);

  const num = (path: Path, label: string, step = "1", hint?: string) => {
    const key = path.join(".");
    const value = get(rules, path) as number;
    return (
      <Field data-invalid={Boolean(errors[key])}>
        <FieldLabel htmlFor={key} className="text-xs">
          {label}
        </FieldLabel>
        <Input
          id={key}
          type="number"
          inputMode="decimal"
          step={step}
          value={Number.isFinite(value) ? value : ""}
          aria-invalid={Boolean(errors[key])}
          onChange={(e) => {
            setPreview(null);
            setServerErrors({});
            setRules((r) => set(r, path, e.target.value === "" ? Number.NaN : Number(e.target.value)));
          }}
        />
        {(errors[key] || hint) && <p className={`text-xs ${errors[key] ? "text-destructive" : "text-muted-foreground"}`}>{errors[key] ?? hint}</p>}
      </Field>
    );
  };

  const textRule = ({ path, label }: { path: Path; label: string }) => {
    const r = get(rules, path) as TextRule;
    return (
      <div key={path.join(".")} className="flex flex-col gap-2 rounded-lg border p-3">
        <p className="text-sm font-medium">
          {label} <span className="text-muted-foreground font-normal">· up to {r.points} pts</span>
        </p>
        <div className="grid grid-cols-3 gap-2">
          {num([...path, "minChars"], "Detail needed (chars)")}
          {num([...path, "points"], "Points if detailed")}
          {num([...path, "fallback"], "Points otherwise")}
        </div>
      </div>
    );
  };

  function runPreview() {
    start(async () => {
      const r = await previewRules(rules);
      if (r.ok) setPreview(r);
      else {
        setServerErrors(r.fieldErrors ?? {});
        toast.error(r.error);
      }
    });
  }

  function publish() {
    start(async () => {
      const r = await publishRules({ rules, notes, rescore });
      if (r.ok) {
        toast.success(`Published rules v${r.version}${r.rescored ? ` · re-scored ${r.rescored} applications` : ""}`);
        setNotes("");
        setPreview(null);
      } else {
        if ("fieldErrors" in r && r.fieldErrors) setServerErrors(r.fieldErrors);
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-secondary text-secondary-foreground flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg px-4 py-3 text-sm">
        <span>
          Editing a draft of <strong>v{activeVersion}</strong>
        </span>
        <span>
          Max points: experience {max.experience} · technical {max.technical} · verification {max.verification} ={" "}
          <strong className={max.raw === 100 ? "" : "text-destructive"}>{max.raw}</strong>
          {max.raw !== 100 && " (scores are capped at 100; aim for exactly 100)"}
        </span>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Experience</CardTitle>
            <CardDescription>Years, largest system size and range of installation types. Max {max.experience}.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {num(["experience", "pointsPerYear"], "Points per year", "0.5")}
            {num(["experience", "yearsCap"], "Max for years")}
            {num(["experience", "pvKwpPerPoint"], "kWp per point", "1", "e.g. 10 → 1 point per 10 kWp")}
            {num(["experience", "pvCap"], "Max for PV size")}
            {num(["experience", "pointsPerCategory"], "Points per category", "0.5")}
            {num(["experience", "categoriesCap"], "Max for categories")}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Thresholds & eligibility</CardTitle>
            <CardDescription>
              Where eligible applications are routed. The credential gate applies first: a valid EPRA licence on the EPRA track, a
              qualification at the minimum level on the qualified track.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-3">
              {num(["thresholds", "priority"], "Priority review from")}
              {num(["thresholds", "standard"], "Standard review from")}
              {num(["thresholds", "clarify"], "Clarification from")}
            </div>
            {errors["thresholds"] && <p className="text-destructive text-xs">{errors["thresholds"]}</p>}
            <p className="text-muted-foreground text-xs">Below the clarification threshold → “Below threshold”.</p>
            {num(["expiringWithinDays"], "Flag licences expiring within (days)")}
            <Field>
              <FieldLabel htmlFor="qualified-min-level" className="text-xs">
                Qualified track: minimum qualification
              </FieldLabel>
              <Select
                value={rules.qualifiedTrack?.minLevel ?? DEFAULT_QUALIFIED_TRACK.minLevel}
                onValueChange={(v) => {
                  setPreview(null);
                  setServerErrors({});
                  setRules((r) => ({ ...r, qualifiedTrack: { minLevel: v as QualificationLevel } }));
                }}
              >
                <SelectTrigger id="qualified-min-level" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUALIFICATION_LEVELS.filter((l) => l !== "OTHER").map((l) => (
                    <SelectItem key={l} value={l}>
                      {QUALIFICATION_LEVEL[l].label} or higher
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">Trade test and artisan rank equally. “Other course or training” never counts on its own.</p>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Technical capability</CardTitle>
            <CardDescription>Text length is only a proxy for evidence — assessors verify claims. Max {max.technical}.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">{TEXT_RULES.map(textRule)}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Verifiability & mobility</CardTitle>
            <CardDescription>Referees, project detail and willingness to travel. Max {max.verification}.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {VERIF_TEXT.map(textRule)}
            <div className="grid grid-cols-3 gap-2 rounded-lg border p-3">
              <p className="col-span-3 text-sm font-medium">Travel availability</p>
              {num(["verification", "travel", "COUNTY"], "Own county")}
              {num(["verification", "travel", "REGION"], "Region")}
              {num(["verification", "travel", "NATIONAL"], "Nationwide")}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Preview & publish</CardTitle>
          <CardDescription>
            Preview applies the draft to the {openApplications} open application{openApplications === 1 ? "" : "s"} without saving. Publishing creates v{activeVersion + 1}; earlier
            scores keep the version they were made with.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={runPreview} disabled={pending || !check.success}>
              {pending ? <Loader2Icon className="animate-spin" /> : <EyeIcon />} Preview impact
            </Button>
            <Button
              variant="ghost"
              disabled={!dirty || pending}
              onClick={() => {
                setRules(initial);
                setPreview(null);
                setServerErrors({});
              }}
            >
              <RotateCcwIcon /> Reset to v{activeVersion}
            </Button>
          </div>

          {preview && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="text-muted-foreground text-left text-xs">
                    <th className="py-1 font-medium">Screening group</th>
                    <th className="py-1 text-right font-medium">Now (v{activeVersion})</th>
                    <th className="py-1 text-right font-medium">With draft</th>
                    <th className="py-1 text-right font-medium">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {STATUS_ORDER.map((s) => {
                    const d = preview.draft[s] - preview.current[s];
                    return (
                      <tr key={s} className="border-t">
                        <td className="py-2">
                          <ToneBadge tone={SCREENING_STATUS[s].tone}>{SCREENING_STATUS[s].label}</ToneBadge>
                        </td>
                        <td className="py-2 text-right tabular-nums">{preview.current[s]}</td>
                        <td className="py-2 text-right tabular-nums">{preview.draft[s]}</td>
                        <td className={`py-2 text-right font-semibold tabular-nums ${d > 0 ? "text-success" : d < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {d > 0 ? `+${d}` : d}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-muted-foreground mt-2 text-xs">
                {preview.changed} of {preview.total} open applications would change group.
              </p>
            </div>
          )}

          <Field>
            <FieldLabel htmlFor="publish-notes">What changed and why (kept in the history)</FieldLabel>
            <Textarea id="publish-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Weight battery evidence higher for hybrid projects." />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={rescore} onCheckedChange={(v) => setRescore(v === true)} /> Re-score all open applications with the new rules now
          </label>
          <Button variant="brand" className="self-start" disabled={pending || !dirty || !check.success || notes.trim().length < 5} onClick={publish}>
            {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />} Publish as v{activeVersion + 1}
          </Button>
          {!dirty && <p className="text-muted-foreground text-xs">Change a value to create a new version.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
