import Link from "next/link";
import type { JourneyCommandCenterModel, JourneyCommandFilter, JourneyCommandRecord, JourneyCommandSort } from "@/lib/journey-command-center";
import { journeyCommandFilters, journeyCommandSorts } from "@/lib/journey-command-center";
import { ArrowIcon, BookmarkIcon, CheckCircleIcon, SearchIcon } from "@/components/icons";
import { OrganizationLogo } from "@/components/organization-logo";
import { JourneyTimelineControl } from "@/components/journey-timeline-control";
import { JourneyCardEntry } from "@/components/journey-card-entry";
import { JourneyAnalytics } from "@/components/journey-analytics";
import styles from "./journey-command-center.module.css";

const filterLabels: Record<JourneyCommandFilter, string> = {
  active: "All active",
  saved: "Saved",
  preparing: "Preparing",
  applied: "Applied",
  interviewing: "Interviewing",
  offers: "Offers",
  accepted: "Accepted",
  paused: "Paused",
  history: "History",
};

const sortLabels: Record<JourneyCommandSort, string> = {
  attention: "Needs attention",
  deadline: "Next date",
  recent: "Recently updated",
  added: "Date added",
  organization: "Organization",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function relativeUpdated(value: string) {
  const days = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 86_400_000));
  if (days === 0) return "Updated today";
  if (days === 1) return "Updated yesterday";
  if (days < 30) return `Updated ${days} days ago`;
  return `Updated ${formatDate(value)}`;
}

function hrefFor(model: JourneyCommandCenterModel, patch: { stage?: JourneyCommandFilter; sort?: JourneyCommandSort; query?: string; history?: string }) {
  const params = new URLSearchParams();
  const stage = patch.stage ?? model.filter;
  const sort = patch.sort ?? model.sort;
  const query = patch.query ?? model.query;
  if (stage !== "active") params.set("stage", stage);
  if (sort !== "attention") params.set("sort", sort);
  if (query) params.set("q", query);
  if (patch.history) params.set("history", patch.history);
  const value = params.toString();
  return value ? `/?${value}#active-opportunities` : "/#active-opportunities";
}

function RecordDetails({ record }: { record: JourneyCommandRecord }) {
  return <details className={styles.recordDetails} data-journey-record-details="">
    <summary>View details</summary>
    <div className={styles.detailGrid}>
      <dl>
        <div><dt>Journey stage</dt><dd>{record.stageLabel}</dd></div>
        <div><dt>Public listing</dt><dd>{record.lifecycle?.label ?? "Listing unavailable"}{record.lifecycle && !record.lifecycle.actionable ? " · Your Journey stage is unchanged" : ""}</dd></div>
        <div><dt>Added</dt><dd>{formatDate(record.savedAt)}</dd></div>
        <div><dt>Last updated</dt><dd>{formatDate(record.updatedAt)}</dd></div>
        {record.latestDetails?.milestoneDate ? <div><dt>Recorded date</dt><dd>{formatDate(`${record.latestDetails.milestoneDate}T12:00:00.000Z`)}</dd></div> : null}
        {record.latestDetails?.reminderAt ? <div><dt>Reminder</dt><dd>{formatDate(record.latestDetails.reminderAt)}</dd></div> : null}
      </dl>
      {record.latestDetails?.notes ? <section><h4>Private note</h4><p>{record.latestDetails.notes}</p></section> : null}
      {record.latestDetails?.documents?.length ? <section><h4>Document references</h4><ul>{record.latestDetails.documents.map((document) => <li key={document.id}>{document.name}</li>)}</ul><p>References only. Files are not stored by UnlockED.</p></section> : null}
      {record.history.length ? <section><h4>Recent stage history</h4><ol>{record.history.map((item) => <li key={item.id}><span>{item.label.replace(/\b\w/g, (letter) => letter.toUpperCase())}</span><time dateTime={item.occurredAt}>{formatDate(item.occurredAt)}</time></li>)}</ol></section> : null}
      <div className={styles.detailLinks}>
        {record.opportunity ? <Link href={`/opportunities/${record.id}`}>View opportunity <ArrowIcon /></Link> : <span>The original public listing is no longer available.</span>}
        {record.opportunity?.official_source_url ? <a href={record.opportunity.official_source_url} target="_blank" rel="noreferrer">Official source <ArrowIcon /><span className="sr-only">(opens in a new tab)</span></a> : null}
      </div>
    </div>
  </details>;
}

