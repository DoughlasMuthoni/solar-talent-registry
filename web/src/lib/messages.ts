import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { EpraClass, ScreeningStatus, Stage, Track } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { MAX_BULK_RECIPIENTS } from "@/lib/message-templates";
import { REGION_NAMES } from "@/lib/reference/kenya";
import { sendEmail } from "./email/send";
import { adminMessage } from "./email/templates";

export const messageSchema = z.object({
  subject: z.string().trim().min(3, "Add a subject").max(180),
  body: z.string().trim().min(10, "Write a message").max(5000),
});

export const audienceSchema = z.object({
  stage: z.enum(Stage).optional(),
  region: z.enum(REGION_NAMES as [string, ...string[]]).optional(),
  track: z.enum(Track).optional(),
  epraClass: z.enum(EpraClass).optional(),
  status: z.enum(ScreeningStatus).optional(),
});
export type Audience = z.infer<typeof audienceSchema>;

/** Applications matching a group filter. Closed (rejected/withdrawn) only if explicitly chosen by stage. */
export async function audienceApplications(a: Audience) {
  const where: Prisma.ApplicationWhereInput = {
    ...(a.stage ? { stage: a.stage } : { stage: { notIn: ["REJECTED", "WITHDRAWN"] } }),
    ...(a.region ? { candidate: { region: a.region } } : {}),
    ...(a.track ? { track: a.track } : {}),
    ...(a.epraClass ? { licence: { epraClass: a.epraClass } } : {}),
  };
  const apps = await db.application.findMany({
    where,
    select: { id: true, scoreRuns: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } } },
    orderBy: { submittedAt: "desc" },
    take: 1000,
  });
  return (a.status ? apps.filter((x) => x.scoreRuns[0]?.status === a.status) : apps).map((x) => x.id);
}

/** Sends one personalised email per application (deduplicated per candidate within this send). */
export async function sendMessage(applicationIds: string[], msg: { subject: string; body: string }, sentById: string) {
  const apps = await db.application.findMany({
    where: { id: { in: applicationIds.slice(0, MAX_BULK_RECIPIENTS) } },
    include: { candidate: { select: { fullName: true, email: true } } },
  });
  const seen = new Set<string>();
  const result = { sent: 0, skipped: 0, failed: 0 };
  for (const a of apps) {
    const to = a.candidate.email.toLowerCase();
    if (seen.has(to)) continue;
    seen.add(to);
    const name = a.candidate.fullName.split(" ")[0];
    const email = adminMessage({ name, reference: a.reference, subject: msg.subject, body: msg.body });
    const r = await sendEmail({ kind: "ADMIN_MESSAGE", to: a.candidate.email, toName: a.candidate.fullName, email, applicationId: a.id, body: email.text, sentById });
    if (r.status === "SENT") result.sent++;
    else if (r.status === "FAILED") result.failed++;
    else result.skipped++;
  }
  return result;
}
