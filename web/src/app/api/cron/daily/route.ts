import { timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { eraseCandidate } from "@/lib/erasure";
import { shouldErase } from "@/lib/retention";
import { cleanupPendingUploads } from "@/lib/uploads";
import { sendEmail } from "@/lib/email/send";
import { adminDigest, licenceExpiry } from "@/lib/email/templates";
import { reminderMilestone } from "@/lib/reminders";
import { daysUntil } from "@/lib/scoring/rules";
import { siteUrl } from "@/lib/site-url";

/**
 * Daily job (Vercel Cron, see vercel.json): licence-expiry reminders, admin summary, data-retention
 * erasure (12 / 24 months), and housekeeping (expired rate-limit buckets, abandoned uploads).
 * Vercel sends `Authorization: Bearer $CRON_SECRET`. Safe to re-run: every email is de-duplicated.
 */
export const maxDuration = 60;

function authorised(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  await connection();
  if (!authorised(request)) return new Response("Unauthorized", { status: 401 });

  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(now); // YYYY-MM-DD in Kenya

  // 1. Licence-expiry reminders for open applications.
  const open = await db.application.findMany({
    where: { stage: { notIn: ["REJECTED", "WITHDRAWN"] }, licence: { expiresOn: { not: null } } },
    include: { candidate: { select: { fullName: true, email: true } }, licence: { select: { id: true, expiresOn: true } } },
  });
  const counts = { reminders: 0, skipped: 0, failed: 0, digests: 0 };
  const expiringSoon: { reference: string; name: string; detail: string; daysLeft: number }[] = [];

  for (const a of open) {
    const iso = a.licence!.expiresOn!.toISOString().slice(0, 10);
    const daysLeft = daysUntil(iso, now);
    if (daysLeft !== null && daysLeft >= 0 && daysLeft <= 30) {
      expiringSoon.push({ reference: a.reference, name: a.candidate.fullName, daysLeft, detail: daysLeft === 0 ? "expires today" : `${daysLeft} days left` });
    }
    const milestone = reminderMilestone(daysLeft);
    if (milestone === null) continue;
    const r = await sendEmail({
      kind: "LICENCE_EXPIRY",
      to: a.candidate.email,
      toName: a.candidate.fullName,
      email: licenceExpiry({ name: a.candidate.fullName, reference: a.reference, daysLeft: daysLeft!, expiresOn: iso }),
      dedupeKey: `licence-expiry:${a.licence!.id}:${milestone}`,
      applicationId: a.id,
    });
    if (r.status === "SENT") counts.reminders++;
    else if (r.status === "SKIPPED") counts.skipped++;
    else if (r.status === "FAILED") counts.failed++;
  }

  // 2. Daily summary to every active admin (once per admin per day).
  const since = new Date(now.getTime() - 86_400_000);
  const [newApps, pendingVerification, admins] = await Promise.all([
    db.application.findMany({ where: { submittedAt: { gte: since } }, select: { scoreRuns: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } } } }),
    // Open applications whose credentials still need a human check: the licence (EPRA track) or any qualification (qualified track).
    db.application.count({
      where: {
        stage: { notIn: ["REJECTED", "WITHDRAWN"] },
        OR: [
          { track: "EPRA_LICENSED", licence: { status: "PENDING", epraClass: { not: "NONE" } } },
          { track: "QUALIFIED", qualifications: { some: {} }, NOT: { qualifications: { some: { status: "VERIFIED" } } } },
        ],
      },
    }),
    db.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true, email: true, name: true } }),
  ]);
  const email = adminDigest({
    date: today,
    dashboardUrl: siteUrl("/dashboard"),
    newApplications: newApps.length,
    newPriority: newApps.filter((a) => a.scoreRuns[0]?.status === "PRIORITY_REVIEW").length,
    pendingVerification,
    expiring: expiringSoon.sort((x, y) => x.daysLeft - y.daysLeft),
  });
  for (const admin of admins) {
    const r = await sendEmail({ kind: "ADMIN_DIGEST", to: admin.email, toName: admin.name, email, dedupeKey: `admin-digest:${admin.id}:${today}` });
    if (r.status === "SENT") counts.digests++;
  }

  // 3. Retention: erase candidates whose applications all closed long enough ago (see lib/retention.ts).
  const CLOSED = ["REJECTED", "WITHDRAWN"] as const;
  const closedCandidates = await db.candidate.findMany({
    where: { applications: { some: {}, every: { stage: { in: [...CLOSED] } } } },
    select: {
      id: true,
      consents: { where: { kind: "TALENT_POOL", withdrawnAt: null }, select: { id: true } },
      applications: {
        select: { stage: true, stageChanges: { where: { toStage: { in: [...CLOSED] } }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } },
      },
    },
    take: 500,
  });
  let erased = 0;
  for (const c of closedCandidates) {
    if (erased >= 50) break; // bounded per run; the rest are picked up tomorrow
    const due = shouldErase({
      applications: c.applications.map((a) => ({ stage: a.stage, closedAt: a.stageChanges[0]?.createdAt ?? null })),
      talentPoolConsent: c.consents.length > 0,
      now,
    });
    if (!due) continue;
    await eraseCandidate(c.id, { reason: "retention_expired" });
    erased++;
  }

  // 4. Housekeeping.
  const { count: rateLimitsCleared } = await db.rateLimit.deleteMany({ where: { expiresAt: { lt: now } } });
  const uploadsCleared = await cleanupPendingUploads(now).catch((e) => {
    console.error("pending upload cleanup failed", e);
    return 0;
  });

  return Response.json({ ok: true, date: today, openApplications: open.length, ...counts, erased, rateLimitsCleared, uploadsCleared });
}
