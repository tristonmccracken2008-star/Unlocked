import Link from "next/link";
import type { JourneyCommandCenterModel, JourneyCommandFilter, JourneyCommandRecord, JourneyCommandSort } from "@/lib/journey-command-center";
import { ArrowIcon, BookmarkIcon, CalendarIcon, CloseIcon, MoreIcon, SearchIcon, SendIcon } from "@/components/icons";
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
import { ReturnBriefing } from "@/components/return-briefing";
import type { ReturnBriefingModel } from "@/data/return-experience";
import { guidanceHasBeenSeen } from "@/lib/guidance";
import { ContextualCalendarAction } from "@/components/contextual-calendar-action";
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

function RecordDetails({ record }: { record: JourneyCommandRecord }) {
  const panelId = `journey-record-details-${record.id}`;
  const titleId = `${panelId}-title`;
  return <div className={styles.recordDetails} data-journey-record-details="">
    <button type="button" popoverTarget={panelId} aria-label={`More actions for ${record.title}`} aria-haspopup="dialog"><MoreIcon /><span className="sr-only">More actions</span></button>
    <section id={panelId} popover="auto" className={styles.detailGrid} role="dialog" aria-labelledby={titleId}>
      <header className={styles.detailHeader}>
        <div><p>{record.applicationWorkspace ? "Application details" : "Journey details"}</p><h3 id={titleId}>{record.title}</h3><span>{record.organization}</span></div>
        <button type="button" popoverTarget={panelId} popoverTargetAction="hide" aria-label={`Close details for ${record.title}`}><CloseIcon /></button>
      </header>
      {record.applicationWorkspace ? <ApplicationWorkspace initial={record.applicationWorkspace} opportunityTitle={record.title} submission={record.applicationSubmission} /> : null}
      {record.stageFilter === "interviewing" && !record.latestDetails?.milestoneDate ? <div className={styles.interviewDateAction}><div><strong>Add the interview details</strong><span>This date stays linked to {record.title}.</span></div><ContextualCalendarAction label="Add interview date" context={{ opportunityId: record.id, opportunityTitle: record.title, type: "interview", title: `Interview · ${record.title}`, officialDeadline: record.applicationWorkspace?.deadline, reminderMinutesBefore: 1440 }} /></div> : null}
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
      {record.control ? <section className={styles.progressControl}><h4>Update progress</h4><JourneyTimelineControl control={record.control} compactLabel="Update progress" showFollowUp={false} /></section> : null}
      <div className={styles.detailLinks}>
        {record.opportunity ? <Link href={`/opportunities/${record.id}`}>View opportunity <ArrowIcon /></Link> : <span>The original public listing is no longer available.</span>}
        {record.opportunity?.official_source_url ? <a href={record.opportunity.official_source_url} target="_blank" rel="noreferrer">View official source <ArrowIcon /><span className="sr-only">(opens in a new tab)</span></a> : null}
      </div>
    </section>
  </div>;
}

function JourneyRecordRow({ record, theme, deferRendering = false }: { record: JourneyCommandRecord; theme: JourneyCommandCenterModel["theme"]; deferRendering?: boolean }) {
  const urgency = record.nextDate?.urgency ?? (record.stageFilter === "interviewing" ? "interview" : "normal");
  return <article id={`journey-record-${record.id}`} className={styles.record} data-journey-record="" data-deferred={deferRendering ? "true" : undefined} data-guide-anchor={record.recentChange ? "journey-changelog" : record.applicationWorkspace ? "application-workspace" : undefined} data-stage={record.stageFilter} data-urgency={urgency} data-unavailable={record.unavailable ? "true" : undefined}>
    <div className={styles.recordMain} data-record-identity="">
      {record.opportunity
        ? <OrganizationLogo opportunity={record.opportunity} size="sm" className={theme === "dark" ? styles.darkLogo : ""} />
        : <OrganizationMark organization="" category={record.category} size="sm" className={theme === "dark" ? styles.darkLogo : ""} />}
      <div className={styles.recordIdentity}>
        <h3>{record.title}</h3>
        <p>{record.organization}<span aria-hidden="true"> · </span><span className={styles.inlineUpdated}>Updated {relativeUpdated(record.updatedAt)}</span></p>
        {record.recentChange ? <span className={styles.recordChange} data-importance={record.recentChange.importance}>{record.recentChange.label}</span> : null}
      </div>
    </div>
    <div className={styles.recordStage} data-record-progress="">
      <span className={styles.stage} data-stage={record.stageFilter}>{record.stageLabel}</span>
      {record.applicationWorkspace && !record.applicationWorkspace.submitted && record.applicationWorkspace.totalCount
        ? <span>{record.applicationWorkspace.completedCount}/{record.applicationWorkspace.totalCount} tasks complete{record.applicationWorkspace.deadline ? ` · ${formatDate(record.applicationWorkspace.deadline)}` : ""}</span>
        : record.nextDate ? <span data-urgency={record.nextDate.urgency}>{record.nextDate.timingLabel}{record.nextDate.urgency === "normal" ? ` ${formatDate(record.nextDate.value)}` : ""}</span> : <span>{record.statusDetail}</span>}
    </div>
    <div className={styles.recordActions} data-record-actions="">
      {record.applicationWorkspace && ["Interested", "Applying"].includes(record.status)
        ? <Link className={styles.rowPrimaryAction} href={`/applications/${encodeURIComponent(record.id)}`}>Continue application <ArrowIcon /></Link>
        : record.opportunity ? <Link className={styles.rowPrimaryAction} href={`/opportunities/${encodeURIComponent(record.id)}`}>{["Submitted", "Interview", "Accepted"].includes(record.status) ? "View record" : "Open opportunity"} <ArrowIcon /></Link> : null}
      <RecordDetails record={record} />
    </div>
    {record.lifecycle && ["canceled", "closed", "temporarily_closed"].includes(record.lifecycle.state) ? <p className={styles.lifecycle}>Public listing: {record.lifecycle.label}. Your Journey stage remains {record.stageLabel}.</p> : null}
  </article>;
}

