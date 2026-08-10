import Link from "next/link";
import type { JourneyCommandCenterModel, JourneyCommandFilter, JourneyCommandRecord, JourneyCommandSort, JourneyOverviewCard } from "@/lib/journey-command-center";
import { ArrowIcon, BellIcon, BookmarkIcon, CloseIcon, MoreIcon, SearchIcon, SendIcon, SparkIcon, TargetIcon, TrophyIcon } from "@/components/icons";
import { OrganizationLogo, OrganizationMark } from "@/components/organization-logo";
import { JourneyTimelineControl } from "@/components/journey-timeline-control";
import { JourneyCardEntry } from "@/components/journey-card-entry";
import { JourneyAnalytics } from "@/components/journey-analytics";
import { JourneyCommandActions } from "@/components/journey-command-actions";
import { JourneySessionFeedback } from "@/components/journey-session-feedback";
import { JourneyDeadlineCalendar } from "@/components/journey-deadline-calendar";
import { JourneyGuidance } from "@/components/contextual-guidance";
import { SmartEmptyState } from "@/components/smart-empty-state";
import { ApplicationWorkspace } from "@/components/application-workspace";
import styles from "./journey-command-center.module.css";

const primaryFilters: JourneyCommandFilter[] = ["active", "preparing", "applied", "interviewing", "offers", "saved"];
const secondaryFilters: JourneyCommandFilter[] = ["accepted", "paused"];
const filterLabels: Record<JourneyCommandFilter, string> = {
  active: "All",
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
  deadline: "Deadline",
  recent: "Recently updated",
  added: "Date added",
  organization: "Organization",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function relativeUpdated(value: string) {
  const days = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 86_400_000));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return formatDate(value);
}

function hrefFor(model: JourneyCommandCenterModel, patch: { stage?: JourneyCommandFilter; sort?: JourneyCommandSort; query?: string; history?: string; active?: string }) {
  const params = new URLSearchParams();
  const stage = patch.stage ?? model.filter;
  const sort = patch.sort ?? model.sort;
  const query = patch.query ?? model.query;
  if (stage !== "active") params.set("stage", stage);
  if (sort !== "attention") params.set("sort", sort);
  if (query) params.set("q", query);
  if (patch.history) params.set("history", patch.history);
  const active = patch.active ?? (model.activeLimit === 100 ? "100" : "");
  if (active) params.set("active", active);
  const value = params.toString();
  return value ? `/?${value}#active-opportunities` : "/#active-opportunities";
}

function OverviewIcon({ card }: { card: JourneyOverviewCard }) {
  if (card.id === "next_deadline") return <TargetIcon />;
  if (card.id === "waiting_on") return <BellIcon />;
  if (card.id === "newest_milestone") return <TrophyIcon />;
  return <SparkIcon />;
}

function RecordDetails({ record }: { record: JourneyCommandRecord }) {
  const panelId = `journey-record-details-${record.id}`;
  const titleId = `${panelId}-title`;
  return <div className={styles.recordDetails} data-journey-record-details="">
    <button type="button" popoverTarget={panelId} aria-label={`${record.applicationWorkspace ? "Continue application" : "View details"} for ${record.title}`} aria-haspopup="dialog" data-application-trigger={record.applicationWorkspace ? "true" : undefined}>{record.applicationWorkspace ? <><span>Continue application</span><ArrowIcon /></> : <><MoreIcon /><span className="sr-only">View record details</span></>}</button>
    <section id={panelId} popover="auto" className={styles.detailGrid} role="dialog" aria-labelledby={titleId}>
      <header className={styles.detailHeader}>
        <div><p>{record.applicationWorkspace ? "Application workspace" : "Journey details"}</p><h3 id={titleId}>{record.title}</h3><span>{record.organization}</span></div>
        <button type="button" popoverTarget={panelId} popoverTargetAction="hide" aria-label={`Close details for ${record.title}`}><CloseIcon /></button>
      </header>
      {record.applicationWorkspace ? <ApplicationWorkspace initial={record.applicationWorkspace} opportunityTitle={record.title} submission={record.applicationSubmission} /> : null}
      <dl>
        <div><dt>Journey stage</dt><dd>{record.stageLabel}</dd></div>
        <div><dt>Public listing</dt><dd>{record.lifecycle?.label ?? "Listing unavailable"}{record.lifecycle && !record.lifecycle.actionable ? " · Journey stage unchanged" : ""}</dd></div>
        <div><dt>Added</dt><dd>{formatDate(record.savedAt)}</dd></div>
        <div><dt>Last updated</dt><dd>{formatDate(record.updatedAt)}</dd></div>
        {record.latestDetails?.milestoneDate ? <div><dt>Recorded date</dt><dd>{formatDate(`${record.latestDetails.milestoneDate}T12:00:00.000Z`)}</dd></div> : null}
        {record.latestDetails?.reminderAt ? <div><dt>Reminder</dt><dd>{formatDate(record.latestDetails.reminderAt)}</dd></div> : null}
      </dl>
      {record.latestDetails?.notes ? <section><h4>Private note</h4><p>{record.latestDetails.notes}</p></section> : null}
      {record.latestDetails?.documents?.length ? <section><h4>Document references</h4><ul>{record.latestDetails.documents.map((document) => <li key={document.id}>{document.name}</li>)}</ul><p>References only. Files are not stored by UnlockED.</p></section> : null}
      {record.history.length ? <section><h4>Recent progress</h4><ol>{record.history.map((item) => <li key={item.id}><span>{item.label}</span><time dateTime={item.occurredAt}>{formatDate(item.occurredAt)}</time></li>)}</ol></section> : null}
      <div className={styles.detailLinks}>
        {record.opportunity ? <Link href={`/opportunities/${record.id}`}>View details <ArrowIcon /></Link> : <span>The original public listing is no longer available.</span>}
        {record.opportunity?.official_source_url ? <a href={record.opportunity.official_source_url} target="_blank" rel="noreferrer">Official source <ArrowIcon /><span className="sr-only">(opens in a new tab)</span></a> : null}
      </div>
    </section>
  </div>;
}

