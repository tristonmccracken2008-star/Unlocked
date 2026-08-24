import Link from "next/link";
import type { OpportunityInsightsModel } from "@/data/opportunity-insights";
import type { GuidanceState } from "@/lib/guidance";
import { InsightsGuidance } from "./contextual-guidance";
import { OpportunityInsightsAnalytics } from "./opportunity-insights-analytics";
import styles from "./opportunity-insights.module.css";

const periods = [
  { id: "all", label: "All time" },
  { id: "current_year", label: "This year" },
  { id: "previous_year", label: "Last year" },
] as const;

function plural(count: number, singular: string, multiple = `${singular}s`) { return `${count} ${count === 1 ? singular : multiple}`; }

export function OpportunityInsights({ model, guidance }: { model: OpportunityInsightsModel; guidance: GuidanceState }) {
  const activityMax = Math.max(1, ...model.activity.map((item) => item.total));
  const categoryMax = Math.max(1, ...model.categories.map((item) => item.pursued + item.completed));
  return <main className={styles.page} data-opportunity-insights="v1">
    <OpportunityInsightsAnalytics />
    <div className={styles.shell}>
      <header className={styles.hero}>
        <div><p className={styles.eyebrow}>Private opportunity history</p><h1>Insights</h1><p>What your own recorded activity shows over time. No peer comparisons or predicted outcomes.</p></div>
        <nav className={styles.periods} aria-label="History period">{periods.map((item) => <Link key={item.id} href={`/insights?period=${item.id}`} aria-current={model.period === item.id ? "page" : undefined}>{item.label}</Link>)}</nav>
      </header>

      <InsightsGuidance initialState={guidance} eligible={!model.sparse && model.overview.applicationsSubmitted + model.overview.accomplishments >= 3} />

      {model.sparse ? <section className={styles.starting} aria-labelledby="insights-starting-title"><p className={styles.eyebrow}>Your record is taking shape</p><h2 id="insights-starting-title">There is not much history to summarize yet.</h2><p>Add opportunities to Journey and record real progress. Insights will organize that history without guessing what happened.</p><Link href="/opportunities">Explore opportunities</Link></section> : null}

      <section className={styles.summary} aria-labelledby="insights-summary-title">
        <div><p className={styles.eyebrow}>{model.periodLabel}</p><h2 id="insights-summary-title">Your opportunity record</h2>{model.recordedSince ? <p>Recorded since {model.recordedSince}</p> : <p>Based on the account history available today.</p>}</div>
        <dl>
          <div><dt>Active in Journey</dt><dd>{model.overview.activeJourney}</dd></div>
          <div><dt>Applications recorded</dt><dd>{model.overview.applicationsSubmitted}</dd></div>
          <div><dt>Outcomes recorded</dt><dd>{model.overview.outcomesRecorded}</dd></div>
          <div><dt>Accomplishments</dt><dd>{model.overview.accomplishments}</dd></div>
        </dl>
      </section>

      <section className={styles.section} aria-labelledby="application-history-title">
        <header><div><p className={styles.eyebrow}>Application history</p><h2 id="application-history-title">Where recorded applications stand</h2></div><span className={styles.coverage}>{model.applications.coverage.level === "fully_supported" ? "Complete event dates" : "Some legacy dates unavailable"}</span></header>
        {model.applications.submitted ? <div className={styles.applicationGrid}>
          <div className={styles.progression} aria-label="Recorded application progression">{model.progression.map((item, index) => <div key={item.id}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.count}</strong><p>{item.label}</p></div>)}</div>
          <dl className={styles.outcomes}><div><dt>Awaiting an outcome</dt><dd>{model.applications.awaiting}</dd></div><div><dt>Accepted or awarded</dt><dd>{model.applications.accepted}</dd></div><div><dt>Not selected</dt><dd>{model.applications.notSelected}</dd></div><div><dt>Withdrawn or declined</dt><dd>{model.applications.withdrawnOrDeclined}</dd></div></dl>
        </div> : <p className={styles.quietEmpty}>No application submissions are recorded for this period. Current Journey items remain unchanged.</p>}
      </section>

      <section className={styles.section} aria-labelledby="activity-title">
        <header><div><p className={styles.eyebrow}>Activity over time</p><h2 id="activity-title">When your record changed</h2></div>{model.seasonality ? <p className={styles.annotation}>{model.seasonality.month} has the most recorded submissions ({model.seasonality.count}).</p> : null}</header>
        {model.activity.length ? <ol className={styles.activityChart} aria-label="Monthly recorded activity">{model.activity.map((item) => <li key={item.month} className={styles.month}><div className={styles.barTrack} aria-hidden="true"><span style={{ height: `${Math.max(8, item.total / activityMax * 100)}%` }} /></div><strong>{item.total}</strong><span>{item.label}</span><small className="sr-only">{plural(item.added, "addition")}, {plural(item.submitted, "submission")}, {plural(item.outcomes, "outcome")}, {plural(item.completed, "completion")}</small></li>)}</ol> : <p className={styles.quietEmpty}>No dated activity is available for this period.</p>}
      </section>

      <section className={styles.section} aria-labelledby="category-title">
        <header><div><p className={styles.eyebrow}>Category history</p><h2 id="category-title">What you have pursued</h2></div></header>
        <div className={styles.categoryList}>{model.categories.map((category) => <article key={category.id}><div><h3>{category.label}</h3><p>{category.pursued ? `${plural(category.pursued, "Journey record")} · ${plural(category.completed, "completion")}` : "No recorded activity yet"}</p></div><div className={styles.categoryTrack} aria-hidden="true"><span style={{ width: `${(category.pursued + category.completed) / categoryMax * 100}%` }} /></div>{category.pursued ? null : <Link href={category.discoverHref}>Explore</Link>}</article>)}</div>
      </section>

      <div className={styles.twoColumn}>
        <section className={styles.section} aria-labelledby="paths-title"><header><div><p className={styles.eyebrow}>Opportunity Paths</p><h2 id="paths-title">Directions in your history</h2></div><Link href="/paths">View Paths</Link></header>{model.paths.length ? <div className={styles.simpleList}>{model.paths.map((path) => <article key={path.id}><h3>{path.name}</h3><p>{[path.followed ? "Followed" : null, path.inJourney ? plural(path.inJourney, "active record") : null, path.completed ? plural(path.completed, "completion") : null, path.watching ? plural(path.watching, "watched opportunity") : null].filter(Boolean).join(" · ")}</p>{path.stages.length ? <small>{path.stages.map((stage) => `${stage.name}: ${stage.completed} completed, ${stage.inJourney} in Journey, ${stage.watching} watching`).join(" · ")}</small> : null}</article>)}</div> : <p className={styles.quietEmpty}>Your recorded opportunities do not map to a Path yet.</p>}</section>
        <section className={styles.section} aria-labelledby="materials-title"><header><div><p className={styles.eyebrow}>Application Materials</p><h2 id="materials-title">What you have reused</h2></div><Link href="/materials">Open Materials</Link></header>{model.materials.reuse.length ? <div className={styles.simpleList}>{model.materials.reuse.map((item) => <article key={item.materialId}><h3>{item.title}</h3><p>{item.typeLabel} · Used with {plural(item.applicationCount, "opportunity")}</p></article>)}</div> : <p className={styles.quietEmpty}>Material reuse will appear after a saved version is selected for an application.</p>}{model.materials.requirements.length ? <div className={styles.requirements}><strong>Recurring verified requirements</strong><p>{model.materials.requirements.map((item) => `${item.label} in ${item.applicationCount}`).join(" · ")}</p></div> : null}</section>
      </div>

      <section className={styles.section} aria-labelledby="years-title"><header><div><p className={styles.eyebrow}>Year by year</p><h2 id="years-title">Your recorded history</h2>{model.accomplishments.groups.length ? <p className={styles.annotation}>{model.accomplishments.groups.map((item) => `${item.count} ${item.label.toLowerCase()}`).join(" · ")}</p> : null}</div><Link href="/accomplishments">View accomplishments</Link></header>{model.annual.length ? <div className={styles.yearList}>{model.annual.map((year) => <article key={year.year}><h3>{year.year}</h3><p>{plural(year.pursued, "opportunity", "opportunities")} added</p><p>{plural(year.submitted, "submission")}</p><p>{plural(year.outcomes, "outcome")}</p><p>{plural(year.accomplishments, "accomplishment")}</p></article>)}</div> : <p className={styles.quietEmpty}>No dated history is available yet.</p>}</section>

      <details className={styles.method}><summary>How this history is calculated</summary><div><p>Insights is generated from your private Journey, accomplishment, Path, Watch, and Application Materials records. It is not a score and is not compared with other students.</p><dl><div><dt>Lifecycle history</dt><dd>{model.coverage.lifecycle.detail}</dd></div><div><dt>Watch history</dt><dd>{model.coverage.watchHistory.detail}</dd></div><div><dt>Recommendation source</dt><dd>{model.coverage.recommendationAttribution.detail}</dd></div><div><dt>Discovery source</dt><dd>{model.coverage.discoverySource.detail}</dd></div><div><dt>Academic year</dt><dd>{model.coverage.academicYear.detail}</dd></div></dl></div></details>
    </div>
  </main>;
}

export function OpportunityInsightsUnavailable() { return <main className={styles.page}><div className={styles.shell}><section className={styles.starting}><h1>Your insights could not load.</h1><p>Your account history is unchanged. Refresh to try again.</p><Link href="/insights">Retry</Link></section></div></main>; }

export function OpportunityInsightsSkeleton() { return <main className={styles.page} aria-busy="true" aria-label="Loading opportunity insights"><div className={styles.shell}><div className={styles.skeletonHero} /><div className={styles.skeletonBand} /><div className={styles.skeletonGrid}><span /><span /><span /></div></div></main>; }
