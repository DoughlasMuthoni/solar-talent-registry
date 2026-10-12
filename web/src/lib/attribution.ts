import type { SocialSource } from "@/generated/prisma/enums";

/**
 * Campaign attribution for social-media job adverts.
 * Share links like  /apply?src=facebook  or  /apply?utm_source=fb&utm_campaign=technicians-2026
 * Values come from the URL, so they are untrusted: normalise, cap length, never render as HTML.
 */
export type Attribution = {
  source: SocialSource;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
};

const ALIASES: Record<string, SocialSource> = {
  facebook: "FACEBOOK", fb: "FACEBOOK", meta: "FACEBOOK", "m.facebook.com": "FACEBOOK", "l.facebook.com": "FACEBOOK",
  instagram: "INSTAGRAM", ig: "INSTAGRAM", insta: "INSTAGRAM", "l.instagram.com": "INSTAGRAM",
  linkedin: "LINKEDIN", li: "LINKEDIN", "lnkd.in": "LINKEDIN",
  x: "X", twitter: "X", "t.co": "X",
  tiktok: "TIKTOK", tt: "TIKTOK",
  whatsapp: "WHATSAPP", wa: "WHATSAPP", "wa.me": "WHATSAPP",
  youtube: "YOUTUBE", yt: "YOUTUBE", "youtu.be": "YOUTUBE",
};

const clean = (v: unknown) => {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase().replace(/[^a-z0-9._\-]/g, "").slice(0, 100);
  return s || null;
};

export function sourceFrom(value: string | null): SocialSource {
  if (!value) return "DIRECT";
  return ALIASES[value] ?? ALIASES[value.replace(/^www\./, "")] ?? "OTHER";
}

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** From the apply page's searchParams. `src` is the short form for hand-made share links. */
export function attributionFromParams(params: Params): Attribution {
  const utmSource = clean(first(params.utm_source)) ?? clean(first(params.src));
  return {
    source: sourceFrom(utmSource),
    utmSource,
    utmMedium: clean(first(params.utm_medium)),
    utmCampaign: clean(first(params.utm_campaign)),
  };
}

/** Re-normalises attribution sent back from the browser (it round-trips through the client). */
export function sanitizeAttribution(input: unknown): Attribution {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const utmSource = clean(o.utmSource);
  return { source: sourceFrom(utmSource), utmSource, utmMedium: clean(o.utmMedium), utmCampaign: clean(o.utmCampaign) };
}
