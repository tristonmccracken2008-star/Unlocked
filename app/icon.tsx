import { ImageResponse } from "next/og";
import { BrandMark } from "@/components/brand-mark";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div style={{ alignItems: "center", background: "#f6f0e6", display: "flex", height: "100%", justifyContent: "center", width: "100%" }}>
      <BrandMark width="48" height="48" />
    </div>,
    size,
  );
}
