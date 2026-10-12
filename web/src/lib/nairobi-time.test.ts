import { describe, expect, it } from "vitest";
import { dateToNairobiLocal, formatNairobi, nairobiLocalToDate } from "./nairobi-time";

describe("Nairobi time helpers", () => {
  it("treats datetime-local input as UTC+3", () => {
    expect(nairobiLocalToDate("2026-10-15T10:00")!.toISOString()).toBe("2026-10-15T07:00:00.000Z");
  });
  it("round-trips through the input format", () => {
    const d = nairobiLocalToDate("2026-12-31T23:30")!;
    expect(dateToNairobiLocal(d)).toBe("2026-12-31T23:30");
  });
  it("formats in Nairobi time regardless of the server's zone", () => {
    expect(formatNairobi(new Date("2026-10-15T07:00:00Z"))).toBe("Thu 15 Oct 2026, 10:00 (Nairobi time)");
  });
  it.each(["", "2026-10-15", "15/10/2026 10:00", "2026-13-40T99:99"])("rejects %s", (v) => {
    expect(nairobiLocalToDate(v)).toBeNull();
  });
});
