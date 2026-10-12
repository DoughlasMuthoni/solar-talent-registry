import { describe, expect, it } from "vitest";
import { adminDigest, applicationReceived, licenceExpiry, statusLink } from "./templates";

describe("email templates", () => {
  it("escape candidate-supplied values in HTML", () => {
    const e = applicationReceived({ name: '<img src=x onerror="alert(1)">', reference: "KIA-T2-0001", statusUrl: "https://x.test/status?t=a&b" });
    expect(e.html).not.toContain("<img");
    expect(e.html).toContain("&lt;img");
    expect(e.html).toContain("https://x.test/status?t=a&amp;b");
    expect(e.text).toContain("KIA-T2-0001");
  });

  it("include the reference in subjects", () => {
    expect(applicationReceived({ name: "A", reference: "R-1", statusUrl: "u" }).subject).toContain("R-1");
    expect(statusLink({ name: "A", reference: "R-2", url: "u" }).subject).toContain("R-2");
  });

  it("phrase licence expiry for today and future dates", () => {
    expect(licenceExpiry({ name: "A", reference: "R", daysLeft: 0, expiresOn: "2026-10-07" }).subject).toMatch(/expires today/);
    expect(licenceExpiry({ name: "A", reference: "R", daysLeft: 30, expiresOn: "2026-11-06" }).text).toContain("expires in 30 days (2026-11-06)");
    expect(licenceExpiry({ name: "A", reference: "R", daysLeft: 1, expiresOn: "2026-10-08" }).text).toContain("1 day (");
  });

  it("summarise the admin digest and cap the list", () => {
    const expiring = Array.from({ length: 25 }, (_, i) => ({ reference: `R-${i}`, name: `N${i}`, detail: "10 days left" }));
    const e = adminDigest({ date: "2026-10-07", dashboardUrl: "https://x.test/dashboard", newApplications: 1, newPriority: 0, pendingVerification: 3, expiring });
    expect(e.subject).toMatch(/: 1 new application$/);
    expect((e.html.match(/<li>N\d+/g) ?? []).length).toBe(20);
  });
});

describe("admin-written emails", () => {
  it("fills placeholders and escapes the admin's text", async () => {
    const { adminMessage } = await import("./templates");
    const e = adminMessage({ name: "Amina", reference: "KIS-T2-0004", subject: "Update on {{reference}}", body: "Hello {{name}},\n\nPlease send <b>your</b> licence.\nThanks" });
    expect(e.subject).toBe("Update on KIS-T2-0004");
    expect(e.text).toContain("Hello Amina,");
    expect(e.html).toContain("&lt;b&gt;your&lt;/b&gt;");
    expect(e.html).toContain("licence.<br>Thanks");
  });

  it("builds an assessment invitation with escaped location", async () => {
    const { assessmentInvite } = await import("./templates");
    const e = assessmentInvite({ name: "A", reference: "R-1", type: "PRACTICAL", when: "Thu 15 Oct 2026, 10:00", location: "Thika <yard>", instructions: "Bring PPE" });
    expect(e.subject).toContain("practical");
    expect(e.html).toContain("Thika &lt;yard&gt;");
    expect(e.text).toContain("Bring PPE");
  });
});
