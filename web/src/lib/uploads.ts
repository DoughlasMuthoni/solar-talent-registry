import "server-only";
import { randomUUID } from "node:crypto";
import type { DocumentKind } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { ALLOWED_TYPES, MAX_FILE_BYTES, MAX_FILES_PER_APPLICATION, removeObjects, sniffMatches, storage, storageConfigured, type AllowedType } from "@/lib/storage";

/**
 * Candidate uploads, in two phases:
 * 1. While filling the form: a signed, single-object upload URL under pending/<submissionKey>/ (browser → Storage directly).
 * 2. On submit: each pending file is re-checked (size + real file signature), moved to applications/<id>/ and recorded.
 * Abandoned pending files are removed by the daily job after 24 hours.
 */
const PENDING = "pending";
export const UPLOAD_KINDS = ["EPRA_LICENCE", "QUALIFICATION", "CERTIFICATE"] as const satisfies readonly DocumentKind[];
export type UploadRef = { path: string; kind: (typeof UPLOAD_KINDS)[number]; fileName: string };

export const uploadsEnabled = storageConfigured;

const safeName = (n: string) => n.replace(/[^\w.\- ()]+/g, "_").slice(0, 120) || "document";

export async function createPendingUpload(input: { submissionKey: string; type: string; size: number }) {
  if (!(input.type in ALLOWED_TYPES)) return { ok: false as const, error: "Upload a PDF, JPG, PNG or WebP file." };
  if (!Number.isFinite(input.size) || input.size <= 0 || input.size > MAX_FILE_BYTES) return { ok: false as const, error: "Files must be 5 MB or smaller." };

  const folder = `${PENDING}/${input.submissionKey}`;
  const { data: existing } = await storage().list(folder, { limit: 100 });
  if ((existing?.length ?? 0) >= MAX_FILES_PER_APPLICATION) return { ok: false as const, error: `You can upload up to ${MAX_FILES_PER_APPLICATION} files.` };

  const path = `${folder}/${randomUUID()}.${ALLOWED_TYPES[input.type as AllowedType]}`;
  const { data, error } = await storage().createSignedUploadUrl(path);
  if (error || !data) return { ok: false as const, error: "Upload is unavailable right now. You can still apply without documents." };
  return { ok: true as const, path, token: data.token };
}

/** Moves verified pending files to the application and records them. Returns how many were accepted. */
export async function finalizeUploads(applicationId: string, submissionKey: string, refs: UploadRef[]) {
  const prefix = `${PENDING}/${submissionKey}/`;
  let accepted = 0;
  for (const ref of refs.slice(0, MAX_FILES_PER_APPLICATION)) {
    if (!ref.path.startsWith(prefix) || ref.path.includes("..") || !UPLOAD_KINDS.includes(ref.kind)) continue;
    const ext = ref.path.split(".").pop() ?? "";
    const type = (Object.keys(ALLOWED_TYPES) as AllowedType[]).find((t) => ALLOWED_TYPES[t] === ext);
    if (!type) continue;

    const { data: blob, error } = await storage().download(ref.path);
    if (error || !blob) continue;
    const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
    if (blob.size > MAX_FILE_BYTES || !sniffMatches(type, head)) {
      await removeObjects([ref.path]); // not what it claims to be — never keep it
      continue;
    }
    const finalPath = `applications/${applicationId}/${ref.path.slice(prefix.length)}`;
    const { error: moveErr } = await storage().move(ref.path, finalPath);
    if (moveErr) continue;
    await db.document.create({
      data: { applicationId, kind: ref.kind, storageKey: finalPath, fileName: safeName(ref.fileName), mimeType: type, sizeBytes: blob.size, scanStatus: "PENDING" },
    });
    accepted++;
  }
  return accepted;
}

/** Deletes pending uploads older than 24 hours (forms started but never submitted). */
export async function cleanupPendingUploads(now: Date) {
  if (!storageConfigured()) return 0;
  const cutoff = now.getTime() - 24 * 3_600_000;
  const { data: folders } = await storage().list(PENDING, { limit: 1000 });
  let removed = 0;
  for (const f of folders ?? []) {
    const { data: files } = await storage().list(`${PENDING}/${f.name}`, { limit: 100 });
    const stale = (files ?? []).filter((x) => x.created_at && new Date(x.created_at).getTime() < cutoff).map((x) => `${PENDING}/${f.name}/${x.name}`);
    await removeObjects(stale);
    removed += stale.length;
  }
  return removed;
}

export async function signedViewUrl(storageKey: string) {
  const { data, error } = await storage().createSignedUrl(storageKey, 60);
  if (error || !data) throw new Error("Could not create a link for this document");
  return data.signedUrl;
}
