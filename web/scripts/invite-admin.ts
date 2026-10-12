/**
 * Invite an admin: sends a Supabase invitation email and records the person as an Admin.
 *   npm run admin:invite -- someone@waterliftsolar.co.ke "Full Name"
 * Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SITE_URL and DATABASE_URL.
 * Run it from a trusted machine only — the service-role key bypasses all Supabase security.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const [email, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(" ").trim();
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name) {
  console.error('Usage: npm run admin:invite -- <email> "<Full Name>"');
  process.exit(1);
}

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceKey, NEXT_PUBLIC_SITE_URL: site, DATABASE_URL: dbUrl } = process.env;
for (const [k, v] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceKey, NEXT_PUBLIC_SITE_URL: site, DATABASE_URL: dbUrl })) {
  if (!v) {
    console.error(`${k} is not set (see .env.example)`);
    process.exit(1);
  }
}

const supabase = createClient(url!, serviceKey!, { auth: { autoRefreshToken: false, persistSession: false } });
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbUrl! }) });

async function main() {
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${site}/auth/confirm?type=invite&next=/account/password`,
    data: { name },
  });
  if (error || !data.user) throw new Error(`Supabase invite failed: ${error?.message ?? "no user returned"}`);

  await db.user.upsert({
    where: { id: data.user.id },
    update: { email, name, role: "ADMIN", active: true },
    create: { id: data.user.id, email, name, role: "ADMIN" },
  });
  await db.auditEvent.create({ data: { action: "admin.invited", entityType: "User", entityId: data.user.id, metadata: { email } } });
  console.log(`Invited ${name} <${email}> as Admin. They will receive an email to set their password.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
