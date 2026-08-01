"use client";

import { useEffect, useMemo, useState } from "react";
import type { Opportunity } from "@/data/opportunities";
import {
  resolveOrganizationLogo,
  resolveOrganizationMark,
  type OrganizationCategoryIcon,
  type OrganizationLogoInput,
  type ResolvedOrganizationLogo,
} from "@/data/organization-logos";
import styles from "./organization-logo.module.css";

const pixels = { sm: 44, md: 48, lg: 64 } as const;
type LogoSize = keyof typeof pixels;

function CategoryIcon({ category }: { category: OrganizationCategoryIcon }) {
  if (category === "scholarship") return <svg viewBox="0 0 24 24"><path d="m3 9 9-5 9 5-9 5-9-5Z"/><path d="M7 12v4c3 2 7 2 10 0v-4M21 9v6"/></svg>;
  if (category === "internship") return <svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/></svg>;
  if (category === "research") return <svg viewBox="0 0 24 24"><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M8 15h8"/></svg>;
  if (category === "competition") return <svg viewBox="0 0 24 24"><path d="M8 4h8v4a4 4 0 0 1-8 0V4Z"/><path d="M6 6H3v1a4 4 0 0 0 5 4M18 6h3v1a4 4 0 0 1-5 4M12 12v5M8 21h8M9 17h6"/></svg>;
  if (category === "academic") return <svg viewBox="0 0 24 24"><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v17H7.5A3.5 3.5 0 0 0 4 22V5.5ZM20 5.5A3.5 3.5 0 0 0 16.5 2H13v17h3.5A3.5 3.5 0 0 1 20 22V5.5Z"/></svg>;
  if (category === "software") return <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m9 9-3 3 3 3M15 9l3 3-3 3M13 8l-2 8"/></svg>;
  if (category === "career") return <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m15 9-2 4-4 2 2-4 4-2Z"/></svg>;
  return <svg viewBox="0 0 24 24"><path d="M4 9h16v11H4V9Z"/><path d="M12 9v11M3 9h18M8 9a3 3 0 1 1 4-2.5V9M16 9a3 3 0 1 0-4-2.5V9"/></svg>;
}

export function ResolvedOrganizationMark({ logo, size = "md", className = "", eager = false }: { logo: ResolvedOrganizationLogo; size?: LogoSize; className?: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imageSrc = logo.kind === "image" ? logo.src : "";
  useEffect(() => { setFailed(false); setLoaded(false); }, [imageSrc]);
  const showImage = logo.kind === "image" && !failed;
  const showMonogram = Boolean(logo.initials);

  return <span
    className={`${styles.frame} ${styles[size]} ${className}`}
    data-organization-mark=""
    data-kind={showImage ? "image" : showMonogram ? "monogram" : "category"}
    data-loaded={showImage && loaded ? "true" : "false"}
    data-tone={logo.tone}
    title={showImage && logo.verified ? "Official organization logo" : undefined}
    aria-label={logo.alt}
  >
    <span className={styles.fallback} aria-hidden="true">
      {showMonogram ? logo.initials : <CategoryIcon category={logo.categoryIcon} />}
    </span>
    {showImage ? <img
      src={logo.src}
      alt=""
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      decoding="async"
      width={pixels[size]}
      height={pixels[size]}
      className={styles.image}
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
    /> : null}
  </span>;
}

export function OrganizationMark({ organization, officialSource, icon, type, category, size = "md", className = "", eager = false }: OrganizationLogoInput & { size?: LogoSize; className?: string; eager?: boolean }) {
  const logo = useMemo(() => resolveOrganizationMark({ organization, officialSource, icon, type, category }), [organization, officialSource, icon, type, category]);
  return <ResolvedOrganizationMark logo={logo} size={size} className={className} eager={eager} />;
}

export function OrganizationLogo({ opportunity, size = "md", className = "", eager = false }: { opportunity: Opportunity; size?: LogoSize; className?: string; eager?: boolean }) {
  const logo = useMemo(() => resolveOrganizationLogo(opportunity), [opportunity]);
  return <ResolvedOrganizationMark logo={logo} size={size} className={className} eager={eager} />;
}
