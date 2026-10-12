import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { EmailKind, EmailStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import type { Email } from "./templates";

/**
 * Sends through Brevo's transactional API and records every attempt in `email_logs`.
 * - No BREVO_API_KEY → logged as SKIPPED (development, or before Brevo is connected). Never throws.
 * - `dedupeKey` → at most one SENT/SKIPPED email per key (scheduled jobs can re-run safely).
 * Env: BREVO_API_KEY, EMAIL_FROM_ADDRESS (a Brevo-verified sender), EMAIL_FROM_NAME, EMAIL_REPLY_TO (optional).
 */
export async function sendEmail(opts: {
  kind: EmailKind;
  to: string;
  toName?: string;
  email: Email;
  dedupeKey?: string;
  applicationId?: string;
  /** Admin-written messages only: keep the text and the sender for the candidate history. */
  body?: string;
  sentById?: string;
}): Promise<{ status: EmailStatus | "DUPLICATE" }> {
  if (opts.dedupeKey) {
    const prior = await db.emailLog.findUnique({ where: { dedupeKey: opts.dedupeKey }, select: { status: true } });
    if (prior && prior.status !== "FAILED") return { status: "DUPLICATE" };
    // A previous FAILED attempt keeps the key; free it so this retry can record its outcome.
    if (prior) await db.emailLog.update({ where: { dedupeKey: opts.dedupeKey }, data: { dedupeKey: null } });
  }

  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.EMAIL_FROM_ADDRESS;
  let status: EmailStatus = "SKIPPED";
  let providerId: string | null = null;
  let error: string | null = null;

  if (apiKey && from) {
    try {
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          sender: { email: from, name: process.env.EMAIL_FROM_NAME || "Waterlift Solar Careers" },
          to: [{ email: opts.to, ...(opts.toName ? { name: opts.toName } : {}) }],
          ...(process.env.EMAIL_REPLY_TO ? { replyTo: { email: process.env.EMAIL_REPLY_TO } } : {}),
          subject: opts.email.subject,
          htmlContent: opts.email.html,
          textContent: opts.email.text,
          tags: [opts.kind.toLowerCase()],
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const body = (await res.json().catch(() => ({}))) as { messageId?: string; message?: string };
      if (res.ok) {
        status = "SENT";
        providerId = body.messageId ?? null;
      } else {
        status = "FAILED";
        error = `Brevo ${res.status}: ${body.message ?? "unknown error"}`.slice(0, 500);
      }
    } catch (e) {
      status = "FAILED";
      error = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    }
  } else if (process.env.NODE_ENV !== "production") {
    console.info(`[email:skipped] ${opts.kind} → ${opts.to}: ${opts.email.subject}\n${opts.email.text}`);
  }

  try {
    await db.emailLog.create({
      data: {
        kind: opts.kind,
        to: opts.to,
        subject: opts.email.subject.slice(0, 200),
        dedupeKey: opts.dedupeKey ?? null,
        status,
        providerId,
        error,
        applicationId: opts.applicationId ?? null,
        body: opts.body ?? null,
        sentById: opts.sentById ?? null,
      },
    });
  } catch (e) {
    // Lost a race on the same dedupeKey: the other run already handled it.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { status: "DUPLICATE" };
    throw e;
  }
  if (status === "FAILED") console.error(`[email:failed] ${opts.kind} → ${opts.to}: ${error}`);
  return { status };
}
