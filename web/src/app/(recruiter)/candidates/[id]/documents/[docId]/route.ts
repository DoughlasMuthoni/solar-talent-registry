import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { signedViewUrl } from "@/lib/uploads";

/** Admin-only: redirect to a 60-second signed URL for one document. Every view is audited. */
export async function GET(_req: Request, ctx: RouteContext<"/candidates/[id]/documents/[docId]">) {
  const admin = await requireAdmin();
  const { id, docId } = await ctx.params;
  const doc = await db.document.findFirst({ where: { id: docId, applicationId: id } });
  if (!doc) notFound();
  const url = await signedViewUrl(doc.storageKey);
  await db.auditEvent.create({
    data: { actorId: admin.id, action: "document.viewed", entityType: "Application", entityId: id, metadata: { documentId: doc.id, kind: doc.kind } },
  });
  redirect(url);
}
