import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusRequestForm } from "./request-form";

export const metadata: Metadata = { title: "Check your application", robots: { index: false } };

export default function StatusPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10">
      <Link href="/" className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm">
        <ArrowLeftIcon className="size-4" /> Home
      </Link>
      <Logo variant="wordmark" className="w-40" />
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Check your application</CardTitle>
          <CardDescription>We will email a private link to the address on your application. From there you can see your progress or withdraw.</CardDescription>
        </CardHeader>
        <CardContent>
          <StatusRequestForm />
        </CardContent>
      </Card>
    </main>
  );
}
