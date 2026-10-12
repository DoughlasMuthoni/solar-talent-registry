"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { AssessmentResult, AssessmentType, type Stage } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/send";
import { assessmentInvite } from "@/lib/email/templates";
import { formatNairobi, nairobiLocalToDate } from "@/lib/nairobi-time";

type Result = { ok: true } | { ok: false; error: string };

/** Pipeline order — scheduling only ever moves a candidate forward, never back. */
const ORDER: Stage[] = ["NEW", "TECHNICAL_ASSESSMENT", "PRACTICAL_ASSESSMENT", "REFERENCE_CHECKS", "APPROVED_POOL"];
const STAGE_FOR = { TECHNICAL: "TECHNICAL_ASSESSMENT", PRACTICAL: "PRACTICAL_ASSESSMENT" } as const;

const scheduleSchema = z.object({
  applicationId: z.string().min(1).max(40),
  type: z.enum(AssessmentType),
  scheduledAt: z.string(),
  location: z.string().trim().min(3, "Add a location (address or venue)").max(200),
  instructions: z.string().trim().max(2000).optional(),
  notify: z.boolean(),
});

export async function scheduleAssessment(input: z.input<typeof scheduleSchema>): Promise<Result> {
  const admin = await requireAdmin();
  const p = scheduleSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const when = nairobiLocalToDate(p.data.scheduledAt);
  if (!when) return { ok: false, error: "Choose a date and time." };
  if (when.getTime() < Date.now() - 3_600_000) return { ok: false, error: "That time is in the past." };

  const app = await db.application.findUnique({ where: { id: p.data.applicationId }, include: { candidate: { select: { fullName: true, email: true } } } });
  if (!app) return { ok: false, error: "Application not found." };
  if (app.stage === "REJECTED" || app.stage === "WITHDRAWN") return { ok: false, error: "This application is closed." };

  const target = STAGE_FOR[p.data.type];
  const advance = ORDER.indexOf(app.stage) < ORDER.indexOf(target);
  const assessment = await db.$transaction(async (tx) => {
    const a = await tx.assessment.create({
      data: { applicationId: app.id, type: p.data.type, scheduledAt: when, location: p.data.location, instructions: p.data.instructions || null, assessorId: admin.id },
    });
    if (advance) {
      await tx.application.update({ where: { id: app.id }, data: { stage: target } });
      await tx.stageChange.create({ data: { applicationId: app.id, fromStage: app.stage, toStage: target, reason: `${p.data.type === "TECHNICAL" ? "Technical" : "Practical"} assessment scheduled`, actorId: admin.id } });
    }
    await tx.auditEvent.create({
      data: { actorId: admin.id, action: "assessment.scheduled", entityType: "Application", entityId: app.id, metadata: { assessmentId: a.id, type: p.data.type, scheduledAt: when.toISOString() } },
    });
    return a;
  });

  if (p.data.notify) {
    after(() =>
      sendEmail({
        kind: "ASSESSMENT_INVITE",
        to: app.candidate.email,
        toName: app.candidate.fullName,
        email: assessmentInvite({
          name: app.candidate.fullName.split(" ")[0],
          reference: app.reference,
          type: p.data.type,
          when: formatNairobi(when),
          location: p.data.location,
          instructions: p.data.instructions,
        }),
        dedupeKey: `assessment-invite:${assessment.id}`,
        applicationId: app.id,
        sentById: admin.id,
      }).catch((e) => console.error("assessment invite failed", e)),
    );
  }
  refresh();
  return { ok: true };
}

const recordSchema = z
  .object({
    assessmentId: z.string().min(1).max(40),
    status: z.enum(["COMPLETED", "NO_SHOW", "CANCELLED"]),
    result: z.enum(AssessmentResult).optional(),
    score: z.number().int().min(0).max(100).optional(),
    notes: z.string().trim().max(5000).optional(),
  })
  .refine((v) => v.status !== "COMPLETED" || v.result, { path: ["result"], message: "Choose pass or fail" });

export async function recordAssessment(input: z.input<typeof recordSchema>): Promise<Result> {
  const admin = await requireAdmin();
  const p = recordSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const a = await db.assessment.findUnique({ where: { id: p.data.assessmentId }, select: { applicationId: true } });
  if (!a) return { ok: false, error: "Assessment not found." };
  const completed = p.data.status === "COMPLETED";
  await db.$transaction([
    db.assessment.update({
      where: { id: p.data.assessmentId },
      data: {
        status: p.data.status,
        result: completed ? p.data.result : null,
        score: completed ? (p.data.score ?? null) : null,
        notes: p.data.notes || null,
        assessorId: admin.id,
        completedAt: new Date(),
      },
    }),
    db.auditEvent.create({
      data: { actorId: admin.id, action: "assessment.recorded", entityType: "Application", entityId: a.applicationId, metadata: { assessmentId: p.data.assessmentId, status: p.data.status, result: p.data.result ?? null } },
    }),
  ]);
  refresh();
  return { ok: true };
}
