import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { authConfigured, supabaseServer } from "./supabase";

export type Admin = { id: string; email: string; name: string; devBypass: boolean };

/**
 * Two-factor state for a signed-in admin:
 *  - "ok":        authenticator verified this session (aal2), or dev bypass
 *  - "challenge": has an authenticator but hasn't entered a code yet this session → /login/mfa
 *  - "enroll":    no authenticator set up yet → /account/security (2FA is mandatory for admins)
 */
export type MfaState = "ok" | "challenge" | "enroll";

/**
 * Resolves the current admin. One role exists (Admin): a verified Supabase Auth session AND an
 * active row in `users` with the same id. Admins must also pass two-factor authentication.
 * Until Supabase is configured, development (never production) uses the seeded demo admin.
 */
const resolve = cache(async (): Promise<{ admin: Admin | null; signedIn: boolean; mfa: MfaState }> => {
  if (!authConfigured) {
    if (process.env.NODE_ENV === "production") return { admin: null, signedIn: false, mfa: "ok" };
    const dev = await db.user.findFirst({ where: { role: "ADMIN", active: true }, orderBy: { createdAt: "asc" } });
    return { admin: dev ? { id: dev.id, email: dev.email, name: dev.name, devBypass: true } : null, signedIn: Boolean(dev), mfa: "ok" };
  }

  const supabase = await supabaseServer();
  // getUser() validates the session with the Auth server — never trust getSession() for authorization.
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { admin: null, signedIn: false, mfa: "ok" };
  const user = await db.user.findUnique({ where: { id: data.user.id } });
  if (!user?.active || user.role !== "ADMIN") return { admin: null, signedIn: true, mfa: "ok" };

  const hasAuthenticator = (data.user.factors ?? []).some((f) => f.factor_type === "totp" && f.status === "verified");
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const mfa: MfaState = !hasAuthenticator ? "enroll" : aal?.currentLevel === "aal2" ? "ok" : "challenge";
  return { admin: { id: user.id, email: user.email, name: user.name, devBypass: false }, signedIn: true, mfa };
});

export async function getAdmin(): Promise<Admin | null> {
  const r = await resolve();
  return r.mfa === "ok" ? r.admin : null;
}

/** Use at the top of every admin page, data function, route handler and server action. Enforces 2FA. */
export async function requireAdmin(): Promise<Admin> {
  const { admin, signedIn, mfa } = await resolve();
  if (!admin) redirect(signedIn ? "/login?error=not-admin" : "/login");
  if (mfa === "challenge") redirect("/login/mfa");
  if (mfa === "enroll") redirect("/account/security?setup=1");
  return admin;
}

/** Only for the 2FA setup/verify flow itself: a signed-in admin who may not have passed 2FA yet. */
export async function requireAdminForMfaSetup(): Promise<Admin & { mfa: MfaState }> {
  const { admin, signedIn, mfa } = await resolve();
  if (!admin) redirect(signedIn ? "/login?error=not-admin" : "/login");
  return { ...admin, mfa };
}
