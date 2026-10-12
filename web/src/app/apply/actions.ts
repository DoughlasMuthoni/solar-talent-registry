"use server";

import { after } from "next/server";
import { createApplication } from "@/lib/applications/create";
import { sanitizeAttribution } from "@/lib/attribution";
import { sendApplicationReceived } from "@/lib/email/candidate-emails";
import { rateLimit } from "@/lib/rate-limit";
import { UPLOAD_KINDS, createPendingUpload, finalizeUploads, uploadsEnabled, type UploadRef } from "@/lib/uploads";
import { applicationSchema } from "@/lib/validation/application";

export type SubmitResult =
  | { ok: true; reference: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Public, unauthenticated endpoint (reachable by direct POST) — trust nothing from the client.
 * Returns only what the UI needs: the reference, or field messages.
 */
export async function submitApplication(payload: {
  values: unknown;
  attribution: unknown;
  submissionKey: unknown;
  website?: unknown;
  uploads?: unknown;
}): Promise<SubmitResult> {
  // Honeypot: real people never see or fill this field.
  if (typeof payload.website === "string" && payload.website.trim() !== "") {
    return { ok: false, error: "We could not accept this submission." };
  }
  if (typeof payload.submissionKey !== "string" || !/^[A-Za-z0-9_-]{16,64}$/.test(payload.submissionKey)) {
    return { ok: false, error: "Please refresh the page and try again." };
  }

  // Generous per-IP cap (shared mobile IPs) — stops scripted floods, not people.
  if (!(await rateLimit("apply", 30, 3600)).ok) {
    return { ok: false, error: "Too many applications from this network in the last hour. Your answers are saved — please try again later." };
  }

  const parsed = applicationSchema.safeParse(payload.values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, error: "Some answers need attention.", fieldErrors };
  }

  try {
    const { reference, applicationId } = await createApplication(parsed.data, sanitizeAttribution(payload.attribution), payload.submissionKey);
    const uploads = parseUploads(payload.uploads);
    const key = payload.submissionKey;
    // After the response: verify + attach documents, then the confirmation email. Neither can fail the submission.
    after(async () => {
      if (uploads.length && uploadsEnabled()) await finalizeUploads(applicationId, key, uploads).catch((e) => console.error("finalize uploads failed", e));
      await sendApplicationReceived(applicationId).catch((e) => console.error("confirmation email failed", e));
    });
    return { ok: true, reference };
  } catch (e) {
    console.error("submitApplication failed", e);
    return { ok: false, error: "Something went wrong saving your application. Please try again in a moment." };
  }
}

function parseUploads(v: unknown): UploadRef[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((u): u is UploadRef =>
      Boolean(u) && typeof u.path === "string" && typeof u.fileName === "string" && (UPLOAD_KINDS as readonly string[]).includes(u.kind),
    )
    .slice(0, 6);
}

/** Public: a one-time signed upload URL for a single document (PDF/JPG/PNG/WebP, ≤5 MB). */
export async function requestUploadUrl(input: { submissionKey: unknown; type: unknown; size: unknown }) {
  if (!uploadsEnabled()) return { ok: false as const, error: "Document upload is not available yet. You can still apply." };
  if (typeof input.submissionKey !== "string" || !/^[A-Za-z0-9_-]{16,64}$/.test(input.submissionKey)) return { ok: false as const, error: "Please refresh the page." };
  if (!(await rateLimit("upload", 60, 3600)).ok) return { ok: false as const, error: "Too many uploads from this network. Try again later." };
  return createPendingUpload({ submissionKey: input.submissionKey, type: String(input.type), size: Number(input.size) });
}
