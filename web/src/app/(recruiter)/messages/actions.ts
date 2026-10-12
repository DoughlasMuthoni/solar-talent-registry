"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { MAX_BULK_RECIPIENTS } from "@/lib/message-templates";
import { audienceApplications, audienceSchema, messageSchema, sendMessage } from "@/lib/messages";

const clean = (a: unknown) => {
  const raw = (a && typeof a === "object" ? a : {}) as Record<string, unknown>;
  // "all" from the filter selects means no filter.
  return audienceSchema.safeParse(Object.fromEntries(Object.entries(raw).filter(([, v]) => v && v !== "all")));
};

export async function countAudience(audience: unknown) {
  await requireAdmin();
  const a = clean(audience);
  if (!a.success) return { ok: false as const, error: "Invalid filter." };
  return { ok: true as const, count: (await audienceApplications(a.data)).length };
}

export async function sendToAudience(input: { audience: unknown; subject: string; body: string }) {
  const admin = await requireAdmin();
  const a = clean(input.audience);
  const m = messageSchema.safeParse(input);
  if (!a.success) return { ok: false as const, error: "Invalid filter." };
  if (!m.success) return { ok: false as const, error: m.error.issues[0].message };
  const ids = await audienceApplications(a.data);
  if (ids.length === 0) return { ok: false as const, error: "No candidates match this group." };
  if (ids.length > MAX_BULK_RECIPIENTS) return { ok: false as const, error: `That's ${ids.length} candidates — narrow the group to ${MAX_BULK_RECIPIENTS} or fewer (Brevo's free plan sends 300 emails a day).` };
  const r = await sendMessage(ids, m.data, admin.id);
  await db.auditEvent.create({ data: { actorId: admin.id, action: "message.bulk_sent", entityType: "Message", entityId: "*", metadata: { ...a.data, ...r, subject: m.data.subject } } });
  refresh();
  return { ok: true as const, ...r };
}

export async function sendToApplication(input: { applicationId: string; subject: string; body: string }) {
  const admin = await requireAdmin();
  const m = messageSchema.safeParse(input);
  if (!m.success) return { ok: false as const, error: m.error.issues[0].message };
  const r = await sendMessage([input.applicationId], m.data, admin.id);
  if (r.sent + r.skipped + r.failed === 0) return { ok: false as const, error: "Application not found." };
  refresh();
  return { ok: true as const, ...r };
}
