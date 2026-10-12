import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { rateLimitKey } from "./rate-limit-key";

/**
 * Fixed-window rate limit for public endpoints, stored in Postgres (no Redis needed on Vercel).
 * Limits are generous on purpose: Kenyan mobile networks put many people behind one IP (CGNAT).
 * Fails open if the database errors, so abuse protection can never block a genuine applicant.
 */
export async function rateLimit(action: string, limit: number, windowSeconds: number): Promise<{ ok: boolean }> {
  try {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
    const { key, expiresAt } = rateLimitKey(action, ip, windowSeconds, new Date());
    const rows = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO "rate_limits" ("key", "count", "expiresAt") VALUES (${key}, 1, ${expiresAt})
      ON CONFLICT ("key") DO UPDATE SET "count" = "rate_limits"."count" + 1
      RETURNING "count"`;
    return { ok: (rows[0]?.count ?? 1) <= limit };
  } catch (e) {
    console.error("rateLimit failed open", e);
    return { ok: true };
  }
}
