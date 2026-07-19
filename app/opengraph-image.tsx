import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div style={{ background: "#f6f0e6", color: "#2b211a", display: "flex", flexDirection: "column", fontFamily: "Arial, sans-serif", height: "100%", justifyContent: "space-between", padding: "72px", width: "100%" }}>
      <div style={{ alignItems: "center", display: "flex", gap: "18px" }}>
        <svg width="58" height="58" viewBox="0 0 40 40">
          <path d="M9 8h18v19.5C27 33 23.5 36 18 36S9 33 9 27.5V8Z" fill="none" stroke="#1f5f43" strokeWidth="3" strokeLinejoin="round" />
          <path d="M27 8h7v7" fill="none" stroke="#2b211a" strokeWidth="3" strokeLinecap="square" />
          <path d="M17 14v13c0 2.1 1.2 3.2 3 3.2s3-1.1 3-3.2V14" fill="none" stroke="#2b211a" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M27 8 20 15" stroke="#b48a45" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
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
