import Link from "next/link";
import { educationalStageDetails, type EducationalStage } from "@/lib/education-stages";

export function StageHome({ stage, firstName }: { stage: Exclude<EducationalStage, "undergraduate">; firstName: string }) {
  const detail = educationalStageDetails[stage];
  return <main className="min-h-[calc(100vh-5rem)] px-5 py-10 sm:px-8 sm:py-16">
    <div className="mx-auto max-w-6xl">
      <section className="relative overflow-hidden rounded-[2rem] border border-ink/10 bg-[var(--unlocked-surface)] px-6 py-12 shadow-soft sm:px-12 sm:py-16">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-forest/35 to-transparent" />
        <p className="rule-label text-forest">Good morning, {firstName}</p>
        <h1 className="mt-5 max-w-3xl font-editorial text-5xl font-semibold leading-[1.02] text-[var(--unlocked-text)] sm:text-6xl">{detail.homeTitle}</h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-ink/55">{detail.homeDescription}</p>
        <div className="mt-12 grid border-y border-ink/10 sm:grid-cols-2">
          {detail.priorities.map((priority, index) => <article key={priority.title} className={`py-6 sm:p-7 ${index % 2 === 0 ? "sm:border-r sm:border-ink/10" : ""} ${index > 1 ? "border-t border-ink/10" : index === 1 ? "border-t border-ink/10 sm:border-t-0" : ""}`}>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-forest/70">{String(index + 1).padStart(2, "0")}</p>
            <h2 className="mt-3 font-editorial text-2xl font-semibold text-[var(--unlocked-text)]">{priority.title}</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-ink/50">{priority.description}</p>
            {stage === "high_school" && priority.title === "Explore colleges" ? <Link href="/colleges" className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-forest">Open College Explorer →</Link> : null}
          </article>)}
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs font-medium text-ink/40">Your workspace will grow with you. Your history stays connected.</p>
          <Link href="/profile#education" className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold text-forest hover:bg-forest/[.05]">Review educational stage →</Link>
        </div>
      </section>
    </div>
  </main>;
}
