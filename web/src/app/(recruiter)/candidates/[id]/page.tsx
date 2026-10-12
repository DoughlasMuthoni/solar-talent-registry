import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangleIcon, ArrowLeftIcon, ExternalLinkIcon, FileTextIcon, MailIcon, MapPinIcon, PhoneIcon } from "lucide-react";
import { ToneBadge } from "@/components/tone-badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getApplicationDetail, type ApplicationDetail } from "@/lib/data/application-detail";
import { CATEGORY, EPRA_CLASS, QUALIFICATION_VERIFICATION, SCREENING_STATUS, SOURCE, STAGE, TRAVEL, VERIFICATION } from "@/lib/labels";
import { NoteForm, RescoreButton, StageForm, VerifyLicenceForm, VerifyQualificationForm } from "./admin-panels";
import { QUALIFICATION_LEVEL, TRACK } from "@/lib/qualifications";
import { EraseCandidate } from "./erase-candidate";
import { RecordResultForm, ScheduleAssessmentForm } from "../../assessments/assessment-panels";
import { MessageComposer } from "../../messages/message-composer";
import { formatNairobi } from "@/lib/nairobi-time";

export const metadata: Metadata = { title: "Candidate" };

/** Dates render on the server in Kenya time so server and client markup always match. */
const fmt = (iso: string, withTime = true) =>
  new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", ...(withTime ? { timeStyle: "short" } : {}), timeZone: "Africa/Nairobi" }).format(new Date(iso));

const CONSENT_LABEL = { RECRUITMENT_PROCESSING: "Recruitment processing", LICENCE_VERIFICATION: "Licence / qualification verification", TALENT_POOL: "Talent pool (24 months)" } as const;
const EVENT_LABEL: Record<string, string> = {
  "application.submitted": "Application submitted",
  "licence.verified": "Licence verification updated",
  "qualification.verified": "Qualification check updated",
  "score.recalculated": "Score recalculated",
  "candidate.withdrew": "Candidate withdrew via their status link",
  "candidate.erasure_requested": "Candidate requested deletion of their data",
  "document.viewed": "Document viewed",
  "assessment.scheduled": "Assessment scheduled",
  "assessment.recorded": "Assessment result recorded",
};
const DOC_KIND: Record<string, string> = {
  EPRA_LICENCE: "EPRA licence",
  QUALIFICATION: "Qualification certificate",
  CERTIFICATE: "Training certificate",
  PROJECT_PHOTO: "Project photo",
  OTHER: "Document",
};
const EMAIL_STATUS = { SENT: "sent", SKIPPED: "not sent (email not configured)", FAILED: "FAILED to send" } as const;
const SECTION_LABEL = { experience: "Experience", technical: "Technical capability", verification: "Verifiability & mobility" } as const;

export default function CandidatePage({ params }: PageProps<"/candidates/[id]">) {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/candidates" className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm">
        <ArrowLeftIcon className="size-4" /> All candidates
      </Link>
      <Suspense fallback={<Skeleton className="h-[40rem] rounded-xl" aria-label="Loading candidate" />}>
        <Detail params={params} />
      </Suspense>
    </div>
  );
}