function EmptyRecords({ model }: { model: JourneyCommandCenterModel }) {
  if (model.query) return <SmartEmptyState compact title={`No Journey records match “${model.query}”.`} description="Try another title or organization, or clear the search to see your full Journey." primaryAction={{ label: "Clear search", href: hrefFor(model, { query: "" }) }} />;
  if (model.filter === "history") return <SmartEmptyState compact title="No professional history yet." description="Completed, closed, and archived opportunities will appear here as your private record grows." primaryAction={{ label: "View active opportunities", href: "/#active-opportunities" }} />;
  if (model.filter === "active" && model.activeCount === 0 && model.historyCount > 0) return <SmartEmptyState compact title="Nothing active right now." description="Your completed and closed opportunities are still saved in professional history." primaryAction={{ label: "View professional history", href: hrefFor(model, { stage: "history" }) }} />;
  const heading = model.filter === "active" ? "No active opportunities match this view." : `No opportunities in ${filterLabels[model.filter]} right now.`;
  return <SmartEmptyState compact title={heading} description="Choose another stage to return to the opportunities already in your Journey." primaryAction={{ label: "Show all active opportunities", href: "/#active-opportunities" }} />;
}

function StrategyDetails({ model }: { model: JourneyCommandCenterModel }) {
  const strategy = model.strategy;
  if (!strategy.currentCount) return null;
  return <section className={styles.strategy} aria-labelledby="journey-strategy-heading" data-guide-anchor="journey-strategy">
    <header>
      <div><p>Strategy</p><h2 id="journey-strategy-heading">How your current opportunities fit together</h2></div>
      <span>{strategy.pursuingCount} pursuing · {strategy.watchingCount} watching</span>
    </header>
    <div className={styles.strategyGrid}>
      <section aria-labelledby="strategy-mix-heading">
        <h3 id="strategy-mix-heading">Current mix</h3>
        {strategy.typeMix.length ? <ul className={styles.mixList}>{strategy.typeMix.slice(0, 6).map((item) => <li key={item.id}><span>{item.label}</span><strong>{item.count}</strong></li>)}</ul> : <p>No categorized Journey items yet.</p>}
        {strategy.organizationContext.map((line) => <small key={line}>{line}</small>)}
        {strategy.watching.overlappingCount ? <small>{strategy.watching.overlappingCount} watched {strategy.watching.overlappingCount === 1 ? "opportunity overlaps" : "opportunities overlap"} with what you are pursuing.</small> : null}
        {strategy.historyContext.slice(0, 2).map((line) => <small key={line}>Previously: {line}.</small>)}
        {strategy.pro && strategy.fieldMix.length ? <details className={styles.strategyDetails}>
          <summary>Fields represented <span>View</span></summary>
          <ul className={styles.mixList}>{strategy.fieldMix.slice(0, 6).map((item) => <li key={item.id}><span>{item.label}</span><strong>{item.count}</strong></li>)}</ul>
        </details> : null}
      </section>
      <section aria-labelledby="strategy-timing-heading">
        <h3 id="strategy-timing-heading">Timing</h3>
        <p>{strategy.timing.summary}</p>
        {strategy.activeApplicationCount ? <small>{strategy.activeApplicationCount} active {strategy.activeApplicationCount === 1 ? "application" : "applications"}{strategy.applications.openRequirementCount ? ` · ${strategy.applications.openRequirementCount} known reusable ${strategy.applications.openRequirementCount === 1 ? "requirement needs" : "requirements need"} attention` : ""}</small> : <small>No active applications are recorded.</small>}
        {strategy.applications.recurringRequirements.slice(0, 2).map((requirement) => <small key={requirement.label}>{requirement.label} appears in {requirement.applicationCount} active applications.</small>)}
        <a href="#journey-calendar">View calendar</a>
      </section>
      {strategy.pro ? <section aria-labelledby="strategy-similar-heading">
        <h3 id="strategy-similar-heading">Similar opportunities</h3>
        {strategy.similarities.length ? <div className={styles.similarGroups}>{strategy.similarities.slice(0, 3).map((group) => <details key={group.id}>
          <summary>{group.opportunityIds.length} opportunities overlap <span>View</span></summary>
          <p>{group.reasons.join(" · ")}</p>
          <ul>{group.opportunities.map((item) => <li key={item.id}><Link href={`/opportunities/${encodeURIComponent(item.id)}`}>{item.title}<small>{item.organization}</small></Link></li>)}</ul>
        </details>)}</div> : <p>No strongly similar groups among your current opportunities.</p>}
      </section> : <section className={styles.strategyPro} aria-labelledby="strategy-pro-heading"><h3 id="strategy-pro-heading">See how opportunities overlap</h3><p>Pro adds similarity groups, Path context, and what each new opportunity contributes.</p><Link href="/pricing">View Pro</Link></section>}
      {strategy.pro && strategy.goals.length ? <section aria-labelledby="strategy-goals-heading">
        <h3 id="strategy-goals-heading">Your goals</h3>
        <ul className={styles.goalList}>{strategy.goals.map((goal) => <li key={goal.id}><Link href={`/paths/${goal.id}`}><span>{goal.label}</span><strong>{goal.currentCount ? `${goal.currentCount} current` : "No current Journey items"}</strong></Link></li>)}</ul>
      </section> : null}
    </div>
  </section>;
}

