import { ImageResponse } from "next/og";
import { BrandMark } from "@/components/brand-mark";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div style={{ background: "#f6f0e6", color: "#2b211a", display: "flex", flexDirection: "column", fontFamily: "Arial, sans-serif", height: "100%", justifyContent: "space-between", padding: "72px", width: "100%" }}>
      <div style={{ alignItems: "center", display: "flex", gap: "18px" }}>
        <BrandMark width="58" height="58" />
        <div style={{ display: "flex", fontSize: 42, fontWeight: 800, letterSpacing: 0 }}>Unlock<span style={{ color: "#1f5f43" }}>ED</span></div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ color: "#1f5f43", fontSize: 24, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase" }}>Verified student opportunities</div>
        <div style={{ fontSize: 80, fontWeight: 900, letterSpacing: 0, lineHeight: 1.02, marginTop: 24, maxWidth: 960 }}>Find the opportunities college usually leaves scattered.</div>
        <div style={{ color: "rgba(43,33,26,.62)", fontSize: 30, lineHeight: 1.35, marginTop: 28, maxWidth: 920 }}>Scholarships, research, internships, AI tools, benefits, competitions, and career resources checked against official sources.</div>
      </div>
      <div style={{ borderTop: "2px solid rgba(43,33,26,.18)", color: "rgba(43,33,26,.58)", fontSize: 24, paddingTop: 24 }}>unlockededu.com</div>
    </div>,
    size,
  );
}
