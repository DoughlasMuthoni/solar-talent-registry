import "server-only";
import { db } from "@/lib/db";
import { removeObjects } from "@/lib/storage";

/**
 * Permanently erases a candidate (Kenya DPA right to erasure / retention expiry):
 * stored files, emails sent to them, audit entries that may quote their details, and every
 * database row (applications, licences, consents, referees, notes, scores cascade).
 * Leaves one PII-free audit entry recording that an erasure happened, why and by whom.
 */
export async function eraseCandidate(candidateId: string, opts: { reason: "candidate_request" | "retention_expired"; actorId?: string | null }) {
  const apps = await db.application.findMany({
    where: { candidateId },
    select: { id: true, documents: { select: { storageKey: true } } },
  });
  const appIds = apps.map((a) => a.id);

  await removeObjects(apps.flatMap((a) => a.documents.map((d) => d.storageKey)));

  await db.$transaction(
    [
      db.emailLog.deleteMany({ where: { applicationId: { in: appIds } } }),
      db.auditEvent.deleteMany({ where: { entityType: "Application", entityId: { in: appIds } } }),
      db.candidate.delete({ where: { id: candidateId } }),
      db.auditEvent.create({
        data: {
          actorId: opts.actorId ?? null,
          action: "candidate.erased",
          entityType: "Candidate",
          entityId: candidateId,
          metadata: { reason: opts.reason, applications: appIds.length },
        },
      }),
    ],
    { timeout: 20_000, maxWait: 10_000 },
  );
  return { applications: appIds.length };
}
