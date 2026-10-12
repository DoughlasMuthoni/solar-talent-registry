import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  // On Vercel this is Supabase's transaction pooler (port 6543), so keep the per-instance pool small.
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 5 }) });
}

// Reuse one client across hot reloads in development and warm serverless invocations.
export const db = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
