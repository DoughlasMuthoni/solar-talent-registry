import "server-only";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/site-url";
import { createStatusToken } from "@/lib/status-token";
import { sendEmail } from "./send";
import { applicationReceived, statusLink } from "./templates";

const statusUrl = (applicationId: string) => siteUrl(`/status/view?token=${encodeURIComponent(createStatusToken(applicationId))}`);

/** Confirmation after a successful submission (idempotent per application). */
export async function sendApplicationReceived(applicationId: string) {
  const a = await db.application.findUnique({ where: { id: applicationId }, include: { candidate: true } });
  if (!a) return;
  await sendEmail({
    kind: "APPLICATION_RECEIVED",
    to: a.candidate.email,
    toName: a.candidate.fullName,
    email: applicationReceived({ name: a.candidate.fullName, reference: a.reference, statusUrl: statusUrl(a.id) }),
    dedupeKey: `application-received:${a.id}`,
    applicationId: a.id,
  });
}

/** A fresh status link, on request. Limited to 3 per application per hour. */
export async function sendStatusLink(applicationId: string) {
  const a = await db.application.findUnique({ where: { id: applicationId }, include: { candidate: true } });
  if (!a) return;
  const recent = await db.emailLog.count({
    where: { applicationId, kind: "STATUS_LINK", createdAt: { gte: new Date(Date.now() - 3_600_000) } },
  });
  if (recent >= 3) return;
  await sendEmail({
    kind: "STATUS_LINK",
    to: a.candidate.email,
    toName: a.candidate.fullName,
    email: statusLink({ name: a.candidate.fullName, reference: a.reference, url: statusUrl(a.id) }),
    applicationId: a.id,
  });
}
