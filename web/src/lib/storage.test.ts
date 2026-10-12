import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { sniffMatches } = await import("./storage");

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);

describe("sniffMatches", () => {
  it("accepts genuine file signatures", () => {
    expect(sniffMatches("application/pdf", bytes(0x25, 0x50, 0x44, 0x46, 0x2d))).toBe(true);
    expect(sniffMatches("image/jpeg", bytes(0xff, 0xd8, 0xff, 0xe0))).toBe(true);
    expect(sniffMatches("image/png", bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe(true);
    expect(sniffMatches("image/webp", bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))).toBe(true);
  });
  it("rejects a mismatched or disguised file", () => {
    expect(sniffMatches("application/pdf", bytes(0x4d, 0x5a))).toBe(false); // "MZ" — a Windows executable
    expect(sniffMatches("image/png", bytes(0xff, 0xd8, 0xff))).toBe(false); // JPEG labelled as PNG
    expect(sniffMatches("image/webp", bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45))).toBe(false); // RIFF/WAVE
  });
});
