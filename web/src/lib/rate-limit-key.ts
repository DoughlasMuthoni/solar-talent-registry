import { createHmac } from "node:crypto";

/** Pure: the bucket key for this action/IP/window. The IP is HMAC'd so raw addresses are never stored. */
export function rateLimitKey(action: string, ip: string, windowSeconds: number, now: Date, salt = process.env.STATUS_LINK_SECRET ?? "dev-salt") {
  const window = Math.floor(now.getTime() / 1000 / windowSeconds);
  const ipHash = createHmac("sha256", salt).update(ip).digest("base64url").slice(0, 22);
  return { key: `${action}:${ipHash}:${window}`, expiresAt: new Date((window + 1) * windowSeconds * 1000) };
}
