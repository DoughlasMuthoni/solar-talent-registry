import "server-only";
import { StorageClient } from "@supabase/storage-js";

/**
 * Private document storage (Supabase Storage). Server-only: uses the secret key, which bypasses RLS,
 * so it must never reach a browser. Browsers only ever get short-lived signed URLs for one object.
 */
import { ALLOWED_TYPES, BUCKET, MAX_FILE_BYTES, MAX_FILES_PER_APPLICATION, type AllowedType } from "./upload-config";

export { ALLOWED_TYPES, BUCKET, MAX_FILE_BYTES, MAX_FILES_PER_APPLICATION, type AllowedType };

export const storageConfigured = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

// Storage-only client: no auth/realtime machinery (realtime needs native WebSocket, i.e. Node 22+).
let client: StorageClient | null = null;
export function storageClient() {
  if (!storageConfigured()) throw new Error("Document storage is not configured (SUPABASE_SERVICE_ROLE_KEY missing)");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  client ??= new StorageClient(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1`, { apikey: key, Authorization: `Bearer ${key}` });
  return client;
}
export const storage = () => storageClient().from(BUCKET);

/** Checks the file's first bytes really match its declared type (a renamed .exe is rejected). */
export function sniffMatches(type: AllowedType, head: Uint8Array): boolean {
  const starts = (...b: number[]) => b.every((v, i) => head[i] === v);
  switch (type) {
    case "application/pdf":
      return starts(0x25, 0x50, 0x44, 0x46); // %PDF
    case "image/jpeg":
      return starts(0xff, 0xd8, 0xff);
    case "image/png":
      return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "image/webp":
      return starts(0x52, 0x49, 0x46, 0x46) && head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50; // RIFF....WEBP
  }
}

/** Removes objects, ignoring "not found". Safe to call when storage isn't configured (no-op). */
export async function removeObjects(paths: string[]) {
  if (!paths.length || !storageConfigured()) return;
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await storage().remove(paths.slice(i, i + 100));
    if (error) console.error("storage remove failed", error.message);
  }
}