function JourneyRecordRow({ record, theme }: { record: JourneyCommandRecord; theme: JourneyCommandCenterModel["theme"] }) {
  return <article id={`journey-record-${record.id}`} className={styles.record} data-journey-record="" data-stage={record.stageFilter} data-unavailable={record.unavailable ? "true" : undefined}>
    <div className={styles.recordMain}>
      {record.opportunity ? <OrganizationLogo opportunity={record.opportunity} size="sm" className={theme === "dark" ? styles.darkLogo : ""} /> : <span className={styles.fallbackLogo} aria-hidden="true">?</span>}
      <div className={styles.recordIdentity}>
        <p>{record.organization}</p>
        <h3>{record.title}</h3>
        <div className={styles.recordMeta}>
          <span className={styles.stage}>{record.stageLabel}</span>
          {record.nextDate ? <span data-urgency={record.nextDate.urgency}>{record.nextDate.label} {formatDate(record.nextDate.value)}</span> : null}
          <span>{relativeUpdated(record.updatedAt)}</span>
        </div>
        <p className={styles.recordDetail}>{record.statusDetail}</p>
      </div>
    </div>
    <div className={styles.recordActions}>
      {record.lifecycle ? <span className={styles.lifecycle} data-state={record.lifecycle.state}>Public listing: {record.lifecycle.label}</span> : null}
      {record.control ? <JourneyTimelineControl control={record.control} /> : null}
      <RecordDetails record={record} />
    </div>
  </article>;
}

function EmptyJourney() {
  return <section className={styles.empty} aria-labelledby="journey-empty-heading">
    <span aria-hidden="true"><BookmarkIcon /></span>
    <p>Journey</p>
    <h2 id="journey-empty-heading">Keep track of the opportunities you care about.</h2>
    <p>Save an opportunity from Discover or For You, then update your progress as things change.</p>
    <div><Link href="/opportunities">Explore Discover <ArrowIcon /></Link><Link href="/advisor">View For You</Link></div>
  </section>;
}