function JourneyWorkspaceSummary({ model }: { model: JourneyCommandCenterModel }) {
  const next = model.workspace.nextAction;
  return <>
    {next ? <section className={styles.nextAction} aria-label="Journey overview" aria-labelledby="journey-next-heading">
      <div className={styles.nextActionCopy}>
        <p>Next</p>
        <h2 id="journey-next-heading">{next.title}</h2>
        {next.organization ? <span>{next.organization}</span> : null}
        <strong>{next.reason}</strong>
        {next.timing ? <small>{next.timing}</small> : null}
      </div>
      <Link href={next.href}>{next.label} <ArrowIcon /></Link>
    </section> : <section className={styles.nextQuiet} aria-label="Journey overview"><p>Your active pursuits are current.</p><span>Open an opportunity below when you are ready to continue.</span></section>}
    {model.workspace.secondaryActions.length ? <section className={styles.secondaryAttention} aria-labelledby="journey-attention-heading">
      <header><h2 id="journey-attention-heading">Needs attention</h2><span>{model.workspace.secondaryActions.length}</span></header>
      <ol>{model.workspace.secondaryActions.map((item) => <li key={item.id}><div><strong>{item.title}</strong><span>{item.reason}{item.timing ? ` ${item.timing}.` : ""}</span></div><Link href={item.href} aria-label={`${item.label}: ${item.title}`}>{item.label} <ArrowIcon /></Link></li>)}</ol>
    </section> : null}
  </>;
}

