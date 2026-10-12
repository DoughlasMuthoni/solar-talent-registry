import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it.each(["/dashboard", "/candidates/abc?x=1"])("allows same-site path %s", (p) => expect(safeNext(p)).toBe(p));
  it.each(["//evil.example", "https://evil.example", "/\\evil.example", "javascript:alert(1)", "", null, undefined])(
    "rejects %s",
    (p) => expect(safeNext(p)).toBe("/dashboard"),
  );
});
