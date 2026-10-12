import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csvCell", () => {
  it.each([
    ['=HYPERLINK("http://x","y")', `"'=HYPERLINK(""http://x"",""y"")"`],
    ["+254700000001", `"'+254700000001"`],
    ["-5", `"'-5"`],
    ["@SUM(A1)", `"'@SUM(A1)"`],
  ])("neutralises formula-like %s", (raw, out) => expect(csvCell(raw)).toBe(out));

  it("quotes commas, quotes and newlines", () => expect(csvCell('a, "b"\nc')).toBe('"a, ""b""\nc"'));
  it("joins arrays and blanks nullish", () => {
    expect(csvCell(["HYBRID", "GRID_TIED"])).toBe('"HYBRID; GRID_TIED"');
    expect(csvCell(null)).toBe('""');
  });
  it("starts with a BOM and uses CRLF", () => {
    const csv = toCsv(["a", "b"], [[1, 2]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("\r\n");
  });
});
