import type { ReactNode } from "react";

type LoadingRegionProps = {
  label: string;
  children: ReactNode;
  className?: string;
  delayed?: boolean;
};

export function LoadingRegion({ label, children, className = "", delayed = true }: LoadingRegionProps) {
  return <div
    className={className}
    data-loading-region=""
    data-loading-delay={delayed ? "true" : undefined}
    aria-busy="true"
    aria-label={label}
  >
    {children}
    <span className="sr-only" role="status" aria-live="polite">{label}</span>
  </div>;
}

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <span className={`unlocked-skeleton-block ${className}`} data-loading-skeleton="" aria-hidden="true" />;
}

// Kept private so arbitrary inline styles remain limited to deterministic skeleton width.
function SkeletonBlockWithWidth({ width }: { width: string }) {
  return <span className="unlocked-skeleton-block h-3 rounded-full" data-loading-skeleton="" aria-hidden="true" style={{ width }} />;
}

export function LoadingLines({ widths = ["100%", "82%"], className = "" }: { widths?: string[]; className?: string }) {
  return <span className={`grid gap-2.5 ${className}`} aria-hidden="true">
    {widths.map((width, index) => <SkeletonBlockWithWidth key={`${width}-${index}`} width={width} />)}
  </span>;
}

export function AppPageLoading({ label = "Loading UnlockED" }: { label?: string }) {
  return <main className="min-h-[70vh] bg-paper px-4 py-10 sm:px-6 sm:py-16">
    <LoadingRegion label={label} className="mx-auto w-full max-w-[88rem]">
      <div className="flex items-start justify-between gap-6">
        <div className="w-full max-w-xl">
          <SkeletonBlock className="h-3 w-24 rounded-full" />
          <SkeletonBlock className="mt-4 h-12 w-[min(100%,28rem)] rounded-md" />
          <SkeletonBlock className="mt-4 h-4 w-[min(82%,24rem)] rounded-full" />
        </div>
        <div className="hidden gap-3 sm:flex">
          <SkeletonBlock className="h-11 w-32 rounded-lg" />
          <SkeletonBlock className="h-11 w-24 rounded-lg" />
        </div>
      </div>
      <div className="mt-9 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((item) => <div key={item} className="h-36 rounded-lg border border-ink/10 bg-[var(--unlocked-surface-muted)] p-4">
          <SkeletonBlock className="h-3 w-24 rounded-full" />
          <SkeletonBlock className="mt-7 h-8 w-20 rounded-md" />
          <SkeletonBlock className="mt-4 h-3 w-3/4 rounded-full" />
        </div>)}
      </div>
      <div className="mt-5 rounded-lg border border-ink/10 bg-[var(--unlocked-surface-muted)] p-4 sm:p-5">
        <SkeletonBlock className="h-5 w-36 rounded-md" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((item) => <div key={item} className="grid min-h-32 grid-cols-[2.5rem_minmax(0,1fr)] gap-3 rounded-lg border border-ink/8 p-4">
            <SkeletonBlock className="h-10 w-10 rounded-lg" />
            <LoadingLines widths={["72%", "48%", "86%"]} className="pt-1" />
          </div>)}
        </div>
      </div>
    </LoadingRegion>
  </main>;
}

export function AccountPageLoading({ label = "Loading your account" }: { label?: string }) {
  return <main className="min-h-[65vh] px-5 py-12 sm:px-8">
    <LoadingRegion label={label} className="mx-auto max-w-6xl">
      <SkeletonBlock className="h-3 w-28 rounded-full" />
      <SkeletonBlock className="mt-4 h-12 max-w-xl rounded-md" />
      <SkeletonBlock className="mt-4 h-4 max-w-md rounded-full" />
      <div className="mt-10 grid gap-8 lg:grid-cols-[13rem_1fr]">
        <div className="space-y-3"><SkeletonBlock className="h-11 rounded-md" /><SkeletonBlock className="h-11 rounded-md" /><SkeletonBlock className="h-11 rounded-md" /></div>
        <div className="rounded-lg border border-ink/10 bg-[var(--unlocked-surface-muted)] p-5 sm:p-7">
          <SkeletonBlock className="h-7 w-48 rounded-md" />
          <LoadingLines widths={["88%", "72%"]} className="mt-5 max-w-2xl" />
          <div className="mt-8 space-y-4"><SkeletonBlock className="h-14 rounded-md" /><SkeletonBlock className="h-14 rounded-md" /><SkeletonBlock className="h-14 rounded-md" /></div>
        </div>
      </div>
    </LoadingRegion>
  </main>;
}

export function SectionLoading({ label, rows = 3, className = "" }: { label: string; rows?: number; className?: string }) {
  return <LoadingRegion label={label} className={className}>
    <SkeletonBlock className="h-5 w-40 rounded-md" />
    <div className="mt-5 space-y-3">
      {Array.from({ length: rows }, (_, index) => <div key={index} className="grid min-h-16 grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-3 rounded-lg border border-ink/8 px-3 py-2">
        <SkeletonBlock className="h-10 w-10 rounded-lg" />
        <LoadingLines widths={[index % 2 ? "58%" : "72%", "42%"]} />
      </div>)}
    </div>
  </LoadingRegion>;
}

