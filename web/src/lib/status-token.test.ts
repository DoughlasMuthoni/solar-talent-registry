import { describe, expect, it } from "vitest";
import { createStatusToken, verifyStatusToken } from "./status-token";

const KEY = "k".repeat(40);
const NOW = new Date("2026-10-07T12:00:00Z");
const ID = "cmabc123def456ghi789";

describe("status tokens", () => {
  it("round-trips a valid token", () => {
    expect(verifyStatusToken(createStatusToken(ID, NOW, 30, KEY), NOW, KEY)).toBe(ID);
  });

  it("rejects expired tokens", () => {
    const t = createStatusToken(ID, NOW, 30, KEY);
    expect(verifyStatusToken(t, new Date("2026-11-07T12:00:01Z"), KEY)).toBeNull();
  });

  it("rejects tampering with the id or expiry", () => {
    const [, exp, mac] = createStatusToken(ID, NOW, 30, KEY).split(".");
    expect(verifyStatusToken(`cmzzz999zzz999zzz999.${exp}.${mac}`, NOW, KEY)).toBeNull();
    expect(verifyStatusToken(`${ID}.${Number(exp) + 999999}.${mac}`, NOW, KEY)).toBeNull();
  });

  it("rejects a token signed with another key", () => {
    expect(verifyStatusToken(createStatusToken(ID, NOW, 30, "x".repeat(40)), NOW, KEY)).toBeNull();
  });

  it.each([null, "", "abc", "a.b.c.d", `${ID}.notanumber.sig`, "x".repeat(300)])("rejects malformed %s", (t) => {
    expect(verifyStatusToken(t as string | null, NOW, KEY)).toBeNull();
  });
});
