"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { Logo } from "./logo";
import { AccountButton } from "./account-auth";
import { accountSessionEvent, readAccountSession } from "@/data/account-sync";
import type { AccountSession } from "@/lib/account-types";
import { NotificationNavButton } from "./notification-nav-button";
import { ArrowIcon, BookmarkIcon, PenLineIcon, SearchIcon, SparkIcon, TrophyIcon } from "./icons";

const destinations = [["Discover", "/opportunities"], ["For You", "/advisor"], ["Journey", "/"]] as const;
type DestinationLabel = (typeof destinations)[number][0];

const contextualDestinations: Record<DestinationLabel, Array<{ label: string; description: string; href: string; icon: typeof SearchIcon }>> = {
  Discover: [
    { label: "Browse all", description: "Search the complete opportunity catalog.", href: "/opportunities", icon: SearchIcon },
    { label: "Scholarships", description: "Funding from verified and official sources.", href: "/opportunities?type=Scholarship", icon: TrophyIcon },
    { label: "Internships", description: "Career opportunities and early programs.", href: "/opportunities?type=Career&category=Internships", icon: PenLineIcon },
    { label: "Research", description: "Undergraduate research and lab programs.", href: "/opportunities?type=Research", icon: SparkIcon },
    { label: "Student benefits", description: "Software, services, and student offers.", href: "/opportunities?type=Benefit", icon: BookmarkIcon },
  ],
  "For You": [
    { label: "Your shortlist", description: "Review opportunities selected around your profile.", href: "/advisor", icon: SparkIcon },
    { label: "More matches", description: "Continue through your current verified shortlist.", href: "/advisor#more-matches-title", icon: SearchIcon },
    { label: "Recommendation preferences", description: "Refine the interests that shape your matches.", href: "/profile#interests", icon: PenLineIcon },
  ],
  Journey: [
    { label: "Active opportunities", description: "Return to everything currently in motion.", href: "/#active-opportunities", icon: BookmarkIcon },
    { label: "Applications", description: "Review opportunities you have applied to.", href: "/?stage=applied#active-opportunities", icon: PenLineIcon },
    { label: "Professional history", description: "See completed and archived records.", href: "/?stage=history#journey-history", icon: TrophyIcon },
    { label: "Journey Cards", description: "Present a confirmed milestone when one is ready.", href: "/#journey-cards", icon: SparkIcon },
  ],
};

function isServerProtectedProductPath(pathname: string) {
  return pathname === "/advisor"
    || pathname === "/profile"
    || pathname === "/notifications"
    || pathname === "/learn"
    || pathname === "/referral"
    || pathname === "/my-opportunities"
    || pathname.startsWith("/opportunities")
    || pathname.startsWith("/admin");
}