export function AdvisorRecommendationLoading() {
  return <main className="mx-auto min-h-[70vh] w-full max-w-[88rem] px-5 py-10 sm:px-8 sm:py-16">
    <LoadingRegion label="Loading For You" className="grid gap-4">
      <p className="rule-label text-forest">For You</p>
      <SkeletonBlock className="h-14 w-[min(78%,40rem)] rounded-md sm:h-16" />
      <SkeletonBlock className="h-5 w-[min(68%,32rem)] rounded-full" />
      <div className="mt-5 grid min-h-80 gap-5 rounded-lg border border-ink/10 bg-[var(--unlocked-surface)] p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div><SkeletonBlock className="h-8 w-32 rounded-md" /><SkeletonBlock className="mt-7 h-12 w-4/5 rounded-md" /><LoadingLines widths={["92%", "78%", "66%"]} className="mt-7 max-w-xl" /></div>
        <SkeletonBlock className="h-56 rounded-lg lg:h-full" />
      </div>
    </LoadingRegion>
  </main>;
}

export function DiscoverPageLoading() {
  return <main className="min-h-[70vh] bg-paper px-5 py-10 sm:px-8 sm:py-14">
    <LoadingRegion label="Opening Discover" className="mx-auto max-w-[112rem]">
      <SkeletonBlock className="h-3 w-24 rounded-full" />
      <SkeletonBlock className="mt-4 h-12 w-[min(100%,34rem)] rounded-md sm:h-16" />
      <SkeletonBlock className="mt-5 h-4 w-[min(82%,28rem)] rounded-full" />
      <SkeletonBlock className="mt-8 h-14 w-full rounded-lg" />
      <div className="mt-5 flex gap-2 overflow-hidden">
        {["w-28", "w-32", "w-24", "w-28", "w-20"].map((width, index) => <SkeletonBlock key={index} className={`h-10 ${width} shrink-0 rounded-full`} />)}
      </div>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => <div key={item} className="min-h-72 rounded-lg border border-ink/10 bg-[var(--unlocked-surface)] p-5">
          <div className="flex items-center gap-3"><SkeletonBlock className="h-11 w-11 rounded-lg" /><LoadingLines widths={["62%", "38%"]} className="flex-1" /></div>
          <SkeletonBlock className="mt-6 h-7 w-4/5 rounded-md" />
          <LoadingLines widths={["100%", "88%", "64%"]} className="mt-5" />
          <SkeletonBlock className="mt-8 h-11 w-full rounded-lg" />
        </div>)}
      </div>
    </LoadingRegion>
  </main>;
}

export function OpportunityDetailLoading() {
  return <main className="min-h-[70vh] bg-[var(--unlocked-surface)] px-5 py-10 sm:px-8 sm:py-16">
    <LoadingRegion label="Opening opportunity" className="mx-auto max-w-6xl">
      <SkeletonBlock className="h-3 w-36 rounded-full" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div><div className="flex items-center gap-4"><SkeletonBlock className="h-14 w-14 rounded-lg" /><SkeletonBlock className="h-4 w-40 rounded-full" /></div><SkeletonBlock className="mt-6 h-14 w-[min(100%,42rem)] rounded-md sm:h-20" /><LoadingLines widths={["88%", "72%"]} className="mt-6 max-w-3xl" /></div>
        <div className="h-48 rounded-lg border border-ink/10 bg-paper p-5"><SkeletonBlock className="h-3 w-28 rounded-full" /><SkeletonBlock className="mt-7 h-12 w-full rounded-lg" /><SkeletonBlock className="mt-4 h-11 w-full rounded-lg" /></div>
      </div>
      <div className="mt-12 grid gap-6 border-y border-ink/10 py-7 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((item) => <LoadingLines key={item} widths={["42%", "72%"]} />)}</div>
      <div className="mt-10 grid gap-8 md:grid-cols-[11rem_minmax(0,1fr)]"><SkeletonBlock className="h-8 w-32 rounded-md" /><LoadingLines widths={["96%", "88%", "72%"]} /></div>
    </LoadingRegion>
  </main>;
}

export function NotificationsPageLoading() {
  return <main className="min-h-[65vh] px-5 py-10 sm:px-8 sm:py-14"><LoadingRegion label="Opening notifications" className="mx-auto max-w-4xl">
    <SkeletonBlock className="h-3 w-28 rounded-full" /><SkeletonBlock className="mt-4 h-12 w-72 rounded-md" /><SkeletonBlock className="mt-4 h-4 w-96 max-w-full rounded-full" />
    <div className="mt-9 rounded-lg border border-ink/10 bg-[var(--unlocked-surface)] p-4 sm:p-6"><SectionLoading label="Loading notification updates" rows={5} /></div>
  </LoadingRegion></main>;
}
