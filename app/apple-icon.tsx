import { ImageResponse } from "next/og";
import { BrandMark } from "@/components/brand-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ alignItems: "center", background: "#f6f0e6", display: "flex", height: "100%", justifyContent: "center", width: "100%" }}>
      <BrandMark width="132" height="132" />
    </div>,
    size,
  );
}
