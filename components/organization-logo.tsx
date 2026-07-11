"use client";

import { useMemo, useState } from "react";
import type { Opportunity } from "@/data/opportunities";
import { resolveOrganizationLogo } from "@/data/organization-logos";

const sizes = {
  sm: "h-9 w-9 text-xs rounded-xl",
  md: "h-12 w-12 text-sm rounded-2xl",
  lg: "h-16 w-16 text-lg rounded-[1.25rem]",
};

export function OrganizationLogo({ opportunity, size = "md", className = "" }: { opportunity: Opportunity; size?: keyof typeof sizes; className?: string }) {
  const logo = useMemo(() => resolveOrganizationLogo(opportunity), [opportunity]);
  const [failed, setFailed] = useState(false);
  const frame = `${sizes[size]} grid shrink-0 place-items-center overflow-hidden bg-paper text-center font-black text-forest ring-1 ring-ink/8 ${className}`;
  if (logo.kind === "image" && !failed) {
    return <span className={frame} title={logo.verified ? "Verified organization logo" : "Organization logo"}>
      <img src={logo.src} alt={logo.alt} loading="lazy" decoding="async" width={size === "lg" ? 64 : size === "md" ? 48 : 36} height={size === "lg" ? 64 : size === "md" ? 48 : 36} className="h-full w-full object-contain p-2" onError={() => setFailed(true)} />
    </span>;
  }
  if (logo.kind === "category") return <span className={frame} aria-label={logo.alt}>{logo.categoryIcon}</span>;
  return <span className={frame} aria-label={logo.alt}>{logo.initials || "U"}</span>;
}
