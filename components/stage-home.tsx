import Link from "next/link";
import {
  educationalStageDetails,
  type EducationalStage,
} from "@/lib/education-stages";

export function StageHome({
  stage,
  firstName,
  collegeList,
  experienceBank,
}: {
  stage: Exclude<EducationalStage, "undergraduate">;
  firstName: string;
  collegeList?: { saved: number; active: number; decisions: number };
  experienceBank?: { count: number; applicationActivitiesReady: boolean };
}) {
  const detail = educationalStageDetails[stage];
  return (
    <main className="min-h-[calc(100vh-5rem)] px-5 py-10 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <section className="relative overflow-hidden rounded-[2rem] border border-ink/10 bg-[var(--unlocked-surface)] px-6 py-12 shadow-soft sm:px-12 sm:py-16">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-forest/35 to-transparent"
          />
          <p className="rule-label text-forest">Good morning, {firstName}</p>
          <h1 className="mt-5 max-w-3xl font-editorial text-5xl font-semibold leading-[1.02] text-[var(--unlocked-text)] sm:text-6xl">
            {detail.homeTitle}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-ink/55">
            {detail.homeDescription}
          </p>
          {stage === "high_school" ? (
            <Link
              href="/advisor"
              className="mt-6 inline-flex min-h-11 items-center rounded-full bg-forest px-5 text-sm font-bold text-white transition hover:bg-ink"
            >
              Open For You →
            </Link>
          ) : null}
          {stage === "high_school" && collegeList ? (
            <div className="mt-9 grid gap-px overflow-hidden rounded-2xl border border-ink/10 bg-ink/10 sm:grid-cols-[1.4fr_.6fr]">
              <Link href="/admissions" className="group bg-ink p-6 text-white">
                <p className="text-[10px] font-bold uppercase tracking-[.14em] text-white/45">
                  What matters right now
                </p>
                <h2 className="mt-3 font-editorial text-2xl font-semibold">
                  {collegeList.active
                    ? "Continue your admissions plan"
                    : collegeList.saved
                      ? "Choose what to learn next"
                      : "Find a college worth understanding"}
                </h2>
                <p className="mt-2 text-sm text-white/55">
                  Open your Admissions Journey →
                </p>
              </Link>
              <Link
                href="/colleges/saved"
                className="bg-[var(--unlocked-surface)] p-6 hover:bg-mint/60"
              >
                <p className="text-[10px] font-bold uppercase tracking-[.14em] text-ink/38">
                  My College List
                </p>
                <p className="mt-3 font-editorial text-2xl font-semibold">
                  {collegeList.saved} saved
                </p>
                <p className="mt-2 text-xs text-ink/45">
                  {collegeList.active} planned or applied ·{" "}
                  {collegeList.decisions} decisions
                </p>
              </Link>
            </div>
          ) : null}
          {stage === "high_school" && experienceBank ? (
            <Link
              href="/build"
              className="mt-4 grid gap-3 rounded-2xl border border-ink/10 bg-mint/35 p-5 transition hover:bg-mint/60 sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.14em] text-forest">
                  Activities &amp; Experiences
                </p>
                <h2 className="mt-2 font-editorial text-2xl font-semibold">
                  {experienceBank.count
                    ? `${experienceBank.count} experience${experienceBank.count === 1 ? "" : "s"} in your bank`
                    : "Build your experience bank"}
                </h2>
                <p className="mt-1 text-xs text-ink/45">
                  Application Activities ·{" "}
                  {experienceBank.applicationActivitiesReady
                    ? "Ready"
                    : "Draft"}
                </p>
              </div>
              <span className="text-sm font-bold text-forest">
                Open Build →
              </span>
            </Link>
          ) : null}
          <div className="mt-12 grid border-y border-ink/10 sm:grid-cols-2">
            {detail.priorities.map((priority, index) => (
              <article
                key={priority.title}
                className={`py-6 sm:p-7 ${index % 2 === 0 ? "sm:border-r sm:border-ink/10" : ""} ${index > 1 ? "border-t border-ink/10" : index === 1 ? "border-t border-ink/10 sm:border-t-0" : ""}`}
              >
                <p className="text-xs font-bold uppercase tracking-[.14em] text-forest/70">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h2 className="mt-3 font-editorial text-2xl font-semibold text-[var(--unlocked-text)]">
                  {priority.title}
                </h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-ink/50">
                  {priority.description}
                </p>
                {stage === "high_school" &&
                priority.title === "Explore colleges" ? (
                  <Link
                    href="/colleges"
                    className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-forest"
                  >
                    Open College Explorer →
                  </Link>
                ) : stage === "high_school" &&
                  priority.title === "Find opportunities" ? (
                  <Link
                    href="/opportunities"
                    className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-forest"
                  >
                    Explore opportunities →
                  </Link>
                ) : stage === "high_school" &&
                  priority.title === "Plan your applications" ? (
                  <Link
                    href="/admissions"
                    className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-forest"
                  >
                    Open Admissions Journey →
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs font-medium text-ink/40">
              Your workspace will grow with you. Your history stays connected.
            </p>
            <Link
              href="/profile#education"
              className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold text-forest hover:bg-forest/[.05]"
            >
              Review educational stage →
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
