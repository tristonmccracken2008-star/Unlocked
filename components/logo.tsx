import Link from "next/link";
import { BrandMark } from "./brand-mark";

export function Logo({ className = "", tone = "default", compact = false }: { className?: string; tone?: "default" | "inverse"; compact?: boolean }) {
  return <Link href="/" aria-label="UnlockED home" className={`inline-flex min-h-11 items-center gap-3 ${className}`}>
    <BrandMark tone={tone} className="h-8 w-8 shrink-0" />
    {!compact ? <span className={`font-editorial text-2xl font-bold tracking-normal ${tone === "inverse" ? "text-white" : "text-ink"}`}>Unlock<span className={tone === "inverse" ? "text-[#91c9ad]" : "text-forest"}>ED</span></span> : null}
  </Link>;
}