export function Header() {
  const [session, setSession] = useState<AccountSession | null>(null);
  const [openDestination, setOpenDestination] = useState<DestinationLabel | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const closeTimer = useRef<number | null>(null);
  const destinationTriggers = useRef<Partial<Record<DestinationLabel, HTMLAnchorElement | null>>>({});

  useEffect(() => {
    let active = true;
    readAccountSession().then((next) => {
      if (active) setSession(next);
    }).catch(() => undefined);
    const update = (event: Event) => setSession((event as CustomEvent<AccountSession>).detail);
    window.addEventListener(accountSessionEvent, update);
    return () => {
      active = false;
      window.removeEventListener(accountSessionEvent, update);
    };
  }, []);

  useEffect(() => {
    let last = window.scrollY > 8;
    setScrolled(last);
    const update = () => {
      const next = window.scrollY > 8;
      if (next === last) return;
      last = next;
      setScrolled(next);
    };
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    setOpenDestination(null);
  }, [pathname]);

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
  }, []);

  const authenticated = Boolean(session?.authenticated || !session && isServerProtectedProductPath(pathname));

  function cancelClose() {
    if (closeTimer.current === null) return;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }

  function open(label: DestinationLabel) {
    cancelClose();
    setOpenDestination(label);
  }

  function scheduleClose() {
    cancelClose();
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      setOpenDestination(null);
    }, 140);
  }

  function closeAfterFocus(event: FocusEvent<HTMLDivElement>) {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    setOpenDestination(null);
  }

  function closeWithEscape(event: KeyboardEvent<HTMLDivElement>, label: DestinationLabel) {
    if (event.key !== "Escape") return;
    cancelClose();
    destinationTriggers.current[label]?.focus();
    setOpenDestination(null);
  }

  if (!authenticated) {
    return <header className="sticky top-0 z-30 border-b border-ink/10 bg-paper/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <Logo className="py-4" />
        <div className="py-4"><AccountButton compact /></div>
      </div>
    </header>;
  }

  function navigationLink(label: string, href: string, mobile = false) {
    const active = href === "/" ? pathname === "/" : pathname?.startsWith(href);
    return <a
      key={href}
      href={href}
      aria-current={active ? "page" : undefined}
      data-navigation-item=""
      data-active={active ? "true" : undefined}
      data-journey-destination={label === "Journey" ? mobile ? "mobile" : "desktop" : undefined}
      className={mobile
        ? `relative inline-flex min-h-11 items-center justify-center rounded-full px-3 text-center transition duration-200 active:scale-[.98] ${active ? "bg-white text-forest" : "text-white/70 hover:text-white"}`
        : `relative inline-flex min-h-11 items-center rounded-full px-4 transition duration-200 active:scale-[.98] ${active ? "bg-white text-forest shadow-[0_8px_20px_rgba(43,33,26,.08)]" : "hover:bg-white/75 hover:text-forest"}`}
    >
      {label === "Journey" ? <span data-journey-destination-icon="" aria-hidden="true" className="inline-grid h-4 w-4 shrink-0 place-items-center"><BookmarkIcon className="h-4 w-4" /></span> : null}
      {label}
    </a>;
  }

  function desktopDestination(label: DestinationLabel, href: string) {
    const active = href === "/" ? pathname === "/" : pathname?.startsWith(href);
    const expanded = openDestination === label;
    const panelId = `navigation-panel-${label.toLowerCase().replaceAll(" ", "-")}`;
    return <div
      key={href}
      data-context-destination=""
      data-open={expanded ? "true" : "false"}
      onMouseEnter={() => open(label)}
      onMouseLeave={scheduleClose}
      onFocusCapture={() => open(label)}
      onBlurCapture={closeAfterFocus}
      onKeyDown={(event) => closeWithEscape(event, label)}
      className="relative"
    >
      <a
        ref={(node) => { destinationTriggers.current[label] = node; }}
        href={href}
        aria-current={active ? "page" : undefined}
        aria-haspopup="true"
        aria-expanded={expanded}
        aria-controls={panelId}
        data-context-trigger=""
        data-navigation-item=""
        data-active={active ? "true" : undefined}
        data-journey-destination={label === "Journey" ? "desktop" : undefined}
        className={`relative inline-flex min-h-11 items-center rounded-full px-4 transition duration-200 active:scale-[.98] ${active ? "bg-white text-forest shadow-[0_8px_20px_rgba(43,33,26,.08)]" : "hover:bg-white/75 hover:text-forest"}`}
      >
        {label === "Journey" ? <span data-journey-destination-icon="" aria-hidden="true" className="inline-grid h-4 w-4 shrink-0 place-items-center"><BookmarkIcon className="h-4 w-4" /></span> : null}
        {label}
      </a>
      <div id={panelId} data-context-panel="" aria-label={`${label} shortcuts`} aria-hidden={!expanded} className="absolute left-1/2 top-[calc(100%+.7rem)] hidden w-[21rem] -translate-x-1/2 opacity-0 lg:grid">
        <div className="grid gap-1 rounded-xl border border-ink/10 bg-[var(--unlocked-surface)] p-2 shadow-[0_22px_60px_rgba(43,33,26,.14)]">
          {contextualDestinations[label].map((item) => {
            const Icon = item.icon;
            return <a key={item.href} href={item.href} className="group flex min-h-14 items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-forest/[.065] focus:bg-forest/[.065] focus:outline-none focus:ring-2 focus:ring-forest/20">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-forest/[.075] text-forest"><Icon className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1"><strong className="block text-sm text-[var(--unlocked-text)]">{item.label}</strong><small className="mt-0.5 block text-[11px] font-medium leading-4 text-ink/45">{item.description}</small></span>
              <ArrowIcon className="h-3.5 w-3.5 shrink-0 text-forest opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100 group-focus:translate-x-0.5 group-focus:opacity-100" />
            </a>;
          })}
        </div>
      </div>
    </div>;
  }

  return <>
    <header data-product-header="" data-scrolled={scrolled ? "true" : "false"} className="sticky top-0 z-30 border-b border-ink/10 bg-paper/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3 sm:px-8">
        <Logo />
        <nav aria-label="Primary navigation" data-primary-navigation="" className="order-3 hidden w-full gap-1 overflow-x-auto rounded-full bg-white/48 p-1 text-sm font-bold text-ink/55 shadow-[0_10px_30px_rgba(43,33,26,.04)] ring-1 ring-ink/6 sm:order-none sm:flex sm:w-auto lg:overflow-visible">
          {destinations.map(([label, href]) => desktopDestination(label, href))}
        </nav>
        <div className="flex items-center gap-3">
          <NotificationNavButton active={pathname?.startsWith("/notifications")} />
          <a href="/learn" className="hidden min-h-11 items-center rounded-full px-3 text-xs font-bold text-ink/45 transition hover:bg-white/75 hover:text-forest lg:inline-flex">Learn</a>
          <a href="/profile" data-navigation-item="" data-active={pathname?.startsWith("/profile") ? "true" : undefined} className={`inline-flex min-h-11 items-center rounded-full px-3 text-xs font-bold transition duration-200 active:scale-[.98] ${pathname?.startsWith("/profile") ? "bg-white text-forest shadow-[0_8px_20px_rgba(43,33,26,.08)]" : "text-ink/45 hover:bg-white/75 hover:text-forest"}`}>Profile</a>
          <AccountButton compact />
        </div>
      </div>
    </header>
    <nav aria-label="Mobile navigation" data-primary-navigation="" className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 grid grid-cols-3 rounded-full bg-ink/95 p-1 text-xs font-bold text-white shadow-[0_20px_60px_rgba(43,33,26,.24)] backdrop-blur sm:hidden">
      {destinations.map(([label, href]) => navigationLink(label, href, true))}
    </nav>
  </>;
}
