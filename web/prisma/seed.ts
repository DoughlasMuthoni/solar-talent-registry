/**
 * Development seed — FICTIONAL data only (example.test emails, DEMO/ licence numbers,
 * "not a real person" referees). Safe to re-run: clears demo records first.
 * Run: npm run db:seed
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type EpraClass, type InstallCategory, type SocialSource, type Stage, type Travel } from "../src/generated/prisma/client";
import { countyCode, regionOf, type County } from "../src/lib/reference/kenya";
import { RULES_V1, scoreApplication } from "../src/lib/scoring/rules";
import { scoringInclude, toScoringInput } from "../src/lib/scoring/from-application";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const daysFromNow = (n: number) => {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() + n));
};

type Demo = {
  name: string; town: string; county: County; travel: Travel; cls: EpraClass; expiresInDays: number | null;
  years: number; pv: number; categories: InstallCategory[]; strong: boolean; referees: number; stage: Stage; verified: boolean;
  source: SocialSource;
};

const DEMOS: Demo[] = [
  { name: "Demo Candidate A", town: "Eldoret", county: "Uasin Gishu", travel: "REGION", cls: "T3", expiresInDays: 150, years: 8, pv: 350, categories: ["INSTITUTIONAL", "COMMERCIAL_INDUSTRIAL", "HYBRID", "SOLAR_PUMPING"], strong: true, referees: 3, stage: "TECHNICAL_ASSESSMENT", verified: true, source: "FACEBOOK" },
  { name: "Demo Candidate B", town: "Mombasa", county: "Mombasa", travel: "COUNTY", cls: "T2", expiresInDays: 45, years: 3, pv: 30, categories: ["RESIDENTIAL", "INSTITUTIONAL"], strong: false, referees: 2, stage: "NEW", verified: false, source: "WHATSAPP" },
  { name: "Demo Candidate C", town: "Thika", county: "Kiambu", travel: "NATIONAL", cls: "T3", expiresInDays: 400, years: 12, pv: 1200, categories: ["COMMERCIAL_INDUSTRIAL", "GRID_TIED", "HYBRID", "INSTITUTIONAL", "SOLAR_PUMPING", "RESIDENTIAL"], strong: true, referees: 3, stage: "PRACTICAL_ASSESSMENT", verified: true, source: "LINKEDIN" },
  { name: "Demo Candidate D", town: "Kisumu", county: "Kisumu", travel: "REGION", cls: "T1", expiresInDays: -20, years: 5, pv: 15, categories: ["RESIDENTIAL", "SOLAR_PUMPING"], strong: false, referees: 2, stage: "NEW", verified: false, source: "FACEBOOK" },
  { name: "Demo Candidate E", town: "Nyeri", county: "Nyeri", travel: "COUNTY", cls: "NONE", expiresInDays: null, years: 2, pv: 8, categories: ["RESIDENTIAL"], strong: false, referees: 2, stage: "NEW", verified: false, source: "TIKTOK" },
  { name: "Demo Candidate F", town: "Nakuru", county: "Nakuru", travel: "NATIONAL", cls: "T2", expiresInDays: 210, years: 6, pv: 90, categories: ["HYBRID", "INSTITUTIONAL", "RESIDENTIAL"], strong: true, referees: 2, stage: "REFERENCE_CHECKS", verified: true, source: "DIRECT" },
];

async function main() {
  // Wipe previous demo data (cascades to applications, licences, consents, scores).
  await db.candidate.deleteMany({ where: { isDemo: true } });

  // Placeholder admin row; real admins are linked to Supabase Auth users in Phase 3.
  const admin = await db.user.upsert({
    where: { email: "admin@waterlift.example" },
    update: {},
    create: { id: "00000000-0000-0000-0000-000000000001", email: "admin@waterlift.example", name: "Demo Admin", role: "ADMIN" },
  });

  const ruleSet = await db.scoringRuleSet.upsert({
    where: { version: RULES_V1.version },
    update: { rules: RULES_V1, active: true },
    create: { version: RULES_V1.version, rules: RULES_V1, active: true, notes: "Initial rules carried over from the prototype.", createdById: admin.id },
  });

  for (const [i, d] of DEMOS.entries()) {
    const n = i + 1;
    const candidate = await db.candidate.create({
      data: {
        fullName: d.name,
        email: `demo-${String.fromCharCode(96 + n)}@example.test`,
        phone: `+2547000000${String(n).padStart(2, "0")}`,
        town: d.town,
        county: d.county,
        region: regionOf(d.county),
        travel: d.travel,
        isDemo: true,
        consents: {
          create: [
            { kind: "RECRUITMENT_PROCESSING", noticeVersion: "demo-1" },
            { kind: "LICENCE_VERIFICATION", noticeVersion: "demo-1" },
          ],
        },
        licences: {
          create: {
            epraClass: d.cls,
            number: d.cls === "NONE" ? null : `DEMO/SPVT/${String(n).padStart(4, "0")}`,
            expiresOn: d.expiresInDays === null ? null : daysFromNow(d.expiresInDays),
            status: d.verified ? "VERIFIED" : "PENDING",
            verifiedById: d.verified ? admin.id : null,
            verifiedAt: d.verified ? new Date() : null,
            evidenceNote: d.verified ? "Demo: class, status and expiry match the register." : null,
          },
        },
      },
      include: { licences: true },
    });

    const app = await db.application.create({
      data: {
        reference: `TMP-${n}`,
        submissionKey: `demo-${n}`,
        source: d.source,
        utmSource: d.source === "DIRECT" ? null : d.source.toLowerCase(),
        utmCampaign: d.source === "DIRECT" ? null : "technicians-2026",
        candidateId: candidate.id,
        licenceId: candidate.licences[0].id,
        stage: d.stage,
        yearsExperience: d.years,
        largestPvKwp: d.pv,
        largestInverterKw: Math.round(d.pv * 0.8),
        largestBatteryKwh: d.pv * 1.5,
        largestProject: d.strong
          ? "Demonstration record: commercial hybrid installation; claimed lead commissioning role pending evidence."
          : "Demo: backup system.",
        inverters: d.strong ? "Demonstration brands and models for interface preview only." : "Demo inverters.",
        batteries: d.strong ? "Demonstration lithium systems for interface preview only." : "Demo batteries.",
        loggerExperience: d.strong ? "Demonstration logger experience pending verification." : null,
        voltageExperience: d.strong ? "Demonstration DC and AC experience pending practical assessment." : null,
        highVoltage: d.strong,
        certifications: d.strong ? "Demonstration first aid and working-at-height training." : null,
        categories: { create: d.categories.map((category) => ({ category })) },
        referees: {
          create: Array.from({ length: d.referees }, (_, r) => ({ position: r + 1, details: `Demo referee ${r + 1} — not a real person.` })),
        },
      },
    });
    // Reference uses the DB sequence, e.g. "UAS-T3-0001".
    const reference = `${countyCode(d.county)}-${d.cls === "NONE" ? "NA" : d.cls}-${String(app.number).padStart(4, "0")}`;
    const full = await db.application.update({ where: { id: app.id }, data: { reference }, include: scoringInclude });

    const result = scoreApplication(toScoringInput(full), RULES_V1, new Date());
    await db.scoreRun.create({
      data: {
        applicationId: app.id,
        ruleSetId: ruleSet.id,
        experience: result.parts.experience,
        technical: result.parts.technical,
        verification: result.parts.verification,
        total: result.total,
        eligible: result.eligible,
        status: result.status,
        breakdown: { items: result.breakdown, eligibilityIssues: result.eligibilityIssues },
      },
    });
    console.log(`  ${reference.padEnd(13)} ${d.name.padEnd(18)} ${String(result.total).padStart(3)}  ${result.status}`);
  }
}

main()
  .then(() => console.log("Seed complete (fictional demo data)."))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
