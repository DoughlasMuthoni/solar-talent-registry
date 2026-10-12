/**
 * Transactional email templates — pure functions, no I/O. Every interpolated value is escaped:
 * names and references come from public form input.
 */

export type Email = { subject: string; html: string; text: string };

const esc = (v: string | number) =>
  String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const NAVY = "#2E2A65";
const ORANGE = "#EF7F22";

/** Table-based layout for broad email-client support; brand colours, no external images. */
function layout(title: string, body: string, cta?: { href: string; label: string }) {
  const button = cta
    ? `<p style="margin:28px 0"><a href="${esc(cta.href)}" style="background:${ORANGE};color:#1F1D4A;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;display:inline-block">${esc(cta.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#F7F8FC;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1B1940">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:12px;overflow:hidden">
<tr><td style="background:${NAVY};padding:18px 24px;font-weight:800;letter-spacing:1px;font-size:18px">
<span style="color:#FFFFFF">WATER</span><span style="color:#2CACE1">LIFT</span> <span style="color:${ORANGE}">SOLAR</span></td></tr>
<tr><td style="padding:28px 24px 8px"><h1 style="font-size:20px;margin:0 0 16px">${esc(title)}</h1>${body}${button}</td></tr>
<tr><td style="padding:16px 24px 24px;color:#5B5F7A;font-size:12px;border-top:1px solid #DDE0EC">
Waterlift Solar · Equitable access to solar energy and borehole drilling.<br>
You received this because you applied to our solar technician network. Questions? Reply to this email.</td></tr>
</table></td></tr></table></body></html>`;
}

const p = (html: string) => `<p style="margin:0 0 12px;line-height:1.55">${html}</p>`;

export function applicationReceived(v: { name: string; reference: string; statusUrl: string }): Email {
  const subject = `Application received — ${v.reference}`;
  return {
    subject,
    html: layout(
      "Thank you for applying",
      p(`Hello ${esc(v.name)},`) +
        p(`We have received your solar PV technician application. Your reference number is <strong style="font-family:Consolas,monospace">${esc(v.reference)}</strong> — please keep it.`) +
        p("What happens next: we verify your EPRA licence or qualifications, a recruiter reviews your experience, and shortlisted technicians are invited to a technical and practical assessment.") +
        p("You can check your status or withdraw at any time using the private link below. It is valid for 30 days; you can always request a new one."),
      { href: v.statusUrl, label: "Check my application" },
    ),
    text: `Hello ${v.name},\n\nWe have received your solar PV technician application. Your reference number is ${v.reference}.\n\nNext: we verify your EPRA licence or qualifications, a recruiter reviews your experience, and shortlisted technicians are invited to an assessment.\n\nCheck your status or withdraw (link valid 30 days): ${v.statusUrl}\n\nWaterlift Solar`,
  };
}

export function statusLink(v: { name: string; reference: string; url: string }): Email {
  const subject = `Your application status link — ${v.reference}`;
  return {
    subject,
    html: layout(
      "Your private status link",
      p(`Hello ${esc(v.name)},`) +
        p(`Use the button below to view your application <strong>${esc(v.reference)}</strong>. The link is private to you and expires in 30 days.`) +
        p("If you did not ask for this, you can ignore this email."),
      { href: v.url, label: "View my application" },
    ),
    text: `Hello ${v.name},\n\nView your application ${v.reference} (private link, expires in 30 days): ${v.url}\n\nIf you did not ask for this, ignore this email.\n\nWaterlift Solar`,
  };
}

export function licenceExpiry(v: { name: string; reference: string; daysLeft: number; expiresOn: string }): Email {
  const when = v.daysLeft <= 0 ? "expires today" : `expires in ${v.daysLeft} day${v.daysLeft === 1 ? "" : "s"} (${v.expiresOn})`;
  const subject = `Your EPRA licence ${v.daysLeft <= 0 ? "expires today" : `expires in ${v.daysLeft} days`}`;
  return {
    subject,
    html: layout(
      "EPRA licence renewal reminder",
      p(`Hello ${esc(v.name)},`) +
        p(`Our records show that the EPRA solar PV licence on your application <strong>${esc(v.reference)}</strong> ${esc(when)}.`) +
        p("Please renew it with EPRA and reply to this email with your renewed licence details so we can keep assigning you work."),
    ),
    text: `Hello ${v.name},\n\nThe EPRA licence on your application ${v.reference} ${when}. Please renew it with EPRA and reply with the renewed details.\n\nWaterlift Solar`,
  };
}

