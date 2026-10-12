import { z } from "zod";
import { EpraClass, Engagement, InstallCategory, QualificationLevel, Track, Travel } from "@/generated/prisma/enums";
import { MAX_QUALIFICATIONS } from "@/lib/qualifications";
import { COUNTIES } from "@/lib/reference/kenya";

/**
 * Technician application schema — shared by the client form (per-step validation)
 * and the server action (full validation). Server must always re-validate.
 */

/** Accepts 07xx/01xx, 7xx/1xx, 2547xx or +2547xx and normalises to E.164 (+2547xxxxxxxx). */
export const kenyanPhone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s()-]/g, ""))
  .refine((v) => /^(?:\+?254|0)?[17]\d{8}$/.test(v), "Enter a Kenyan mobile number, e.g. 0712 345 678")
  .transform((v) => `+254${v.slice(-9)}`);

const text = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters`);
const optionalText = (max: number) => text(max).optional().transform((v) => (v ? v : undefined));
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker");
const quantity = (max: number) =>
  z.number({ error: "Enter a number" }).min(0, "Cannot be negative").max(max, `Must be ${max} or less`);

export const identityStep = z.object({
  fullName: text(200).min(3, "Enter your full legal name"),
  phone: kenyanPhone,
  email: z.email("Enter a valid email address").max(254),
  town: text(120).min(2, "Enter your current town"),
  county: z.enum(COUNTIES, { error: "Select your county" }),
  travel: z.enum(Travel),
  engagement: z.enum(Engagement),
});

type Ctx = z.RefinementCtx;

type CredentialValues = {
  track: string;
  epraClass?: string;
  licenceNumber?: string;
  licenceExpiresOn?: string;
  qualifications: unknown[];
};

/**
 * EPRA track: a T1–T3 class plus the number and expiry, so the licence can be verified.
 * Qualified track: at least one qualification. Anyone may list qualifications and a licence.
 */
function licenceRule(v: CredentialValues, ctx: Ctx) {
  if (v.track === "EPRA_LICENSED" && (!v.epraClass || v.epraClass === "NONE")) {
    ctx.addIssue({ code: "custom", path: ["epraClass"], message: "Select your licence class, or choose “Qualified solar technician” above" });
  }
  if (v.track === "QUALIFIED" && v.qualifications.length === 0) {
    ctx.addIssue({ code: "custom", path: ["qualifications"], message: "Add at least one certificate, diploma or degree" });
  }
  if (v.track !== "EPRA_LICENSED" || !v.epraClass || v.epraClass === "NONE") return;
  if (!v.licenceNumber) ctx.addIssue({ code: "custom", path: ["licenceNumber"], message: "Enter your EPRA licence number" });
  if (!v.licenceExpiresOn) ctx.addIssue({ code: "custom", path: ["licenceExpiresOn"], message: "Enter the licence expiry date" });
}

/** A high-voltage claim needs a description of the work. */
function voltageRule(v: { highVoltage: boolean; voltageExperience?: string }, ctx: Ctx) {
  if (v.highVoltage && !v.voltageExperience) {
    ctx.addIssue({ code: "custom", path: ["voltageExperience"], message: "Describe the high-voltage work you have done" });
  }
}

const currentYear = new Date().getFullYear();
export const qualificationSchema = z.object({
  level: z.enum(QualificationLevel, { error: "Select the level" }),
  field: text(200).min(3, "Enter the course, e.g. Electrical installation"),
  institution: text(200).min(3, "Enter the college, university or examining body"),
  yearCompleted: z
    .number({ error: "Enter the year" })
    .int("Enter a year, e.g. 2021")
    .min(1960, "Enter a year after 1960")
    .max(currentYear + 1, "Enter the year you completed it"),
  certificateNumber: optionalText(80),
});

const licenceFields = z.object({
  track: z.enum(Track, { error: "Choose how you are applying" }),
  // Optional in the schema: only the EPRA track needs it (licenceRule), and the field is hidden on the qualified track.
  epraClass: z.enum(EpraClass, { error: "Select your licence class" }).optional(),
  licenceNumber: optionalText(80),
  licenceExpiresOn: isoDate.optional().or(z.literal("").transform(() => undefined)),
  licenceIssue: optionalText(2000),
  qualifications: z.array(qualificationSchema).max(MAX_QUALIFICATIONS, `Add up to ${MAX_QUALIFICATIONS}`),
  licenceVerificationConsent: z.literal(true, { error: "Consent is required to verify your credentials" }),
});
// Cross-field rules live on the step schemas too: Zod skips object-level refinements while any
// field in that object is invalid, so per-step validation must not depend on later steps.
export const licenceStep = licenceFields.superRefine(licenceRule);

export const experienceStep = z.object({
  yearsExperience: quantity(60),
  largestPvKwp: quantity(100_000),
  largestInverterKw: quantity(100_000).optional(),
  largestBatteryKwh: quantity(1_000_000).optional(),
  categories: z.array(z.enum(InstallCategory)).max(Object.keys(InstallCategory).length),
  largestProject: text(5000).min(20, "Describe the project and your exact role (at least 20 characters)"),
});

const technicalFields = z.object({
  inverters: text(5000).min(10, "List the inverter brands and models you have worked with"),
  batteries: text(5000).min(10, "List the battery brands and chemistries you have worked with"),
  loggerExperience: optionalText(5000),
  voltageExperience: optionalText(5000),
  certifications: optionalText(5000),
  energyAuditor: z.boolean(),
  highVoltage: z.boolean(),
});
export const technicalStep = technicalFields.superRefine(voltageRule);

export const refereesStep = z.object({
  referee1: text(2000).min(10, "Add a referee who can verify your project work"),
  referee2: text(2000).min(10, "Add a second referee"),
  referee3: optionalText(2000),
  recruitmentConsent: z.literal(true, { error: "Consent is required to process your application" }),
  talentPoolConsent: z.boolean(),
});

export const APPLICATION_STEPS = [
  { id: "identity", title: "Identity & location", schema: identityStep },
  { id: "licence", title: "Licence & qualifications", schema: licenceStep },
  { id: "experience", title: "Installation experience", schema: experienceStep },
  { id: "technical", title: "Technical capability", schema: technicalStep },
  { id: "referees", title: "Referees & consent", schema: refereesStep },
] as const;

export const applicationSchema = z
  .object({
    ...identityStep.shape,
    ...licenceFields.shape,
    ...experienceStep.shape,
    ...technicalFields.shape,
    ...refereesStep.shape,
  })
  .superRefine((v, ctx) => {
    licenceRule(v, ctx);
    voltageRule(v, ctx);
  });

export type ApplicationInput = z.input<typeof applicationSchema>;
export type Application = z.output<typeof applicationSchema>;
