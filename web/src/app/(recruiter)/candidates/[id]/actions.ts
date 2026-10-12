"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Stage, VerificationStatus } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { eraseCandidate } from "@/lib/erasure";
import { scoringInclude, toScoringInput } from "@/lib/scoring/from-application";
import { scoreApplication, type ScoringRules } from "@/lib/scoring/rules";

export type ActionResult = { ok: true } | { ok: false; error: string };

const id = z.string().min(1).max(40);
const fail = (error: string): ActionResult => ({ ok: false, error });

/** Adverse outcomes must carry a reason (fairness + DPA: candidates can ask why). */
const ADVERSE: Stage[] = ["REJECTED", "WITHDRAWN"];

const verifySchema = z
  .object({
    applicationId: id,
    status: z.enum(VerificationStatus),
    evidenceNote: z.string().trim().max(2000),
  })
  .refine((v) => v.status === "PENDING" || v.evidenceNote.length >= 5, {
    path: ["evidenceNote"],
    message: "Note what you saw on the EPRA register (class, status, expiry).",
  });

export async function verifyLicence(input: z.input<typeof verifySchema>): Promise<ActionResult> {
  const admin = await requireAdmin();
  const p = verifySchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const app = await db.application.findUnique({ where: { id: p.data.applicationId }, select: { licenceId: true } });
  if (!app?.licenceId) return fail("This application has no licence record.");

  const pending = p.data.status === "PENDING";
  await db.$transaction([
    db.licence.update({
      where: { id: app.licenceId },
      data: {
        status: p.data.status,
        evidenceNote: p.data.evidenceNote || null,
        verifiedById: pending ? null : admin.id,
        verifiedAt: pending ? null : new Date(),
      },
    }),
    db.auditEvent.create({
      data: { actorId: admin.id, action: "licence.verified", entityType: "Application", entityId: p.data.applicationId, metadata: { status: p.data.status } },
    }),
  ]);
  refresh();
  return { ok: true };
}

const verifyQualificationSchema = z
  .object({
    applicationId: id,
    qualificationId: id,
    status: z.enum(VerificationStatus).exclude(["EXPIRED"]),
    evidenceNote: z.string().trim().max(2000),
  })
  .refine((v) => v.status === "PENDING" || v.evidenceNote.length >= 5, {
    path: ["evidenceNote"],
    message: "Note how you checked it (institution, KNEC/NITA/CDACC, certificate seen).",
  });

export async function verifyQualification(input: z.input<typeof verifyQualificationSchema>): Promise<ActionResult> {
  const admin = await requireAdmin();
  const p = verifyQualificationSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const q = await db.qualification.findFirst({ where: { id: p.data.qualificationId, applicationId: p.data.applicationId }, select: { id: true, position: true } });
  if (!q) return fail("Qualification not found.");

  const pending = p.data.status === "PENDING";
  await db.$transaction([
    db.qualification.update({
      where: { id: q.id },
      data: {
        status: p.data.status,
        evidenceNote: p.data.evidenceNote || null,
        verifiedById: pending ? null : admin.id,
        verifiedAt: pending ? null : new Date(),
      },
    }),
    db.auditEvent.create({
      data: {
        actorId: admin.id,
        action: "qualification.verified",
        entityType: "Application",
        entityId: p.data.applicationId,
        metadata: { qualification: q.position, status: p.data.status },
      },
    }),
  ]);
  refresh();
  return { ok: true };
}

const stageSchema = z
  .object({ applicationId: id, toStage: z.enum(Stage), reason: z.string().trim().max(2000) })
  .refine((v) => !ADVERSE.includes(v.toStage) || v.reason.length >= 10, {
    path: ["reason"],
    message: "Give a reason (at least 10 characters) — the candidate may ask why.",
  });

export async function changeStage(input: z.input<typeof stageSchema>): Promise<ActionResult> {
  const admin = await requireAdmin();
  const p = stageSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const app = await db.application.findUnique({ where: { id: p.data.applicationId }, select: { stage: true } });
  if (!app) return fail("Application not found.");
  if (app.stage === p.data.toStage) return fail("The application is already at that stage.");

  await db.$transaction([
    db.application.update({ where: { id: p.data.applicationId }, data: { stage: p.data.toStage } }),
    db.stageChange.create({
      data: { applicationId: p.data.applicationId, fromStage: app.stage, toStage: p.data.toStage, reason: p.data.reason || null, actorId: admin.id },
    }),
    db.auditEvent.create({
      data: { actorId: admin.id, action: "application.stage_changed", entityType: "Application", entityId: p.data.applicationId, metadata: { from: app.stage, to: p.data.toStage } },
    }),
  ]);
  refresh();
  return { ok: true };
}

const noteSchema = z.object({ applicationId: id, body: z.string().trim().min(2, "Write a note first.").max(5000) });

export async function addNote(input: z.input<typeof noteSchema>): Promise<ActionResult> {
  const admin = await requireAdmin();
  const p = noteSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const exists = await db.application.count({ where: { id: p.data.applicationId } });
  if (!exists) return fail("Application not found.");
  await db.note.create({ data: { applicationId: p.data.applicationId, authorId: admin.id, body: p.data.body } });
  refresh();
  return { ok: true };
}

/** Re-run the active scoring rules (e.g. after publishing a new rule version). Keeps history. */
export async function rescore(input: { applicationId: string }): Promise<ActionResult> {
  const admin = await requireAdmin();
  const p = z.object({ applicationId: id }).safeParse(input);
  if (!p.success) return fail("Invalid request.");
  const [ruleSet, app] = await Promise.all([
    db.scoringRuleSet.findFirst({ where: { active: true }, orderBy: { version: "desc" } }),
    db.application.findUnique({ where: { id: p.data.applicationId }, include: scoringInclude }),
  ]);
  if (!ruleSet) return fail("No active scoring rules.");
  if (!app) return fail("Application not found.");

  const r = scoreApplication(toScoringInput(app), ruleSet.rules as unknown as ScoringRules, new Date());
  await db.$transaction([
    db.scoreRun.create({
      data: {
        applicationId: app.id,
        ruleSetId: ruleSet.id,
        experience: r.parts.experience,
        technical: r.parts.technical,
        verification: r.parts.verification,
        total: r.total,
        eligible: r.eligible,
        status: r.status,
        breakdown: { items: r.breakdown, eligibilityIssues: r.eligibilityIssues },
      },
    }),
    db.auditEvent.create({
      data: { actorId: admin.id, action: "score.recalculated", entityType: "Application", entityId: app.id, metadata: { total: r.total, rulesVersion: ruleSet.version } },
    }),
  ]);
  refresh();
  return { ok: true };
}

/**
 * Permanently erase the candidate behind this application (DPA erasure request, or on an admin's decision).
 * The admin must type the reference to confirm. Irreversible.
 */
export async function eraseCandidateData(input: { applicationId: string; confirmReference: string }): Promise<ActionResult> {
  const admin = await requireAdmin();
  const p = z.object({ applicationId: id, confirmReference: z.string().trim().toUpperCase().max(32) }).safeParse(input);
  if (!p.success) return fail("Invalid request.");
  const app = await db.application.findUnique({ where: { id: p.data.applicationId }, select: { reference: true, candidateId: true } });
  if (!app) return fail("Application not found.");
  if (p.data.confirmReference !== app.reference) return fail(`Type ${app.reference} exactly to confirm.`);
  await eraseCandidate(app.candidateId, { reason: "candidate_request", actorId: admin.id });
  redirect("/candidates?erased=1");
}