function JourneyRecordRow({ record, theme }: { record: JourneyCommandRecord; theme: JourneyCommandCenterModel["theme"] }) {
  const urgency = record.nextDate?.urgency ?? (record.stageFilter === "interviewing" ? "interview" : "normal");
  return <article id={`journey-record-${record.id}`} className={styles.record} data-journey-record="" data-guide-anchor={record.recentChange ? "journey-changelog" : record.applicationWorkspace ? "application-workspace" : undefined} data-stage={record.stageFilter} data-urgency={urgency} data-unavailable={record.unavailable ? "true" : undefined}>
    <div className={styles.recordMain} data-record-identity="">
      {record.opportunity
        ? <OrganizationLogo opportunity={record.opportunity} size="sm" className={theme === "dark" ? styles.darkLogo : ""} />
        : <OrganizationMark organization="" category={record.category} size="sm" className={theme === "dark" ? styles.darkLogo : ""} />}
      <div className={styles.recordIdentity}>
        <h3>{record.title}</h3>
        <p>{record.organization}</p>
        {record.recentChange ? <span className={styles.recordChange} data-importance={record.recentChange.importance}>{record.recentChange.label}</span> : null}
      </div>
    </div>
    <div className={styles.recordStage} data-record-progress="">
      <span className={styles.stage} data-stage={record.stageFilter}>{record.stageLabel}</span>
      {record.applicationWorkspace && !record.applicationWorkspace.submitted && record.applicationWorkspace.totalCount
        ? <span>{record.applicationWorkspace.completedCount}/{record.applicationWorkspace.totalCount} tasks complete{record.applicationWorkspace.deadline ? ` · ${formatDate(record.applicationWorkspace.deadline)}` : ""}</span>
        : record.nextDate ? <span data-urgency={record.nextDate.urgency}>{record.nextDate.timingLabel}{record.nextDate.urgency === "normal" ? ` ${formatDate(record.nextDate.value)}` : ""}</span> : <span>{record.statusDetail}</span>}
    </div>
    <div className={styles.recordUpdated}><span>Updated</span><strong>{relativeUpdated(record.updatedAt)}</strong></div>
    <div className={styles.recordActions} data-record-actions="">
      {record.control ? <JourneyTimelineControl control={record.control} compactLabel="Update" showFollowUp={false} /> : null}
      <RecordDetails record={record} />
    </div>
    {record.lifecycle && !record.lifecycle.actionable ? <p className={styles.lifecycle}>Public listing: {record.lifecycle.label}. Your Journey stage remains {record.stageLabel}.</p> : null}
  </article>;
}

function EmptyRecords({ model }: { model: JourneyCommandCenterModel }) {
  if (model.query) return <SmartEmptyState compact title={`No Journey records match “${model.query}”.`} description="Try another title or organization, or clear the search to see your full Journey." primaryAction={{ label: "Clear search", href: hrefFor(model, { query: "" }) }} />;
  if (model.filter === "history") return <SmartEmptyState compact title="No professional history yet." description="Completed, closed, and archived opportunities will appear here as your private record grows." primaryAction={{ label: "View active opportunities", href: "/#active-opportunities" }} />;
  if (model.filter === "active" && model.activeCount === 0 && model.historyCount > 0) return <SmartEmptyState compact title="Nothing active right now." description="Your completed and closed opportunities are still saved in professional history." primaryAction={{ label: "View professional history", href: hrefFor(model, { stage: "history" }) }} />;
  const heading = model.filter === "active" ? "No active opportunities match this view." : `No opportunities in ${filterLabels[model.filter]} right now.`;
  return <SmartEmptyState compact title={heading} description="Choose another stage to return to the opportunities already in your Journey." primaryAction={{ label: "Show all active opportunities", href: "/#active-opportunities" }} />;
}

