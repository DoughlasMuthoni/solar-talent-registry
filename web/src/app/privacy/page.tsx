import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { PRIVACY_NOTICE_VERSION } from "@/lib/privacy";

export const metadata: Metadata = { title: "Candidate privacy notice" };

// DRAFT for review by Waterlift Solar's data protection lead before launch (Kenya Data Protection Act 2019).
// Bump PRIVACY_NOTICE_VERSION whenever this text changes. Contact, region and retention set 2026-10-08.
const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "Who we are",
    body: <p>Waterlift Solar Limited is the data controller for information you give in this application. Contact us about your data at info@waterlift.co.ke.</p>,
  },
  {
    title: "What we collect",
    body: (
      <ul>
        <li>Contact details: name, phone, email, town and county.</li>
        <li>Your EPRA licence class, number, expiry date and any licence notes, if you hold one.</li>
        <li>Your qualifications: level, course, institution, year completed and certificate number.</li>
        <li>Work experience, equipment you have worked with, training, and referee details you provide.</li>
        <li>Any documents you choose to upload, such as a copy of your EPRA licence, qualification certificates or training certificates.</li>
        <li>Which advert or link brought you to the form (for example Facebook or WhatsApp).</li>
      </ul>
    ),
  },
  {
    title: "Why we use it",
    body: (
      <ul>
        <li>To assess your application and match you to roles in your region.</li>
        <li>To verify your licence against EPRA&apos;s public register, to confirm your qualifications with the issuing institution or examining body (for example KNEC, NITA or TVET CDACC), and to contact your referees.</li>
        <li>To understand which adverts reach technicians, so we can recruit better.</li>
      </ul>
    ),
  },
  {
    title: "Automated screening",
    body: (
      <p>
        Our system gives each application a preliminary score based on published rules (licence or qualifications, experience, technical evidence and referees). The score only helps us sort
        applications. A person reviews every application, and no one is rejected by the system alone. You can ask us to explain or reconsider an outcome.
      </p>
    ),
  },
  {
    title: "Who can see it",
    body: (
      <p>
        Only authorised Waterlift Solar recruitment staff. Your data is stored with our hosting providers, Vercel and Supabase, in the European Union (Frankfurt,
        Germany), where the GDPR applies, under contracts that protect it. Documents are kept in private storage and opened only through short-lived links. We do not sell
        your information.
      </p>
    ),
  },
  {
    title: "How long we keep it",
    body: (
      <p>
        If your application is unsuccessful or withdrawn, we automatically delete it, including any documents, 12 months after it closes. If you joined our talent pool,
        we keep your details for up to 24 months, unless you ask us to delete them sooner.
      </p>
    ),
  },
  {
    title: "Your rights",
    body: (
      <p>
        Under the Data Protection Act, 2019 you can ask to access, correct or delete your information, object to its use, or withdraw consent at any time. You can withdraw
        your application or request deletion yourself from your private status link (<Link href="/status" className="underline">check your application</Link>), or email
        info@waterlift.co.ke. You may also complain to the Office of the Data Protection Commissioner (ODPC).
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <Link href="/apply" className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm">
        <ArrowLeftIcon className="size-4" /> Back to application
      </Link>
      <Logo variant="wordmark" className="w-40" />
      <div>
        <h1 className="text-2xl font-bold">Candidate privacy notice</h1>
        <p className="text-muted-foreground text-sm">Version {PRIVACY_NOTICE_VERSION} · draft pending review</p>
      </div>
      <div className="flex flex-col gap-6 [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted-foreground [&_ul]:text-muted-foreground [&_ul]:space-y-1">
        {SECTIONS.map((s) => (
          <section key={s.title} className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{s.title}</h2>
            {s.body}
          </section>
        ))}
      </div>
    </main>
  );
}
