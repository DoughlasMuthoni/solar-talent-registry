import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/** Social share card for the apply link (Facebook, WhatsApp, LinkedIn, X…). */
export const alt = "Waterlift Solar is hiring licensed solar PV technicians across Kenya";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  // The real logo artwork (light-on-dark variant), inlined so the card renders without network access.
  const svg = await readFile(join(process.cwd(), "public/brand/waterlift-logo-dark.svg"));
  const logo = `data:image/svg+xml;base64,${svg.toString("base64")}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#2E2A65", color: "#FFFFFF", padding: 64, gap: 56, alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: 560 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse needs a plain img */}
          <img src={logo} width={560} height={233} alt="" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24, flex: 1 }}>
          <div style={{ fontSize: 64, lineHeight: 1.05, letterSpacing: -1 }}>Now hiring solar PV technicians</div>
          <div style={{ fontSize: 30, color: "#CFE9F6" }}>EPRA T1 · T2 · T3 — roles across Kenya</div>
          <div style={{ display: "flex", marginTop: 12 }}>
            <div style={{ display: "flex", background: "#EF7F22", color: "#1F1D4A", fontSize: 32, padding: "14px 28px", borderRadius: 14 }}>Apply in 10 minutes →</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
