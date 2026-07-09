import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div style={{ alignItems: "center", background: "#f5f1e8", color: "#10243e", display: "flex", height: "100%", justifyContent: "center", width: "100%" }}>
      <svg width="46" height="46" viewBox="0 0 36 36">
        <path d="M8 6v15c0 6.1 3.8 9 9.7 9S28 27.1 28 21V11" fill="none" stroke="#10243e" strokeWidth="3.2" strokeLinecap="square" />
        <path d="M24 6h7v7" fill="none" stroke="#9a6617" strokeWidth="3.2" strokeLinecap="square" />
        <circle cx="18" cy="20" r="2.25" fill="#9a6617" />
        <path d="M18 22v3" stroke="#9a6617" strokeWidth="2" />
      </svg>
    </div>,
    size,
  );
}
