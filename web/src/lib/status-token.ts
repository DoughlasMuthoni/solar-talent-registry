import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Private candidate status links: `<applicationId>.<expiresAtSeconds>.<hmac>` (base64url HMAC-SHA256).
 * Stateless and unguessable; anyone holding the link can view/withdraw that one application,
 * so links are only ever emailed to the candidate's own address.
 */
export const STATUS_LINK_DAYS = 30;

function secret(): string {
  const s = process.env.STATUS_LINK_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") throw new Error("STATUS_LINK_SECRET must be set (≥32 chars) in production");
  return "dev-only-status-link-secret-not-for-production-use";
}

const sign = (payload: string, key: string) => createHmac("sha256", key).update(payload).digest("base64url");

export function createStatusToken(applicationId: string, now = new Date(), days = STATUS_LINK_DAYS, key = secret()): string {
  const exp = Math.floor(now.getTime() / 1000) + days * 86_400;
  const payload = `${applicationId}.${exp}`;
  return `${payload}.${sign(payload, key)}`;
}

/** Returns the application id if the token is authentic and unexpired, else null. */
export function verifyStatusToken(token: string | null | undefined, now = new Date(), key = secret()): string | null {
  if (!token || token.length > 200) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [id, expStr, mac] = parts;
  if (!/^[a-z0-9]{10,40}$/i.test(id) || !/^\d{9,11}$/.test(expStr)) return null;
  const expected = Buffer.from(sign(`${id}.${expStr}`, key));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (Number(expStr) * 1000 < now.getTime()) return null;
  return id;
}