export type DigestItem = { reference: string; name: string; detail: string };

export function adminDigest(v: {
  date: string;
  dashboardUrl: string;
  newApplications: number;
  newPriority: number;
  pendingVerification: number;
  expiring: DigestItem[];
}): Email {
  const subject = `Daily recruitment summary — ${v.date}: ${v.newApplications} new application${v.newApplications === 1 ? "" : "s"}`;
  const rows = v.expiring
    .slice(0, 20)
    .map((e) => `<li>${esc(e.name)} (${esc(e.reference)}) — ${esc(e.detail)}</li>`)
    .join("");
  return {
    subject,
    html: layout(
      `Summary for ${v.date}`,
      `<ul style="margin:0 0 16px;padding-left:20px;line-height:1.7">
<li><strong>${v.newApplications}</strong> new application${v.newApplications === 1 ? "" : "s"} in the last 24 hours (${v.newPriority} priority review)</li>
<li><strong>${v.pendingVerification}</strong> application${v.pendingVerification === 1 ? "" : "s"} awaiting licence or qualification checks</li>
<li><strong>${v.expiring.length}</strong> licence${v.expiring.length === 1 ? "" : "s"} expiring within 30 days</li></ul>` +
        (rows ? p("Expiring soon:") + `<ul style="margin:0 0 12px;padding-left:20px;line-height:1.6">${rows}</ul>` : "") +
        p("Scores are preliminary — every decision needs human review."),
      { href: v.dashboardUrl, label: "Open the dashboard" },
    ),
    text:
      `Summary for ${v.date}\n- ${v.newApplications} new applications (${v.newPriority} priority)\n- ${v.pendingVerification} awaiting licence or qualification checks\n- ${v.expiring.length} licences expiring within 30 days\n` +
      v.expiring.slice(0, 20).map((e) => `  · ${e.name} (${e.reference}) — ${e.detail}`).join("\n") +
      `\n\nDashboard: ${v.dashboardUrl}`,
  };
}

export function assessmentInvite(v: {
  name: string;
  reference: string;
  type: "TECHNICAL" | "PRACTICAL";
  when: string;
  location: string;
  instructions?: string | null;
}): Email {
  const kind = v.type === "TECHNICAL" ? "technical assessment" : "practical (hands-on) assessment";
  const subject = `Invitation: ${kind} — ${v.reference}`;
  const extra = v.instructions ? p(esc(v.instructions).replace(/\n/g, "<br>")) : "";
  return {
    subject,
    html: layout(
      `You're invited to a ${kind}`,
      p(`Hello ${esc(v.name)},`) +
        p(`Thank you for your application <strong>${esc(v.reference)}</strong>. We would like to invite you to a ${esc(kind)}.`) +
        `<table role="presentation" style="margin:0 0 16px;font-size:15px;line-height:1.6"><tr><td style="padding-right:12px;color:#5B5F7A">When</td><td><strong>${esc(v.when)}</strong></td></tr><tr><td style="padding-right:12px;color:#5B5F7A">Where</td><td><strong>${esc(v.location)}</strong></td></tr></table>` +
        extra +
        p("Please bring your EPRA licence or qualification certificates, and an ID. Reply to this email to confirm or if you need another time."),
    ),
    text: [
      `Hello ${v.name},`,
      "",
      `We would like to invite you to a ${kind} for application ${v.reference}.`,
      `When: ${v.when}`,
      `Where: ${v.location}`,
      ...(v.instructions ? ["", v.instructions] : []),
      "",
      "Please bring your EPRA licence or qualification certificates, and an ID. Reply to confirm or to ask for another time.",
      "",
      "Waterlift Solar",
    ].join("\n"),
  };
}

/** Free-text message written by an admin. {{name}} and {{reference}} are filled per candidate. */
export function adminMessage(v: { name: string; reference: string; subject: string; body: string }): Email {
  const fill = (s: string) => s.replaceAll("{{name}}", v.name).replaceAll("{{reference}}", v.reference);
  const subject = fill(v.subject).slice(0, 180);
  const text = fill(v.body);
  const html = text
    .split(/\n{2,}/)
    .map((para) => p(esc(para).replace(/\n/g, "<br>")))
    .join("");
  return { subject, html: layout(subject, html), text: `${text}\n\nWaterlift Solar` };
}
