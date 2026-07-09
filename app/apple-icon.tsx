import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ alignItems: "center", background: "#f6f0e6", display: "flex", height: "100%", justifyContent: "center", width: "100%" }}>
      <svg width="132" height="132" viewBox="0 0 40 40">
        <path d="M9 8h18v19.5C27 33 23.5 36 18 36S9 33 9 27.5V8Z" fill="none" stroke="#1f5f43" strokeWidth="3" strokeLinejoin="round" />
        <path d="M27 8h7v7" fill="none" stroke="#2b211a" strokeWidth="3" strokeLinecap="square" />
        <path d="M17 14v13c0 2.1 1.2 3.2 3 3.2s3-1.1 3-3.2V14" fill="none" stroke="#2b211a" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M27 8 20 15" stroke="#b48a45" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </div>,
    size,
  );
}