export function JourneyCommandCenter({ model }: { model: JourneyCommandCenterModel }) {
  const hasRecords = model.activeCount + model.historyCount > 0;
  const analyticsState = !hasRecords ? "empty" : model.activeCount ? "active" : "validated";
  return <main className={styles.page} data-journey-command-center="" data-theme={model.theme}>
    <JourneyAnalytics state={analyticsState} />
    <div className={styles.container}>
      <header className={styles.header}>
        <div><p>Opportunity command center</p><h1>Journey</h1><span>Your private record of what you saved, pursued, and completed.</span></div>
        {hasRecords ? <p><CheckCircleIcon /> Your changes are saved to your account.</p> : null}
      </header>

      {!hasRecords ? <EmptyJourney /> : <>
        <section className={styles.overview} aria-label="Journey overview">
          {model.overview.map((metric) => metric.href ? <Link key={metric.id} href={metric.href}><strong>{metric.value}</strong><span>{metric.label}</span></Link> : <div key={metric.id}><strong>{metric.value}</strong><span>{metric.label}</span></div>)}
        </section>

        {model.attention.length ? <section className={styles.attention} aria-labelledby="journey-attention-heading">
          <header><div><p>Needs attention</p><h2 id="journey-attention-heading">A few records may need an update.</h2></div><span>{model.attention.length}</span></header>
          <ol>{model.attention.map((item) => <li key={item.id}>
            <div><strong>{item.title}</strong><span>{item.reason}</span></div>
            <a href={`#journey-record-${item.recordId}`}>Review <ArrowIcon /></a>
          </li>)}</ol>
        </section> : null}

        <section className={styles.active} id="active-opportunities" aria-labelledby="active-opportunities-heading">
          <header className={styles.sectionHeading}><div><p>Current activity</p><h2 id="active-opportunities-heading">Active opportunities</h2><span>{model.activeCount} active {model.activeCount === 1 ? "record" : "records"}</span></div></header>
          <form className={styles.search} action="/" method="get" role="search">
            <label htmlFor="journey-search"><SearchIcon /><span className="sr-only">Search Journey</span></label>
            <input id="journey-search" name="q" defaultValue={model.query} maxLength={100} placeholder="Search title, organization, or private notes" />
            {model.filter !== "active" ? <input type="hidden" name="stage" value={model.filter} /> : null}
            {model.sort !== "attention" ? <input type="hidden" name="sort" value={model.sort} /> : null}
            <button type="submit">Search</button>
            {model.query ? <Link href={hrefFor(model, { query: "" })}>Clear</Link> : null}
          </form>
          <div className={styles.toolbar}>
            <nav aria-label="Journey stages">
              {journeyCommandFilters.filter((filter) => filter !== "history" && (filter === "active" || model.filterCounts[filter] > 0)).map((filter) => <Link key={filter} href={hrefFor(model, { stage: filter })} aria-current={model.filter === filter ? "page" : undefined}>{filterLabels[filter]} <span>{model.filterCounts[filter]}</span></Link>)}
            </nav>
            <form action="/" method="get">
              {model.filter !== "active" ? <input type="hidden" name="stage" value={model.filter} /> : null}
              {model.query ? <input type="hidden" name="q" value={model.query} /> : null}
              <label htmlFor="journey-sort">Sort</label>
              <select id="journey-sort" name="sort" defaultValue={model.sort}>{journeyCommandSorts.map((sort) => <option key={sort} value={sort}>{sortLabels[sort]}</option>)}</select>
              <button type="submit">Apply</button>
            </form>
          </div>

          {model.activeRecords.length ? <div className={styles.records}>{model.activeRecords.map((record) => <JourneyRecordRow key={record.id} record={record} theme={model.theme} />)}</div> : <div className={styles.noResults}><h3>No active records match.</h3><p>Clear the current search or choose another stage.</p><Link href="/#active-opportunities">Show all active opportunities</Link></div>}
          {model.activeCount > 100 ? <p className={styles.limitNotice}>Showing the 100 most relevant active records. Use search or a stage filter to narrow the list.</p> : null}
        </section>

        {model.historyCount ? <section className={styles.history} id="journey-history" aria-labelledby="journey-history-heading">
          <details open={model.filter === "history" || Boolean(model.query)}>
            <summary><span><small>Past records</small><strong id="journey-history-heading">History</strong></span><b>{model.historyCount}</b></summary>
            <div className={styles.historyBody}>
              {model.historyGroups.map((group) => <section key={group.year} aria-labelledby={`journey-history-${group.year}`}>
                <h3 id={`journey-history-${group.year}`}>{group.year}</h3>
                <div className={styles.records}>{group.records.map((record) => <JourneyRecordRow key={record.id} record={record} theme={model.theme} />)}</div>
              </section>)}
              {model.shownHistoryCount < model.historyCount ? <Link className={styles.loadHistory} href={hrefFor(model, { stage: "history", history: "100" })}>Show more History <ArrowIcon /></Link> : null}
            </div>
          </details>
        </section> : null}

        {model.card.stats.length ? <section className={styles.cards} aria-labelledby="journey-card-heading">
          <div><p>Journey Cards</p><h2 id="journey-card-heading">Keep a factual record of a milestone.</h2><span>Preview every field before exporting. Nothing is published automatically.</span></div>
          <JourneyCardEntry card={model.card} theme={model.theme} />
        </section> : null}
      </>}
    </div>
  </main>;
}

export function JourneyCommandCenterUnavailable() {
  return <main className={styles.page}><div className={styles.container}><section className={styles.error} aria-labelledby="journey-error-heading"><h1 id="journey-error-heading">Your Journey could not be loaded.</h1><p>Your saved opportunities and progress are unchanged. This is a temporary data error, not a sign-in problem.</p><a href="/">Retry <ArrowIcon /></a></section></div></main>;
}
