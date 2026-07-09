import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div style={{ background: "#f5f1e8", color: "#10243e", display: "flex", flexDirection: "column", fontFamily: "Arial, sans-serif", height: "100%", justifyContent: "space-between", padding: "72px", width: "100%" }}>
      <div style={{ alignItems: "center", display: "flex", gap: "18px" }}>
        <div style={{ border: "3px solid #10243e", display: "flex", height: "54px", position: "relative", width: "54px" }}>
          <div style={{ background: "#9a6617", height: "14px", left: "20px", position: "absolute", top: "25px", width: "14px" }} />
          <div style={{ borderRight: "4px solid #9a6617", borderTop: "4px solid #9a6617", height: "20px", position: "absolute", right: "-9px", top: "-9px", width: "20px" }} />
        </div>
        <div style={{ display: "flex", fontSize: 42, fontWeight: 800, letterSpacing: 0 }}>Unlock<span style={{ color: "#1f6f52" }}>ED</span></div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ color: "#1f6f52", fontSize: 24, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase" }}>Verified student opportunities</div>
        <div style={{ fontSize: 82, fontWeight: 900, letterSpacing: 0, lineHeight: 1.02, marginTop: 24, maxWidth: 920 }}>Everything your student status unlocks.</div>
        <div style={{ color: "rgba(16,36,62,.62)", fontSize: 30, lineHeight: 1.35, marginTop: 28, maxWidth: 920 }}>Scholarships, research, internships, AI tools, benefits, competitions, and career resources checked against official sources.</div>
      </div>
      <div style={{ borderTop: "2px solid rgba(16,36,62,.18)", color: "rgba(16,36,62,.58)", fontSize: 24, paddingTop: 24 }}>unlocked.education</div>
    </div>,
    size,
  );
}
