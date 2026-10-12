import { requireAdmin } from "@/lib/auth/session";
import { toCsv } from "@/lib/csv";
import { listApplications } from "@/lib/data/applications";
import { db } from "@/lib/db";
import { EPRA_CLASS, SCREENING_STATUS, SOURCE, STAGE, VERIFICATION } from "@/lib/labels";
import { QUALIFICATION_LEVEL, TRACK } from "@/lib/qualifications";

/** Admin-only CSV of all applications. Every export is audited (personal data leaving the system). */
export async function GET() {
  const admin = await requireAdmin();
  const rows = await listApplications();

  await db.auditEvent.create({
    data: { actorId: admin.id, action: "applications.exported", entityType: "Application", entityId: "*", metadata: { rows: rows.length, format: "csv" } },
  });

  const csv = toCsv(
    ["Reference", "Name", "Town", "County", "Region", "Track", "EPRA class", "Licence status", "Licence expiry", "Highest qualification", "Qualifications verified", "Largest PV (kWp)", "Score", "Screening", "Stage", "Source", "Submitted"],
    rows.map((r) => [
      r.reference,
      r.fullName,
      r.town,
      r.county,
      r.region,
      TRACK[r.track].short,
      r.epraClass ? EPRA_CLASS[r.epraClass] : "",
      r.licenceStatus ? VERIFICATION[r.licenceStatus].label : "",
      r.licenceExpiresOn ?? "",
      r.topQualification ? QUALIFICATION_LEVEL[r.topQualification].label : "",
      r.qualificationsTotal ? `${r.qualificationsVerified}/${r.qualificationsTotal}` : "",
      r.largestPvKwp,
      r.score ?? "",
      r.status ? SCREENING_STATUS[r.status].label : "",
      STAGE[r.stage],
      SOURCE[r.source],
      r.submittedAt.slice(0, 10),
    ]),
  );

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="waterlift-applications-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
