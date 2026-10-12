"use client";

import { useEffect, useRef, useState } from "react";
import { Controller, useFieldArray, useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircleIcon, ArrowLeftIcon, ArrowRightIcon, CheckCircle2Icon, Loader2Icon, PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Attribution } from "@/lib/attribution";
import { CATEGORY } from "@/lib/labels";
import { CONSENT_TEXT } from "@/lib/privacy";
import { MAX_QUALIFICATIONS, QUALIFICATION_LEVEL, QUALIFICATION_LEVELS, TRACK } from "@/lib/qualifications";
import type { Track } from "@/generated/prisma/enums";
import { COUNTIES } from "@/lib/reference/kenya";
import { APPLICATION_STEPS, applicationSchema, type Application, type ApplicationInput } from "@/lib/validation/application";
import { submitApplication } from "./actions";
import { DocumentUploader, type UploadItem } from "./document-uploader";

const DRAFT_KEY = "wls.apply.draft.v1";
type Draft = { values: Partial<ApplicationInput>; step: number; submissionKey: string; uploads?: UploadItem[] };

/** Fields shown on each step — used for per-step validation and focusing the first error. */
const STEP_FIELDS: FieldPath<ApplicationInput>[][] = [
  ["fullName", "phone", "email", "town", "county", "travel", "engagement"],
  ["track", "epraClass", "licenceNumber", "licenceExpiresOn", "licenceIssue", "qualifications", "licenceVerificationConsent"],
  ["yearsExperience", "largestPvKwp", "largestInverterKw", "largestBatteryKwh", "categories", "largestProject"],
  ["inverters", "batteries", "loggerExperience", "voltageExperience", "certifications", "energyAuditor", "highVoltage"],
  ["referee1", "referee2", "referee3", "recruitmentConsent", "talentPoolConsent"],
];

const DEFAULTS: Partial<ApplicationInput> = {
  travel: "COUNTY",
  engagement: "ANY",
  categories: [],
  qualifications: [],
  energyAuditor: false,
  highVoltage: false,
  talentPoolConsent: false,
};

/** Consents are never restored from a draft — the candidate must tick them in this session. */
const NOT_SAVED = ["licenceVerificationConsent", "recruitmentConsent"] as const;

const EMPTY_QUALIFICATION = { level: undefined as never, field: "", institution: "", yearCompleted: undefined as never, certificateNumber: "" };

const newKey = () => crypto.randomUUID().replace(/-/g, "");
const optionalNumber = (v: unknown) => (v === "" || v === null || v === undefined ? undefined : Number(v));
const requiredNumber = (v: unknown) => (v === "" || v === null || v === undefined ? Number.NaN : Number(v));

function readDraft(): Draft | null {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null") as Draft | null;
    return d && typeof d === "object" && typeof d.submissionKey === "string" ? d : null;
  } catch {
    return null;
  }
}

