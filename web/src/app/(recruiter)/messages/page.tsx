import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ToneBadge } from "@/components/tone-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { EmailKind, EmailStatus } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { MessageComposer } from "./message-composer";

export const metadata: Metadata = { title: "Messages" };

const KIND: Record<EmailKind, string> = {
  APPLICATION_RECEIVED: "Application confirmation",
  STATUS_LINK: "Status link",
  LICENCE_EXPIRY: "Licence reminder",
  ADMIN_DIGEST: "Daily summary",
  ASSESSMENT_INVITE: "Assessment invitation",
  ADMIN_MESSAGE: "Message from admin",
};
const STATUS: Record<EmailStatus, { label: string; tone: "success" | "neutral" | "danger" }> = {
  SENT: { label: "Sent", tone: "success" },
  SKIPPED: { label: "Not sent", tone: "neutral" },
  FAILED: { label: "Failed", tone: "danger" },
};
const fmt = (d: Date) => new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(d);

export default function MessagesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="text-muted-foreground text-sm">Email a group of candidates, and see every email the system has sent.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Message a group</CardTitle>
          <CardDescription>Choose who, pick a template or write your own. Each candidate receives a personal email; it also appears on their history.</CardDescription>
        </CardHeader>
        <CardContent>
          <MessageComposer />
        </CardContent>
      </Card>
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" aria-label="Loading email log" />}>
        <EmailLog />
      </Suspense>
    </div>
  );
}

async function EmailLog() {
  await connection();
  await requireAdmin();
  const logs = await db.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { sentBy: { select: { name: true } } } });
  const failed = logs.filter((l) => l.status === "FAILED").length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Email log</CardTitle>
        <CardDescription>
          Latest {logs.length} emails{failed ? ` · ${failed} failed — check the address or Brevo` : ""}.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {logs.length === 0 ? (
          <p className="text-muted-foreground text-sm">No emails yet.</p>
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-muted-foreground text-left text-xs">
                <th className="py-1 font-medium">When</th>
                <th className="py-1 font-medium">Type</th>
                <th className="py-1 font-medium">To</th>
                <th className="py-1 font-medium">Subject</th>
                <th className="py-1 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t align-top">
                  <td className="py-2 whitespace-nowrap">{fmt(l.createdAt)}</td>
                  <td className="py-2">
                    {KIND[l.kind]}
                    {l.sentBy && <span className="text-muted-foreground block text-xs">by {l.sentBy.name}</span>}
                  </td>
                  <td className="py-2 break-all">
                    {l.applicationId ? (
                      <Link href={`/candidates/${l.applicationId}`} className="hover:underline">
                        {l.to}
                      </Link>
                    ) : (
                      l.to
                    )}
                  </td>
                  <td className="py-2">{l.subject}</td>
                  <td className="py-2" title={l.error ?? undefined}>
                    <ToneBadge tone={STATUS[l.status].tone}>{STATUS[l.status].label}</ToneBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