function JourneyContext({ model }: { model: JourneyCommandCenterModel }) {
  const summary = model.workspace.strategySummary;
  return <section className={styles.contextGrid} aria-label="Journey context">
    <section className={styles.upcoming} aria-labelledby="journey-upcoming-heading">
      <header><div><p>Coming up</p><h2 id="journey-upcoming-heading">Verified dates and your reminders</h2></div><a href="#journey-calendar">Open calendar</a></header>
      {model.workspace.timingSummary ? <p className={styles.timingSummary}>{model.workspace.timingSummary}</p> : null}
      {model.workspace.upcomingDates.length ? <ol>{model.workspace.upcomingDates.map((item) => <li key={item.id}><time dateTime={item.date}><strong>{new Date(`${item.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}</strong><span>{new Date(`${item.date}T12:00:00Z`).getUTCDate()}</span></time><div><strong>{item.opportunityTitle ?? item.title}</strong><span>{item.title} · {item.timingLabel}</span></div></li>)}</ol> : <p className={styles.contextEmpty}>No verified dates or personal reminders are coming up.</p>}
    </section>
    {summary ? <section className={styles.mixSummary} aria-labelledby="journey-mix-heading"><header><p>Current mix</p><h2 id="journey-mix-heading">{summary.activeCount} active {summary.activeCount === 1 ? "opportunity" : "opportunities"}</h2></header><p>{summary.mix || "Your current pursuits are not yet categorized."}</p>{summary.context ? <span>{summary.context}</span> : null}<a href="#journey-strategy">View strategy</a></section> : null}
  </section>;
}

export function JourneyCommandCenter({ model, returnBriefing = null }: { model: JourneyCommandCenterModel; returnBriefing?: ReturnBriefingModel | null }) {
  const hasRecords = model.activeCount + model.historyCount > 0;
  const introGuidePending = model.guidance.eligibility.journey_intro && !guidanceHasBeenSeen(model.guidance.state, "journey_intro");
  const showReturnBriefing = Boolean(returnBriefing?.items.length && !model.workspace.nextAction);
  const analyticsState = !hasRecords ? "empty" : model.activeCount ? "active" : "validated";
  return <main className={styles.page} data-journey-command-center="" data-theme={model.theme}>
    <JourneyAnalytics state={analyticsState} />
    <div className={styles.container}>
      <header className={styles.header}>
        <div><h1>Journey</h1><span>See what you are pursuing and what needs attention next.</span></div>
        <JourneyCommandActions trackedIds={model.trackedIds} />
      </header>
      <JourneyGuidance initialState={model.guidance.state} eligibility={model.guidance.eligibility} suppressed={showReturnBriefing} />
      <JourneySessionFeedback accountKey={model.accountKey} overview={model.overview} attentionCount={model.attentionCount} showHints={!introGuidePending && !showReturnBriefing && model.showFirstUseHints} />
      {showReturnBriefing && returnBriefing ? <ReturnBriefing model={returnBriefing} /> : null}

      {!hasRecords && model.strategy.currentCount === 0 && model.calendar.groups.length === 0 ? <SmartEmptyState className={styles.primaryEmpty} eyebrow="Journey" title="Start building your Journey." description="Add an opportunity from Discover and UnlockED will help you organize deadlines, applications, and meaningful progress in one private place." primaryAction={{ label: "Explore opportunities", href: "/opportunities" }} icon={BookmarkIcon} /> : null}
      {!hasRecords && model.strategy.currentCount ? <StrategyDetails model={model} /> : null}

      {!hasRecords ? null : <>
        {!showReturnBriefing ? <JourneyWorkspaceSummary model={model} /> : null}

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

          {model.activeRecords.length ? <div className={styles.records}>{model.activeRecords.map((record, index) => <JourneyRecordRow key={record.id} record={record} theme={model.theme} deferRendering={index >= 10} />)}</div> : <EmptyRecords model={model} />}
          {model.shownActiveCount < model.matchingActiveCount ? <Link className={styles.viewMore} href={hrefFor(model, { active: "100" })}>View {Math.min(94, model.matchingActiveCount - model.shownActiveCount)} more <span aria-hidden="true">⌄</span></Link> : null}
          {model.activeLimit === 100 && model.activeCount > 100 ? <p className={styles.limitNotice}>Showing the 100 most relevant active records. Use search or a stage filter to narrow the list.</p> : null}
        </section>

        <JourneyContext model={model} />

        <details className={styles.workspaceDisclosure} id="journey-calendar">
          <summary><span><CalendarIcon /></span><span><strong>Calendar</strong><small>Open the complete schedule and planning view.</small></span><ArrowIcon /></summary>
          <JourneyDeadlineCalendar model={model.calendar} intelligence={model.calendarIntelligence} />
        </details>

        {model.strategy.currentCount ? <details className={styles.workspaceDisclosure} id="journey-strategy">
          <summary><span><BookmarkIcon /></span><span><strong>Strategy</strong><small>Review mix, timing, and opportunity overlap.</small></span><ArrowIcon /></summary>
          <StrategyDetails model={model} />
        </details> : null}

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
        </section> : <details className={styles.cardEmpty} id="journey-cards" data-guide-anchor="journey-cards">
          <summary><span><SendIcon /></span><span><strong>Journey Cards</strong><small>Available after a confirmed milestone</small></span><ArrowIcon /></summary>
          <div><strong>Nothing to share yet.</strong><p>Record an interview, acceptance, award, or completed experience to create a private, shareable card.</p><a href={model.activeCount ? "/#active-opportunities" : hrefFor(model, { stage: "history" })}>{model.activeCount ? "Review active opportunities" : "View professional history"}</a></div>
        </details>}
      </>}
    </div>
  </main>;
}

export function JourneyCommandCenterUnavailable() {
  return <main className={styles.page}><div className={styles.container}><section className={styles.error} aria-labelledby="journey-error-heading"><h1 id="journey-error-heading">Your Journey could not be loaded.</h1><p>Your saved opportunities and progress are unchanged. This is a temporary data error, not a sign-in problem.</p><a href="/">Retry <ArrowIcon /></a></section></div></main>;
}