export function JourneyCommandCenter({ model }: { model: JourneyCommandCenterModel }) {
  const hasRecords = model.activeCount + model.historyCount > 0;
  const analyticsState = !hasRecords ? "empty" : model.activeCount ? "active" : "validated";
  return <main className={styles.page} data-journey-command-center="" data-theme={model.theme}>
    <JourneyAnalytics state={analyticsState} />
    <div className={styles.container}>
      <header className={styles.header}>
        <div><h1>Journey</h1><span>Your private record of what you saved, pursued, and accomplished.</span></div>
        <JourneyCommandActions trackedIds={model.trackedIds} />
      </header>
      <JourneyGuidance initialState={model.guidance.state} eligibility={model.guidance.eligibility} />
      <JourneySessionFeedback accountKey={model.accountKey} overview={model.overview} attentionCount={model.attentionCount} showHints={model.showFirstUseHints} />

      {!hasRecords && model.calendar.groups.length === 0 ? <SmartEmptyState className={styles.primaryEmpty} eyebrow="Journey" title="Start building your Journey." description="Add an opportunity from Discover and UnlockED will help you organize deadlines, applications, and meaningful progress in one private place." primaryAction={{ label: "Explore opportunities", href: "/opportunities" }} icon={BookmarkIcon} /> : null}

      {hasRecords && model.overview.length ? <section className={styles.overview} aria-label="Journey overview" data-count={model.overview.length}>
          {model.overview.map((card) => <a key={card.id} href={card.href} data-tone={card.tone} data-overview-id={card.id}>
            <span className={styles.overviewIcon} aria-hidden="true"><OverviewIcon card={card} /></span>
            <small>{card.label}</small>
            <strong>{card.value}</strong>
            <b>{card.title}</b>
            <span>{card.detail}</span>
            <i aria-hidden="true"><ArrowIcon /></i>
          </a>)}
        </section> : null}

      <JourneyDeadlineCalendar model={model.calendar} />

      {!hasRecords ? null : <>

        {model.attention.length ? <section className={styles.attention} aria-labelledby="journey-attention-heading">
          <header><h2 id="journey-attention-heading">Needs attention <span>{model.attentionCount}</span></h2>{model.attentionCount > model.attention.length ? <a href={hrefFor(model, { active: "100" })}>View all</a> : null}</header>
          <ol>{model.attention.map((item) => <li key={item.id} data-priority={item.priority}>
            <span className={styles.attentionIcon} aria-hidden="true">{item.id.startsWith("deadline") ? <TargetIcon /> : item.id.startsWith("reminder") ? <BellIcon /> : <SparkIcon />}</span>
            <div><strong>{item.title}</strong><span>{item.reason}</span></div>
            <b>{item.priority === 1 ? "Urgent" : item.priority === 2 ? "Due soon" : item.priority === 3 ? "Update" : "Review"}</b>
            <a href={`#journey-record-${item.recordId}`} aria-label={`Review ${item.title}`}><ArrowIcon /></a>
          </li>)}</ol>
        </section> : null}

        <section className={styles.active} id="active-opportunities" data-guide-anchor="active-opportunities" aria-labelledby="active-opportunities-heading">
          <div className={styles.sectionHeading}><h2 id="active-opportunities-heading">Active opportunities <span>{model.activeCount}</span></h2></div>
          <div className={styles.toolbar}>
            <nav aria-label="Journey stages">
              {primaryFilters.filter((filter) => filter === "active" || model.filterCounts[filter] > 0).map((filter) => <Link key={filter} href={hrefFor(model, { stage: filter })} aria-current={model.filter === filter ? "page" : undefined}>{filterLabels[filter]} <span>{model.filterCounts[filter]}</span></Link>)}
              {secondaryFilters.some((filter) => model.filterCounts[filter] > 0) ? <details><summary>More</summary><div>{secondaryFilters.filter((filter) => model.filterCounts[filter] > 0).map((filter) => <Link key={filter} href={hrefFor(model, { stage: filter })} aria-current={model.filter === filter ? "page" : undefined}>{filterLabels[filter]} <span>{model.filterCounts[filter]}</span></Link>)}</div></details> : null}
            </nav>
            <div className={styles.listTools}>
              <details className={styles.searchDisclosure}>
                <summary aria-label="Search Journey"><SearchIcon /></summary>
                <form action="/" method="get" role="search">
                  <label htmlFor="journey-search" className="sr-only">Search Journey</label>
                  <input id="journey-search" name="q" defaultValue={model.query} maxLength={100} placeholder="Search Journey" />
                  {model.filter !== "active" ? <input type="hidden" name="stage" value={model.filter} /> : null}
                  {model.sort !== "attention" ? <input type="hidden" name="sort" value={model.sort} /> : null}
                  <button type="submit">Search</button>
                  {model.query ? <Link href={hrefFor(model, { query: "" })}>Clear</Link> : null}
                </form>
              </details>
              <details className={styles.sortMenu}>
                <summary>Sort: {sortLabels[model.sort]}</summary>
                <div>{(Object.keys(sortLabels) as JourneyCommandSort[]).map((sort) => <Link key={sort} href={hrefFor(model, { sort })} aria-current={model.sort === sort ? "page" : undefined}>{sortLabels[sort]}</Link>)}</div>
              </details>
            </div>
          </div>
          {model.query ? <p className={styles.activeQuery}>Results for “{model.query}” <Link href={hrefFor(model, { query: "" })}>Clear search</Link></p> : null}

          {model.activeRecords.length ? <div className={styles.records}>{model.activeRecords.map((record) => <JourneyRecordRow key={record.id} record={record} theme={model.theme} />)}</div> : <EmptyRecords model={model} />}
          {model.shownActiveCount < model.matchingActiveCount ? <Link className={styles.viewMore} href={hrefFor(model, { active: "100" })}>View {Math.min(94, model.matchingActiveCount - model.shownActiveCount)} more <span aria-hidden="true">⌄</span></Link> : null}
          {model.activeLimit === 100 && model.activeCount > 100 ? <p className={styles.limitNotice}>Showing the 100 most relevant active records. Use search or a stage filter to narrow the list.</p> : null}
        </section>

        {model.historyCount ? <section className={styles.history} id="journey-history" data-guide-anchor="journey-history" aria-labelledby="journey-history-heading">
          <header><h2 id="journey-history-heading">Professional history</h2>{model.shownHistoryCount < model.historyCount ? <Link href={hrefFor(model, { stage: "history", history: "100" })}>View full history</Link> : null}</header>
          <div className={styles.historyGroups}>
            {model.historyGroups.map((group) => <details key={group.year} open={model.filter === "history" || Boolean(model.query)}>
              <summary><span><strong>{group.year}</strong><small>{group.count} {group.count === 1 ? "record" : "records"}</small></span><p>{group.completed ? `Completed ${group.completed}` : ""}{group.closed ? `${group.completed ? " · " : ""}Closed ${group.closed}` : ""}{group.archived ? `${group.completed || group.closed ? " · " : ""}Archived ${group.archived}` : ""}</p><ArrowIcon /></summary>
              {group.records.length ? <div className={styles.records}>{group.records.map((record) => <JourneyRecordRow key={record.id} record={record} theme={model.theme} />)}</div> : <p className={styles.historyDeferred}>Open the full History view to load these earlier records.</p>}
            </details>)}
          </div>
        </section> : null}

        {model.cardEligible ? <section className={styles.cards} id="journey-cards" data-guide-anchor="journey-cards" aria-labelledby="journey-card-heading">
          <div><span aria-hidden="true"><SendIcon /></span><div><p>Journey Cards</p><h2 id="journey-card-heading">Present a confirmed milestone.</h2><small>Create a polished record of factual progress. Nothing is published automatically.</small></div></div>
          <JourneyCardEntry card={model.card} theme={model.theme} />
        </section> : <SmartEmptyState compact className={styles.cardEmpty} eyebrow="Journey Cards" title="Nothing to share yet." description="Journey Cards become available after you record a meaningful milestone such as an interview, acceptance, award, or completed experience." primaryAction={model.activeCount ? { label: "Review active opportunities", href: "/#active-opportunities" } : { label: "View professional history", href: hrefFor(model, { stage: "history" }) }} icon={SendIcon} />}
      </>}
    </div>
  </main>;
}

export function JourneyCommandCenterUnavailable() {
  return <main className={styles.page}><div className={styles.container}><section className={styles.error} aria-labelledby="journey-error-heading"><h1 id="journey-error-heading">Your Journey could not be loaded.</h1><p>Your saved opportunities and progress are unchanged. This is a temporary data error, not a sign-in problem.</p><a href="/">Retry <ArrowIcon /></a></section></div></main>;
}