async function Detail({ params }: { params: PageProps<"/candidates/[id]">["params"] }) {
  const { id } = await params;
  const d = await getApplicationDetail(id);
  const status = d.score ? SCREENING_STATUS[d.score.status] : null;

  return (
    <>
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="bg-muted rounded-md px-2 py-0.5 font-mono text-sm font-semibold">{d.reference}</span>
          <ToneBadge tone={d.track === "QUALIFIED" ? "info" : "neutral"} title={TRACK[d.track].label}>
            {TRACK[d.track].short}
          </ToneBadge>
          {status && <ToneBadge tone={status.tone} title={status.hint}>{status.label}</ToneBadge>}
          <ToneBadge tone="neutral">{STAGE[d.stage]}</ToneBadge>
          {d.candidate.isDemo && <ToneBadge tone="info">Fictional demo record</ToneBadge>}
          {d.erasureRequested && <ToneBadge tone="danger">Data deletion requested</ToneBadge>}
        </div>
        <h1 className="text-2xl font-bold sm:text-3xl">{d.candidate.fullName}</h1>
        <p className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <MapPinIcon className="size-4" /> {d.candidate.town}, {d.candidate.county} · {d.candidate.region}
          </span>
          <span>Applied {fmt(d.submittedAt)}</span>
          <span>
            via {SOURCE[d.source]}
            {d.utmCampaign ? ` · ${d.utmCampaign}` : ""}
          </span>
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-6">
          <ScoreCard d={d} />
          <Card>
            <CardHeader>
              <CardTitle>Installation experience</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Experience" value={`${d.experience.years} yrs`} />
                <Stat label="Largest PV" value={`${d.experience.largestPvKwp.toLocaleString("en-KE")} kWp`} />
                <Stat label="Largest inverter" value={d.experience.largestInverterKw === null ? "—" : `${d.experience.largestInverterKw} kW`} />
                <Stat label="Largest battery" value={d.experience.largestBatteryKwh === null ? "—" : `${d.experience.largestBatteryKwh} kWh`} />
              </dl>
              <div className="flex flex-wrap gap-1.5">
                {d.experience.categories.length ? (
                  d.experience.categories.map((c) => <ToneBadge key={c} tone="neutral">{CATEGORY[c]}</ToneBadge>)
                ) : (
                  <span className="text-muted-foreground text-sm">No installation categories given</span>
                )}
              </div>
              <Evidence label="Largest project and role" value={d.experience.largestProject} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Technical evidence</CardTitle>
              <CardDescription>
                Claims to test at assessment. {d.technical.highVoltage ? "Claims high-voltage experience." : ""} {d.technical.energyAuditor ? "Claims an EPRA energy-auditor licence." : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Evidence label="Inverters" value={d.technical.inverters} />
              <Evidence label="Batteries" value={d.technical.batteries} />
              <Evidence label="Logger / site audit" value={d.technical.logger} />
              <Evidence label="High-voltage work" value={d.technical.voltage} />
              <Evidence label="Certifications & safety" value={d.technical.certifications} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Referees</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {d.referees.map((r) => (
                <Evidence key={r.position} label={`Referee ${r.position}`} value={r.details} />
              ))}
            </CardContent>
          </Card>
          <AssessmentsCard d={d} />
          <Card>
            <CardHeader>
              <CardTitle>Message {d.candidate.fullName.split(" ")[0]}</CardTitle>
              <CardDescription>Sends from the recruitment inbox; the message is kept in the history below.</CardDescription>
            </CardHeader>
            <CardContent>
              <MessageComposer applicationId={d.id} candidateName={d.candidate.fullName} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Notes & history</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <NoteForm applicationId={d.id} />
              <ol className="flex flex-col gap-4 border-l pl-4">
                {d.timeline.map((t) => (
                  <li key={`${t.kind}-${t.id}`} className="relative text-sm">
                    <span aria-hidden className="bg-border absolute top-1.5 -left-[1.3rem] size-2.5 rounded-full" />
                    <p className="text-muted-foreground text-xs">
                      {fmt(t.at)}
                      {"who" in t && t.who ? ` · ${t.who}` : ""}
                    </p>
                    {t.kind === "note" && <p className="whitespace-pre-wrap">{t.body}</p>}
                    {t.kind === "stage" && (
                      <p>
                        Stage: {STAGE[t.from]} → <strong>{STAGE[t.to]}</strong>
                        {t.reason && <span className="text-muted-foreground block">Reason: {t.reason}</span>}
                      </p>
                    )}
                    {t.kind === "event" && <p>{EVENT_LABEL[t.action] ?? t.action}</p>}
                    {t.kind === "email" && (
                      <div>
                        <p className={t.status === "FAILED" ? "text-destructive" : undefined}>
                          Email “{t.subject}” — {EMAIL_STATUS[t.status]}
                        </p>
                        {t.body && (
                          <details className="text-muted-foreground mt-1">
                            <summary className="cursor-pointer text-xs">Show message</summary>
                            <p className="mt-1 text-xs whitespace-pre-wrap">{t.body}</p>
                          </details>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-6">
          {d.track === "QUALIFIED" ? (
            <>
              <QualificationsCard d={d} />
              <LicenceCard d={d} />
            </>
          ) : (
            <>
              <LicenceCard d={d} />
              <QualificationsCard d={d} />
            </>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>Opened through a 60-second private link. Every view is recorded.</CardDescription>
            </CardHeader>
            <CardContent>
              {d.documents.length === 0 ? (
                <p className="text-muted-foreground text-sm">No documents uploaded.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {d.documents.map((doc) => (
                    <li key={doc.id}>
                      <a
                        href={`/candidates/${d.id}/documents/${doc.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:bg-accent flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                      >
                        <FileTextIcon className="text-muted-foreground size-4 shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{doc.fileName}</span>
                          <span className="text-muted-foreground text-xs">
                            {DOC_KIND[doc.kind] ?? "Document"} · {(doc.sizeBytes / 1024 / 1024).toFixed(1)} MB
                          </span>
                        </span>
                        <ExternalLinkIcon className="text-muted-foreground size-4" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <StageForm applicationId={d.id} stage={d.stage} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <a href={`tel:${d.candidate.phone}`} className="text-link inline-flex items-center gap-2 underline-offset-2 hover:underline">
                <PhoneIcon className="size-4" /> {d.candidate.phone}
              </a>
              <a href={`mailto:${d.candidate.email}`} className="text-link inline-flex items-center gap-2 break-all underline-offset-2 hover:underline">
                <MailIcon className="size-4 shrink-0" /> {d.candidate.email}
              </a>
              <p className="text-muted-foreground">Travel: {TRAVEL[d.candidate.travel]}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Consents</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2 text-sm">
                {d.candidate.consents.map((c) => (
                  <li key={`${c.kind}-${c.at}`} className="flex flex-col">
                    <span className="font-medium">{CONSENT_LABEL[c.kind]}</span>
                    <span className="text-muted-foreground text-xs">
                      {c.withdrawn ? `Withdrawn ${fmt(c.withdrawn, false)}` : `Given ${fmt(c.at, false)}`} · notice {c.version}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card className={d.erasureRequested ? "border-destructive" : undefined}>
            <CardHeader>
              <CardTitle>Data protection</CardTitle>
              <CardDescription>
                {d.erasureRequested
                  ? "The candidate asked for their data to be deleted. Action it promptly and confirm to them by email."
                  : "Closed applications are erased automatically after 12 months (24 with talent-pool consent)."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EraseCandidate applicationId={d.id} reference={d.reference} requested={d.erasureRequested} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}

function ScoreCard({ d }: { d: ApplicationDetail }) {
  if (!d.score) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Preliminary score</CardTitle>
          <CardAction>
            <RescoreButton applicationId={d.id} />
          </CardAction>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">Not scored yet.</CardContent>
      </Card>
    );
  }
  const s = d.score;
  const sections = (["experience", "technical", "verification"] as const).map((key) => ({
    key,
    items: s.items.filter((i) => i.section === key),
  }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Preliminary score</CardTitle>
        <CardDescription>
          Rules v{s.rulesVersion} · {fmt(s.at)}. Text length is only a proxy for evidence — verify claims at assessment.
        </CardDescription>
        <CardAction>
          <RescoreButton applicationId={d.id} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-end gap-3">
          <span className="font-heading text-5xl font-extrabold tabular-nums">{s.total}</span>
          <span className="text-muted-foreground pb-1.5">/ 100</span>
        </div>
        {!s.eligible && (
          <div role="note" className="bg-destructive-soft text-destructive flex gap-2 rounded-lg p-3 text-sm">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold">Licence gate not met — confirm with the candidate before any decision</p>
              <ul className="mt-1 list-disc pl-4">
                {s.eligibilityIssues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        <div className="grid gap-5 md:grid-cols-3">
          {sections.map(({ key, items }) => (
            <section key={key} className="flex flex-col gap-2">
              <h3 className="flex justify-between text-sm font-semibold">
                <span>{SECTION_LABEL[key]}</span>
                <span className="tabular-nums">
                  {Math.round(s.parts[key])}/{items.reduce((m, i) => m + i.max, 0)}
                </span>
              </h3>
              <ul className="flex flex-col gap-1.5">
                {items.map((i) => (
                  <li key={i.key} title={`${i.label}: ${round(i.points)} of ${i.max}`} className="flex flex-col gap-1 text-xs">
                    <span className="text-muted-foreground flex justify-between">
                      <span>{i.label}</span>
                      <span className="text-foreground tabular-nums">
                        {round(i.points)}/{i.max}
                      </span>
                    </span>
                    <span className="bg-muted h-1.5 overflow-hidden rounded-full" aria-hidden>
                      <span className="bg-primary block h-full rounded-full" style={{ width: `${i.max ? (i.points / i.max) * 100 : 0}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const A_TYPE = { TECHNICAL: "Technical", PRACTICAL: "Practical" } as const;

function AssessmentsCard({ d }: { d: ApplicationDetail }) {
  const closed = d.stage === "REJECTED" || d.stage === "WITHDRAWN";
  const hasTechnicalPass = d.assessments.some((a) => a.type === "TECHNICAL" && a.result === "PASS");
  const now = new Date(d.asOf).getTime();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Assessments</CardTitle>
        <CardDescription>Technical (knowledge) and practical (hands-on). Results stay with the application.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {d.assessments.length === 0 && <p className="text-muted-foreground text-sm">None scheduled yet.</p>}
        {d.assessments.map((a) => {
          const due = a.status === "SCHEDULED" && new Date(a.scheduledAt).getTime() < now;
          return (
            <div key={a.id} className={`flex flex-col gap-3 rounded-lg border p-3 ${due ? "border-warning" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{A_TYPE[a.type]} assessment</p>
                  <p className="text-muted-foreground text-xs">
                    {formatNairobi(new Date(a.scheduledAt))} · {a.location}
                  </p>
                </div>
                {a.status === "SCHEDULED" ? (
                  <ToneBadge tone={due ? "warning" : "info"}>{due ? "Record result" : "Scheduled"}</ToneBadge>
                ) : a.status === "COMPLETED" ? (
                  <ToneBadge tone={a.result === "PASS" ? "success" : "danger"}>
                    {a.result === "PASS" ? "Pass" : "Fail"}
                    {a.score !== null ? ` · ${a.score}/100` : ""}
                  </ToneBadge>
                ) : (
                  <ToneBadge tone="neutral">{a.status === "NO_SHOW" ? "No-show" : "Cancelled"}</ToneBadge>
                )}
              </div>
              {a.notes && <p className="text-muted-foreground text-sm whitespace-pre-wrap">{a.notes}</p>}
              {a.status === "SCHEDULED" && <RecordResultForm assessmentId={a.id} />}
            </div>
          );
        })}
        {!closed && <ScheduleAssessmentForm applicationId={d.id} defaultType={hasTechnicalPass ? "PRACTICAL" : "TECHNICAL"} />}
      </CardContent>
    </Card>
  );
}

function QualificationsCard({ d }: { d: ApplicationDetail }) {
  if (d.track !== "QUALIFIED" && d.qualifications.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Qualifications</CardTitle>
        <CardDescription>
          {d.track === "QUALIFIED"
            ? "Qualified-track applicant: confirm at least one qualification with the institution or examining body (KNEC, NITA, TVET CDACC)."
            : "Listed in addition to the EPRA licence."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {d.qualifications.length === 0 && <p className="text-muted-foreground text-sm">No qualifications listed.</p>}
        {d.qualifications.map((q) => (
          <div key={q.id} className="flex flex-col gap-3 rounded-lg border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">{q.field}</p>
                <p className="text-muted-foreground text-sm">
                  {QUALIFICATION_LEVEL[q.level].label} · {q.institution} · {q.yearCompleted}
                </p>
                {q.certificateNumber && <p className="font-mono text-xs break-all">Cert. no. {q.certificateNumber}</p>}
              </div>
              <ToneBadge tone={VERIFICATION[q.status].tone}>{q.status === "EXPIRED" ? VERIFICATION.EXPIRED.label : QUALIFICATION_VERIFICATION[q.status]}</ToneBadge>
            </div>
            {q.verifiedAt && (
              <p className="text-muted-foreground text-xs">
                Last checked by {q.verifiedBy ?? "an admin"} · {fmt(q.verifiedAt)}
              </p>
            )}
            <VerifyQualificationForm applicationId={d.id} qualificationId={q.id} status={q.status} evidenceNote={q.evidenceNote} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function LicenceCard({ d }: { d: ApplicationDetail }) {
  const l = d.licence;
  if (!l) return null;
  // Qualified-track applicants have no licence, so there is nothing to verify.
  if (d.track === "QUALIFIED" && l.epraClass === "NONE") return null;
  const v = VERIFICATION[l.status];
  const expiryTone = l.daysToExpiry === null ? "neutral" : l.daysToExpiry < 0 ? "danger" : l.daysToExpiry <= 90 ? "warning" : "success";
  return (
    <Card>
      <CardHeader>
        <CardTitle>EPRA licence</CardTitle>
        <CardAction>
          <ToneBadge tone={v.tone}>{v.label}</ToneBadge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-3">
          <Stat label="Class" value={EPRA_CLASS[l.epraClass]} />
          <Stat label="Number" value={l.number ?? "—"} mono />
          <div className="col-span-2 flex flex-col gap-1">
            <dt className="text-muted-foreground text-xs">Expiry</dt>
            <dd className="flex flex-wrap items-center gap-2 text-sm font-medium">
              {l.expiresOn ? fmt(`${l.expiresOn}T12:00:00Z`, false) : "—"}
              {l.daysToExpiry !== null && (
                <ToneBadge tone={expiryTone}>
                  {l.daysToExpiry < 0 ? `Expired ${-l.daysToExpiry} days ago` : l.daysToExpiry === 0 ? "Expires today" : `${l.daysToExpiry} days left`}
                </ToneBadge>
              )}
            </dd>
          </div>
        </dl>
        {l.issueNote && <Evidence label="Candidate's licence note" value={l.issueNote} />}
        {l.verifiedAt && (
          <p className="text-muted-foreground text-xs">
            Last checked by {l.verifiedBy ?? "an admin"} · {fmt(l.verifiedAt)}
          </p>
        )}
        {l.epraClass !== "NONE" && <VerifyLicenceForm applicationId={d.id} status={l.status} evidenceNote={l.evidenceNote} />}
      </CardContent>
    </Card>
  );
}

const round = (n: number) => Math.round(n * 10) / 10;

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className={`text-sm font-semibold ${mono ? "font-mono break-all" : ""}`}>{value}</dd>
    </div>
  );
}

function Evidence({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3">
      <p className="text-muted-foreground mb-0.5 text-xs">{label}</p>
      <p className={`text-sm whitespace-pre-wrap ${value ? "" : "text-muted-foreground italic"}`}>{value || "Not provided"}</p>
    </div>
  );
}
