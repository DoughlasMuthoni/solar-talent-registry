"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sendStatusLink } from "@/lib/email/candidate-emails";
import { rateLimit } from "@/lib/rate-limit";
import { verifyStatusToken } from "@/lib/status-token";

/**
 * Public endpoints for candidates. Requests for a link always get the same answer, so they
 * can't be used to discover who has applied; links go only to the email on the application.
 */
export async function requestStatusLink(input: { reference: unknown; email: unknown; website?: unknown }) {
  const generic = { ok: true as const, message: "If those details match an application, we have emailed you a private link. Check your inbox and spam folder." };
  if (typeof input.website === "string" && input.website) return generic;
  const p = z
    .object({ reference: z.string().trim().toUpperCase().max(32), email: z.string().trim().toLowerCase().max(254) })
    .safeParse(input);
  if (!p.success || !p.data.reference || !p.data.email) return { ok: false as const, message: "Enter your reference number and email address." };

  if (!(await rateLimit("status-link", 10, 3600)).ok) return { ok: false as const, message: "Too many requests from this network. Please try again in an hour." };

  const app = await db.application.findUnique({ where: { reference: p.data.reference }, include: { candidate: { select: { email: true } } } });
  if (app && app.candidate.email.toLowerCase() === p.data.email) {
    after(() => sendStatusLink(app.id).catch((e) => console.error("status link email failed", e)));
  }
  return generic;
}

const CLOSED = ["WITHDRAWN", "REJECTED"] as const;

export async function withdrawApplication(input: { token: string; reason?: string }) {
  const id = verifyStatusToken(input.token);
  if (!id) return { ok: false as const, error: "This link has expired. Request a new one from the status page." };
  const reason = (input.reason ?? "").trim().slice(0, 1000) || null;
  const app = await db.application.findUnique({ where: { id }, select: { stage: true } });
  if (!app) return { ok: false as const, error: "Application not found." };
  if ((CLOSED as readonly string[]).includes(app.stage)) return { ok: false as const, error: "This application is already closed." };

  await db.$transaction([
    db.application.update({ where: { id }, data: { stage: "WITHDRAWN" } }),
    db.stageChange.create({ data: { applicationId: id, fromStage: app.stage, toStage: "WITHDRAWN", reason: reason ?? "Withdrawn by the candidate.", byCandidate: true } }),
    db.auditEvent.create({ data: { action: "candidate.withdrew", entityType: "Application", entityId: id } }),
  ]);
  refresh();
  return { ok: true as const };
}

/** Kenya DPA right to erasure: records the request for an admin to action (and confirm) within the legal deadline. */
export async function requestErasure(input: { token: string }) {
  const id = verifyStatusToken(input.token);
  if (!id) return { ok: false as const, error: "This link has expired. Request a new one from the status page." };
  const already = await db.auditEvent.count({ where: { entityType: "Application", entityId: id, action: "candidate.erasure_requested" } });
  if (!already) await db.auditEvent.create({ data: { action: "candidate.erasure_requested", entityType: "Application", entityId: id } });
  refresh();
  return { ok: true as const };
}