export function ApplicationForm({
  attribution,
  uploadsEnabled = false,
  defaultTrack,
}: {
  attribution: Attribution;
  uploadsEnabled?: boolean;
  /** From `?track=` on the advert link; the candidate can still change it. */
  defaultTrack?: Track;
}) {
  const [step, setStep] = useState(0);
  const [restored, setRestored] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [key, setKey] = useState("");
  const submissionKey = useRef<string>("");
  const honeypot = useRef<HTMLInputElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const form = useForm<ApplicationInput, unknown, Application>({
    resolver: zodResolver(applicationSchema),
    mode: "onTouched",
    defaultValues: { ...DEFAULTS, track: defaultTrack },
  });
  const { register, control, handleSubmit, getValues, setError, clearErrors, setFocus, reset, watch, setValue, formState } = form;
  const qualifications = useFieldArray({ control, name: "qualifications" });
  const { errors } = formState;

  // Restore a draft saved on this device (after hydration, so server and client markup match).
  useEffect(() => {
    const d = readDraft();
    submissionKey.current = d?.submissionKey ?? newKey();
    setKey(submissionKey.current);
    if (d?.uploads) setUploads(d.uploads);
    if (d) {
      reset({ ...DEFAULTS, track: defaultTrack, ...d.values });
      setStep(Math.min(Math.max(d.step, 0), APPLICATION_STEPS.length - 1));
      setRestored(true);
    }
  }, [reset, defaultTrack]);

  // Clear a field's error as soon as the person edits it. Otherwise the message only disappears
  // on blur — i.e. when they tap "Continue" — and the layout shift makes the tap miss the button.
  useEffect(() => {
    const sub = watch((_, { name }) => {
      if (!name) return;
      const top = name.split(".")[0] as FieldPath<ApplicationInput>;
      if ((form.formState.errors as Record<string, unknown>)[top]) clearErrors(top);
    });
    return () => sub.unsubscribe();
  }, [watch, clearErrors, form.formState]);

  // Autosave on change (debounced). Stored only in this browser; consents are excluded.
  const values = watch();
  useEffect(() => {
    if (reference) return;
    const t = setTimeout(() => {
      const v: Partial<ApplicationInput> = { ...values };
      for (const k of NOT_SAVED) delete v[k];
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ values: v, step, submissionKey: submissionKey.current, uploads } satisfies Draft));
      } catch {
        /* storage full or blocked — the form still works */
      }
    }, 600);
    return () => clearTimeout(t);
  }, [values, step, reference, uploads]);

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  function validateStep(i: number) {
    const result = APPLICATION_STEPS[i].schema.safeParse(getValues());
    clearErrors(STEP_FIELDS[i]);
    if (result.success) return true;
    for (const issue of result.error.issues) {
      setError(issue.path.join(".") as FieldPath<ApplicationInput>, { type: "manual", message: issue.message });
    }
    const first = STEP_FIELDS[i].find((f) => result.error.issues.some((x) => x.path[0] === f));
    if (first && first !== "qualifications") setFocus(first);
    return false;
  }

  function next() {
    if (!validateStep(step)) return;
    setStep((s) => s + 1);
    scrollTop();
  }

  function back() {
    setStep((s) => s - 1);
    scrollTop();
  }

  const onSubmit = handleSubmit(async (data) => {
    setSubmitting(true);
    setFormError(null);
    const res = await submitApplication({
      values: data,
      attribution,
      submissionKey: submissionKey.current,
      website: honeypot.current?.value,
      uploads: uploads.map(({ path, kind, fileName }) => ({ path, kind, fileName })),
    }).catch(() => ({ ok: false as const, error: "Network problem — check your connection and try again. Your answers are saved." }));
    setSubmitting(false);
    if (res.ok) {
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      setReference(res.reference);
      scrollTop();
      return;
    }
    setFormError(res.error);
    if ("fieldErrors" in res && res.fieldErrors) {
      for (const [k, message] of Object.entries(res.fieldErrors)) setError(k as FieldPath<ApplicationInput>, { type: "server", message });
      const firstStep = STEP_FIELDS.findIndex((fields) => fields.some((f) => res.fieldErrors![f]));
      if (firstStep >= 0) setStep(firstStep);
    }
  }, () => {
    // Full-schema check failed on the last step — jump to the first step with a problem.
    const errs = form.formState.errors as Record<string, unknown>;
    const firstStep = STEP_FIELDS.findIndex((fields) => fields.some((f) => errs[f]));
    if (firstStep >= 0 && firstStep !== step) setStep(firstStep);
  });

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
    submissionKey.current = newKey();
    setKey(submissionKey.current);
    setUploads([]);
    reset({ ...DEFAULTS, track: defaultTrack });
    setStep(0);
    setRestored(false);
  }

  if (reference) return <Success reference={reference} />;

  const current = APPLICATION_STEPS[step];
  const track = watch("track");
  const err = (name: FieldPath<ApplicationInput>) => {
    const e = name.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], errors) as
      | { message?: string }
      | undefined;
    return e ? [e] : undefined;
  };
  const invalid = (name: FieldPath<ApplicationInput>) => Boolean(err(name));

  return (
    <div ref={topRef} className="scroll-mt-4">
      <Card>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="text-muted-foreground flex items-center justify-between text-sm">
              <span className="text-foreground font-semibold">{current.title}</span>
              <span>
                Step {step + 1} of {APPLICATION_STEPS.length}
              </span>
            </div>
            <Progress
              value={((step + 1) / APPLICATION_STEPS.length) * 100}
              aria-label={`Step ${step + 1} of ${APPLICATION_STEPS.length}`}
              className="[&>[data-slot=progress-indicator]]:bg-brand-orange"
            />
            {restored && (
              <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
                <SaveIcon className="size-3.5" /> We restored your saved answers on this device.
                <button type="button" onClick={clearDraft} className="text-link underline underline-offset-2">
                  Start again
                </button>
              </p>
            )}
          </div>

          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
            {/* Honeypot: hidden from people and assistive tech; bots tend to fill it. */}
            <input ref={honeypot} name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

            {step === 0 && (
              <FieldGroup>
                <Field data-invalid={invalid("fullName")}>
                  <FieldLabel htmlFor="fullName">Full legal name</FieldLabel>
                  <Input id="fullName" autoComplete="name" aria-invalid={invalid("fullName")} {...register("fullName")} />
                  <FieldError errors={err("fullName")} />
                </Field>
                <div className="grid gap-6 sm:grid-cols-2">
                  <Field data-invalid={invalid("phone")}>
                    <FieldLabel htmlFor="phone">WhatsApp / mobile number</FieldLabel>
                    <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0712 345 678" aria-invalid={invalid("phone")} {...register("phone")} />
                    <FieldError errors={err("phone")} />
                  </Field>
                  <Field data-invalid={invalid("email")}>
                    <FieldLabel htmlFor="email">Email address</FieldLabel>
                    <Input id="email" type="email" inputMode="email" autoComplete="email" aria-invalid={invalid("email")} {...register("email")} />
                    <FieldError errors={err("email")} />
                  </Field>
                  <Field data-invalid={invalid("town")}>
                    <FieldLabel htmlFor="town">Current town</FieldLabel>
                    <Input id="town" autoComplete="address-level2" aria-invalid={invalid("town")} {...register("town")} />
                    <FieldError errors={err("town")} />
                  </Field>
                  <Field data-invalid={invalid("county")}>
                    <FieldLabel htmlFor="county">County</FieldLabel>
                    <Controller
                      control={control}
                      name="county"
                      render={({ field }) => (
                        <Select value={field.value ?? ""} onValueChange={field.onChange}>
                          <SelectTrigger id="county" ref={field.ref} onBlur={field.onBlur} aria-invalid={invalid("county")} className="w-full">
                            <SelectValue placeholder="Select your county" />
                          </SelectTrigger>
                          <SelectContent>
                            {COUNTIES.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <FieldError errors={err("county")} />
                  </Field>
                </div>
                <Controller
                  control={control}
                  name="travel"
                  render={({ field }) => (
                    <FieldSet>
                      <FieldLegend variant="label">Where can you work?</FieldLegend>
                      <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-2 sm:grid-cols-3">
                        {(
                          [
                            ["COUNTY", "My county only"],
                            ["REGION", "Across my region"],
                            ["NATIONAL", "Anywhere in Kenya"],
                          ] as const
                        ).map(([v, l]) => (
                          <ChoiceCard key={v} id={`travel-${v}`} label={l}>
                            <RadioGroupItem id={`travel-${v}`} value={v} />
                          </ChoiceCard>
                        ))}
                      </RadioGroup>
                    </FieldSet>
                  )}
                />
                <Field>
                  <FieldLabel htmlFor="engagement">Preferred type of work</FieldLabel>
                  <Controller
                    control={control}
                    name="engagement"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="engagement" className="w-full sm:w-72">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PERMANENT">Permanent employment</SelectItem>
                          <SelectItem value="REGIONAL_RETAINER">Regional retainer</SelectItem>
                          <SelectItem value="PROJECT_CONTRACTOR">Project contractor</SelectItem>
                          <SelectItem value="ANY">Open to any</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
              </FieldGroup>
            )}

            {step === 1 && (
              <FieldGroup>
                <Controller
                  control={control}
                  name="track"
                  render={({ field }) => (
                    <FieldSet data-invalid={invalid("track")}>
                      <FieldLegend variant="label">How are you applying?</FieldLegend>
                      <RadioGroup
                        value={field.value ?? ""}
                        onValueChange={(v) => {
                          field.onChange(v);
                          // The qualified track is for technicians without a licence; EPRA holders pick a class.
                          if (v === "QUALIFIED") setValue("epraClass", "NONE");
                          else if (getValues("epraClass") === "NONE") setValue("epraClass", undefined as never);
                        }}
                        className="grid gap-2 sm:grid-cols-2"
                        aria-invalid={invalid("track")}
                      >
                        {(["EPRA_LICENSED", "QUALIFIED"] as const).map((v) => (
                          <ChoiceCard key={v} id={`track-${v}`} label={TRACK[v].label} description={TRACK[v].description}>
                            <RadioGroupItem id={`track-${v}`} value={v} />
                          </ChoiceCard>
                        ))}
                      </RadioGroup>
                      <FieldError errors={err("track")} />
                    </FieldSet>
                  )}
                />

                {track === "EPRA_LICENSED" && (
                  <>
                    <Controller
                      control={control}
                      name="epraClass"
                      render={({ field }) => (
                        <FieldSet data-invalid={invalid("epraClass")}>
                          <FieldLegend variant="label">EPRA solar PV technician licence class</FieldLegend>
                          <FieldDescription>We check every licence against EPRA&apos;s public register.</FieldDescription>
                          <RadioGroup
                            value={field.value === "NONE" ? "" : (field.value ?? "")}
                            onValueChange={field.onChange}
                            className="grid gap-2 sm:grid-cols-3"
                            aria-invalid={invalid("epraClass")}
                          >
                            {(["T1", "T2", "T3"] as const).map((v) => (
                              <ChoiceCard key={v} id={`cls-${v}`} label={`Class ${v}`}>
                                <RadioGroupItem id={`cls-${v}`} value={v} />
                              </ChoiceCard>
                            ))}
                          </RadioGroup>
                          <FieldError errors={err("epraClass")} />
                        </FieldSet>
                      )}
                    />
                    <div className="grid gap-6 sm:grid-cols-2">
                      <Field data-invalid={invalid("licenceNumber")}>
                        <FieldLabel htmlFor="licenceNumber">Licence number</FieldLabel>
                        <Input id="licenceNumber" placeholder="EPRA/SPVT/…" autoCapitalize="characters" aria-invalid={invalid("licenceNumber")} {...register("licenceNumber")} />
                        <FieldError errors={err("licenceNumber")} />
                      </Field>
                      <Field data-invalid={invalid("licenceExpiresOn")}>
                        <FieldLabel htmlFor="licenceExpiresOn">Expiry date</FieldLabel>
                        <Input id="licenceExpiresOn" type="date" aria-invalid={invalid("licenceExpiresOn")} {...register("licenceExpiresOn")} />
                        <FieldError errors={err("licenceExpiresOn")} />
                      </Field>
                    </div>
                    <Field>
                      <FieldLabel htmlFor="licenceIssue">Renewal or licence issue (optional)</FieldLabel>
                      <Textarea id="licenceIssue" placeholder="Pending renewal, restriction, or anything we should know." {...register("licenceIssue")} />
                    </Field>
                    {uploadsEnabled && key && (
                      <DocumentUploader
                        kind="EPRA_LICENCE"
                        label="Copy of your EPRA licence (optional)"
                        description="A photo or PDF of the licence certificate speeds up verification. PDF, JPG, PNG or WebP, up to 5 MB."
                        submissionKey={key}
                        items={uploads}
                        onChange={setUploads}
                      />
                    )}
                  </>
                )}

                {track && (
                  <FieldSet data-invalid={invalid("qualifications")}>
                    <FieldLegend variant="label">{track === "QUALIFIED" ? "Your qualifications" : "Other qualifications (optional)"}</FieldLegend>
                    <FieldDescription>
                      {track === "QUALIFIED"
                        ? "Add your highest solar or electrical qualification first — certificate, diploma, degree or NITA trade test."
                        : "Certificates, diplomas or degrees in solar, electrical or related fields."}
                    </FieldDescription>
                    {qualifications.fields.map((q, i) => (
                      <div key={q.id} className="flex flex-col gap-4 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">Qualification {i + 1}</span>
                          <Button type="button" variant="ghost" size="sm" onClick={() => qualifications.remove(i)}>
                            <Trash2Icon /> Remove
                          </Button>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field data-invalid={invalid(`qualifications.${i}.level`)}>
                            <FieldLabel htmlFor={`q${i}-level`}>Level</FieldLabel>
                            <Controller
                              control={control}
                              name={`qualifications.${i}.level`}
                              render={({ field }) => (
                                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                                  <SelectTrigger id={`q${i}-level`} ref={field.ref} onBlur={field.onBlur} aria-invalid={invalid(`qualifications.${i}.level`)} className="w-full">
                                    <SelectValue placeholder="Select the level" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {QUALIFICATION_LEVELS.map((l) => (
                                      <SelectItem key={l} value={l}>
                                        {QUALIFICATION_LEVEL[l].label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                            <FieldError errors={err(`qualifications.${i}.level`)} />
                          </Field>
                          <Field data-invalid={invalid(`qualifications.${i}.field`)}>
                            <FieldLabel htmlFor={`q${i}-field`}>Course</FieldLabel>
                            <Input id={`q${i}-field`} placeholder="e.g. Electrical installation" aria-invalid={invalid(`qualifications.${i}.field`)} {...register(`qualifications.${i}.field`)} />
                            <FieldError errors={err(`qualifications.${i}.field`)} />
                          </Field>
                          <Field data-invalid={invalid(`qualifications.${i}.institution`)}>
                            <FieldLabel htmlFor={`q${i}-institution`}>College, university or examining body</FieldLabel>
                            <Input id={`q${i}-institution`} placeholder="e.g. Kisumu National Polytechnic, KNEC" aria-invalid={invalid(`qualifications.${i}.institution`)} {...register(`qualifications.${i}.institution`)} />
                            <FieldError errors={err(`qualifications.${i}.institution`)} />
                          </Field>
                          <Field data-invalid={invalid(`qualifications.${i}.yearCompleted`)}>
                            <FieldLabel htmlFor={`q${i}-year`}>Year completed</FieldLabel>
                            <Input
                              id={`q${i}-year`}
                              type="number"
                              inputMode="numeric"
                              placeholder="2021"
                              aria-invalid={invalid(`qualifications.${i}.yearCompleted`)}
                              {...register(`qualifications.${i}.yearCompleted`, { setValueAs: requiredNumber })}
                            />
                            <FieldError errors={err(`qualifications.${i}.yearCompleted`)} />
                          </Field>
                          <Field className="sm:col-span-2">
                            <FieldLabel htmlFor={`q${i}-cert`}>Certificate or registration number (optional)</FieldLabel>
                            <Input id={`q${i}-cert`} {...register(`qualifications.${i}.certificateNumber`)} />
                          </Field>
                        </div>
                      </div>
                    ))}
                    {qualifications.fields.length < MAX_QUALIFICATIONS && (
                      <Button type="button" variant="outline" className="self-start" onClick={() => qualifications.append(EMPTY_QUALIFICATION, { shouldFocus: false })}>
                        <PlusIcon /> Add {qualifications.fields.length ? "another" : "a"} qualification
                      </Button>
                    )}
                    <FieldError errors={err("qualifications")} />
                  </FieldSet>
                )}

                {track && uploadsEnabled && key && qualifications.fields.length > 0 && (
                  <DocumentUploader
                    kind="QUALIFICATION"
                    label="Copies of your qualification certificates (optional)"
                    description="Photos or PDFs of your certificate, diploma or degree speed up verification. PDF, JPG, PNG or WebP, up to 5 MB each."
                    submissionKey={key}
                    items={uploads}
                    onChange={setUploads}
                    max={MAX_QUALIFICATIONS}
                  />
                )}

                {track && (
                  <ConsentBox control={control} name="licenceVerificationConsent" text={CONSENT_TEXT.licenceVerification} error={err("licenceVerificationConsent")} />
                )}
              </FieldGroup>
            )}

            {step === 2 && (
              <FieldGroup>
                <div className="grid gap-6 sm:grid-cols-2">
                  <NumberField id="yearsExperience" label="Years of solar experience" unit="years" step="0.5" register={register("yearsExperience", { setValueAs: requiredNumber })} error={err("yearsExperience")} />
                  <NumberField id="largestPvKwp" label="Largest PV array you installed" unit="kWp" step="0.1" register={register("largestPvKwp", { setValueAs: requiredNumber })} error={err("largestPvKwp")} />
                  <NumberField id="largestInverterKw" label="Largest inverter (optional)" unit="kW" step="0.1" register={register("largestInverterKw", { setValueAs: optionalNumber })} error={err("largestInverterKw")} />
                  <NumberField id="largestBatteryKwh" label="Largest battery bank (optional)" unit="kWh" step="0.1" register={register("largestBatteryKwh", { setValueAs: optionalNumber })} error={err("largestBatteryKwh")} />
                </div>
                <Controller
                  control={control}
                  name="categories"
                  render={({ field }) => (
                    <FieldSet>
                      <FieldLegend variant="label">Types of installation you have done</FieldLegend>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {Object.entries(CATEGORY).map(([v, l]) => {
                          const checked = (field.value ?? []).includes(v as never);
                          return (
                            <ChoiceCard key={v} id={`cat-${v}`} label={l}>
                              <Checkbox
                                id={`cat-${v}`}
                                checked={checked}
                                onCheckedChange={(on) =>
                                  field.onChange(on ? [...(field.value ?? []), v] : (field.value ?? []).filter((x) => x !== v))
                                }
                              />
                            </ChoiceCard>
                          );
                        })}
                      </div>
                    </FieldSet>
                  )}
                />
                <Field data-invalid={invalid("largestProject")}>
                  <FieldLabel htmlFor="largestProject">Your largest project and your exact role</FieldLabel>
                  <FieldDescription>Site type, location, year, system design and what you personally did (design, installation, commissioning).</FieldDescription>
                  <Textarea id="largestProject" rows={4} aria-invalid={invalid("largestProject")} {...register("largestProject")} />
                  <FieldError errors={err("largestProject")} />
                </Field>
              </FieldGroup>
            )}

            {step === 3 && (
              <FieldGroup>
                <Field data-invalid={invalid("inverters")}>
                  <FieldLabel htmlFor="inverters">Inverter brands and models</FieldLabel>
                  <FieldDescription>For example: brand/model, how many, largest size, and whether you configured, commissioned or repaired them.</FieldDescription>
                  <Textarea id="inverters" aria-invalid={invalid("inverters")} {...register("inverters")} />
                  <FieldError errors={err("inverters")} />
                </Field>
                <Field data-invalid={invalid("batteries")}>
                  <FieldLabel htmlFor="batteries">Battery brands and chemistries</FieldLabel>
                  <FieldDescription>Brand, chemistry (e.g. lithium LFP, lead-acid), system voltage, capacity and your role.</FieldDescription>
                  <Textarea id="batteries" aria-invalid={invalid("batteries")} {...register("batteries")} />
                  <FieldError errors={err("batteries")} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="loggerExperience">Energy logger or site audit experience (optional)</FieldLabel>
                  <Textarea id="loggerExperience" {...register("loggerExperience")} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="certifications">Other certifications and safety training (optional)</FieldLabel>
                  <FieldDescription>First aid, working at height, electrical safety, manufacturer training — include issuer and expiry.</FieldDescription>
                  <Textarea id="certifications" {...register("certifications")} />
                </Field>
                <div className="grid gap-2 sm:grid-cols-2">
                  <BoolCard control={control} name="highVoltage" label="I have high-voltage experience" />
                  <BoolCard control={control} name="energyAuditor" label="I hold an EPRA energy-auditor licence" />
                </div>
                {uploadsEnabled && key && (
                  <DocumentUploader
                    kind="CERTIFICATE"
                    label="Certificates (optional)"
                    description="Up to 4 training or safety certificates. PDF, JPG, PNG or WebP, up to 5 MB each."
                    submissionKey={key}
                    items={uploads}
                    onChange={setUploads}
                    max={4}
                  />
                )}
                {watch("highVoltage") && (
                  <Field data-invalid={invalid("voltageExperience")}>
                    <FieldLabel htmlFor="voltageExperience">Describe your high-voltage work</FieldLabel>
                    <FieldDescription>Highest PV DC, battery DC and AC voltages, the task, and your isolation procedure.</FieldDescription>
                    <Textarea id="voltageExperience" aria-invalid={invalid("voltageExperience")} {...register("voltageExperience")} />
                    <FieldError errors={err("voltageExperience")} />
                  </Field>
                )}
              </FieldGroup>
            )}

            {step === 4 && (
              <FieldGroup>
                <FieldDescription>
                  Give people who can confirm your project work — a site engineer, project manager or client. Include name, title, organisation, phone or official email, and the project.
                </FieldDescription>
                {(["referee1", "referee2", "referee3"] as const).map((name, i) => (
                  <Field key={name} data-invalid={invalid(name)}>
                    <FieldLabel htmlFor={name}>Referee {i + 1}{i === 2 ? " (optional)" : ""}</FieldLabel>
                    <Textarea id={name} rows={2} aria-invalid={invalid(name)} {...register(name)} />
                    <FieldError errors={err(name)} />
                  </Field>
                ))}
                <p className="bg-secondary text-secondary-foreground rounded-lg p-3 text-sm">
                  Our system gives each application a preliminary score to help us sort them. A person reviews every application before any decision.{" "}
                  <Link href="/privacy" target="_blank" className="font-medium underline underline-offset-2">
                    How we use your information
                  </Link>
                </p>
                <ConsentBox control={control} name="recruitmentConsent" text={CONSENT_TEXT.recruitment} error={err("recruitmentConsent")} />
                <BoolCard control={control} name="talentPoolConsent" label={CONSENT_TEXT.talentPool} />
              </FieldGroup>
            )}

            {formError && (
              <p role="alert" className="bg-destructive-soft text-destructive flex items-start gap-2 rounded-lg p-3 text-sm">
                <AlertCircleIcon className="mt-0.5 size-4 shrink-0" /> {formError}
              </p>
            )}

            <div className="bg-card sticky bottom-0 -mx-6 flex justify-between gap-3 border-t px-6 pt-4 pb-1">
              <Button type="button" variant="outline" size="lg" onClick={back} disabled={step === 0 || submitting} className="h-11">
                <ArrowLeftIcon /> Back
              </Button>
              {step < APPLICATION_STEPS.length - 1 ? (
                <Button type="button" size="lg" onClick={next} className="h-11">
                  Continue <ArrowRightIcon />
                </Button>
              ) : (
                <Button type="submit" variant="brand" size="lg" disabled={submitting} className="h-11">
                  {submitting ? <Loader2Icon className="animate-spin" /> : null}
                  {submitting ? "Submitting…" : "Submit application"}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
      <p className="text-muted-foreground mt-3 text-center text-xs">Your answers are saved on this device as you go.</p>
    </div>
  );
}

function ChoiceCard({ id, label, description, children }: { id: string; label: string; description?: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={id}
      className="has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5 hover:bg-accent flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm"
    >
      <span className="mt-0.5">{children}</span>
      <span className="flex flex-col">
        <span className="font-medium">{label}</span>
        {description && <span className="text-muted-foreground text-xs">{description}</span>}
      </span>
    </label>
  );
}

function NumberField({
  id,
  label,
  unit,
  step,
  register,
  error,
}: {
  id: string;
  label: string;
  unit: string;
  step: string;
  register: ReturnType<ReturnType<typeof useForm<ApplicationInput, unknown, Application>>["register"]>;
  error?: { message?: string }[];
}) {
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <Input id={id} type="number" inputMode="decimal" min={0} step={step} aria-invalid={Boolean(error)} className="pr-14" {...register} />
        <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm">{unit}</span>
      </div>
      <FieldError errors={error} />
    </Field>
  );
}

type FormControl = ReturnType<typeof useForm<ApplicationInput, unknown, Application>>["control"];

function ConsentBox({ control, name, text, error }: { control: FormControl; name: "licenceVerificationConsent" | "recruitmentConsent"; text: string; error?: { message?: string }[] }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Field data-invalid={Boolean(error)}>
          <label htmlFor={name} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm aria-invalid:border-destructive" aria-invalid={Boolean(error)}>
            <Checkbox id={name} ref={field.ref} checked={field.value === true} onCheckedChange={(v) => field.onChange(v === true)} onBlur={field.onBlur} className="mt-0.5" />
            <span>{text}</span>
          </label>
          <FieldError errors={error} />
        </Field>
      )}
    />
  );
}

function BoolCard({ control, name, label }: { control: FormControl; name: "highVoltage" | "energyAuditor" | "talentPoolConsent"; label: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <ChoiceCard id={name} label={label}>
          <Checkbox id={name} checked={field.value === true} onCheckedChange={(v) => field.onChange(v === true)} />
        </ChoiceCard>
      )}
    />
  );
}

function Success({ reference }: { reference: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-6 text-center">
        <CheckCircle2Icon className="text-success size-12" />
        <h2 className="text-2xl font-bold">Application received</h2>
        <p className="text-muted-foreground max-w-md">
          Thank you. Please keep your reference number — you will need it if you contact us about your application.
        </p>
        <p className="bg-secondary text-secondary-foreground rounded-lg px-5 py-3 font-mono text-2xl font-bold tracking-wider">{reference}</p>
        <div className="text-muted-foreground max-w-md text-left text-sm">
          <p className="text-foreground mb-1 font-semibold">What happens next</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>We verify your EPRA licence or qualifications.</li>
            <li>A recruiter reviews your experience and may contact your referees.</li>
            <li>Shortlisted technicians are invited to a technical and practical assessment.</li>
          </ol>
        </div>
        <Button asChild variant="outline">
          <Link href="/">Back to home</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
