import Link from "next/link";
import type { ComponentType } from "react";
import type { JourneyTimelineEvent, JourneyTimelineEventType, JourneyTimelineModel } from "@/lib/journey-timeline";
import { ArrowIcon, BookmarkIcon, CheckCircleIcon, HeartIcon, PenLineIcon, SendIcon, TargetIcon, TrophyIcon, XCircleIcon } from "@/components/icons";
import { OrganizationLogo } from "@/components/organization-logo";
import { JourneyTimelineControl } from "@/components/journey-timeline-control";
import { JourneyCardEntry } from "@/components/journey-card-entry";
import { JourneyAnalytics } from "@/components/journey-analytics";
import { JourneyTimelineFilters } from "@/components/journey-timeline-filters";
import styles from "./journey-timeline.module.css";

type Icon = ComponentType<{ className?: string }>;

const eventIcons: Record<JourneyTimelineEventType, Icon> = {
  saved: BookmarkIcon,
  interested: HeartIcon,
  application_started: PenLineIcon,
  application_submitted: SendIcon,
  interview: TargetIcon,
  accepted: CheckCircleIcon,
  scholarship_awarded: TrophyIcon,
  completed: TrophyIcon,
  paused: TargetIcon,
  resumed: HeartIcon,
  closed: XCircleIcon,
  milestone: CheckCircleIcon,
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function statusLabel(status: JourneyTimelineEvent["status"]) {
  if (status === "Interview") return "Interviewing";
  if (status === "Rejected") return "Closed";
  return status;
}

function TimelineEvent({ event, theme, chapter, initiallyHidden }: { event: JourneyTimelineEvent; theme: JourneyTimelineModel["theme"]; chapter?: string; initiallyHidden: boolean }) {
  const Icon = eventIcons[event.type];
  const important = ["interview", "accepted", "scholarship_awarded", "completed", "milestone"].includes(event.type);
  return <li className={styles.event} data-event-type={event.type} data-event-filters={event.filters.join(" ")} data-event-emphasis={important ? "strong" : "standard"} data-has-chapter={chapter ? "true" : "false"} data-earlier-moment={initiallyHidden ? "true" : "false"}>
    {chapter ? <p className={styles.chapter}>{chapter}</p> : null}
    <div className={styles.date}><time dateTime={event.occurredAt}>{formatDate(event.occurredAt)}</time></div>
    <div className={styles.marker} aria-hidden="true"><Icon /></div>
    <article className={styles.eventBody}>
      <div className={styles.eventHeading}>
        {event.opportunity ? <OrganizationLogo opportunity={event.opportunity} size="sm" className={theme === "dark" ? styles.darkLogo : ""} /> : null}
        <div><p>{event.label}</p><h2>{event.title}</h2></div>
      </div>
      <p className={styles.description}>{event.description}</p>
      <div className={styles.eventFooter}>
        <span className={styles.status}>{statusLabel(event.status)}</span>
        {event.opportunity ? <Link href={`/opportunities/${event.opportunity.id}`}>View opportunity <ArrowIcon /></Link> : null}
      </div>
      {event.opportunity ? <details className={styles.eventDetails} data-journey-moment="">
        <summary>Details</summary>
        <dl>
          <div><dt>Organization</dt><dd>{event.opportunity.organization}</dd></div>
          <div><dt>Category</dt><dd>{event.opportunity.category}</dd></div>
          <div><dt>Recorded</dt><dd>{formatDate(event.occurredAt)}</dd></div>
        </dl>
      </details> : null}
      {event.control ? <JourneyTimelineControl control={event.control} /> : null}
    </article>
  </li>;
}

function ProgressSnapshot({ model }: { model: JourneyTimelineModel }) {
  if (!model.summary.length) return null;
  return <section className={styles.snapshot} aria-labelledby="journey-progress-heading" data-journey-summary="">
    <div className={styles.snapshotHeading}>
      <p>Current progress</p>
      <h2 id="journey-progress-heading">What you have made real.</h2>
    </div>
    <dl className={styles.metrics}>
      {model.summary.map((metric) => <div key={metric.id} data-summary-metric={metric.id}><dd>{metric.value}</dd><dt>{metric.label}</dt></div>)}
    </dl>
  </section>;
}

function Highlights({ model }: { model: JourneyTimelineModel }) {
  if (!model.highlights.length) return null;
  return <section className={styles.highlights} aria-labelledby="journey-highlights-heading" data-journey-highlights="">
    <header><p>Highlights</p><h2 id="journey-highlights-heading">Moments worth remembering.</h2></header>
    <ol>
      {model.highlights.map((highlight) => <li key={highlight.id}>
        <article>
          <div className={styles.highlightIdentity}>
            {highlight.opportunity ? <OrganizationLogo opportunity={highlight.opportunity} size="sm" className={model.theme === "dark" ? styles.darkLogo : ""} /> : <span className={styles.highlightMark} aria-hidden="true"><TrophyIcon /></span>}
            <div><p>{highlight.label}</p><time dateTime={highlight.occurredAt}>{formatDate(highlight.occurredAt)}</time></div>
          </div>
          <h3>{highlight.title}</h3>
          <span>{highlight.description}</span>
        </article>
      </li>)}
    </ol>
  </section>;
}

function EmptyJourneyArtwork() {
  return <div className={styles.emptyArtwork} aria-hidden="true">
    <span className={styles.emptyPath} />
    <span className={styles.emptyPoint} data-point="start"><BookmarkIcon /></span>
    <span className={styles.emptyPoint} data-point="middle" />
    <span className={styles.emptyPoint} data-point="end"><TrophyIcon /></span>
  </div>;
}

export function JourneyTimeline({ model }: { model: JourneyTimelineModel }) {
  const hasEvents = model.events.length > 0;
  const visibleMomentLimit = 18;
  const hiddenMomentCount = Math.max(0, model.events.length - visibleMomentLimit);
  const analyticsState = !hasEvents ? "empty" : model.events.some((event) => ["interview", "accepted", "scholarship_awarded", "completed"].includes(event.type)) ? "validated" : model.events.length < 3 ? "sparse" : "active";
  return <main className={styles.page} data-journey-timeline="" data-theme={model.theme} data-active-filter="everything" data-timeline-expanded="false">
    <JourneyAnalytics state={analyticsState} />
    <article className={styles.container}>
      <header className={styles.header}>
        <p>My story</p>
        <h1>Journey</h1>
        <h2>{model.story.title}</h2>
        <span>{model.story.description}</span>
        <span className={styles.srOnly}>A timeline of the opportunities and milestones that have shaped your progress.</span>
      </header>

      {hasEvents ? <>
        <ProgressSnapshot model={model} />
        <Highlights model={model} />
        <section className={styles.timelineSection} aria-labelledby="journey-timeline-heading">
          <header className={styles.timelineHeading}><p>Your timeline</p><h2 id="journey-timeline-heading">The story so far.</h2></header>
          <JourneyTimelineFilters counts={model.filterCounts} initiallyCollapsed={hiddenMomentCount > 0} />
        <ol className={styles.timeline} aria-label="Journey events in chronological order">
          {model.events.map((event, index) => {
            const month = formatMonth(event.occurredAt);
            const priorMonth = index > 0 ? formatMonth(model.events[index - 1].occurredAt) : "";
            const initiallyHidden = index < hiddenMomentCount;
            return <TimelineEvent key={event.id} event={event} theme={model.theme} chapter={month !== priorMonth || index === hiddenMomentCount ? month : undefined} initiallyHidden={initiallyHidden} />;
          })}
        </ol>
        </section>
        <section className={styles.share} aria-labelledby="journey-card-heading">
          <div><p>{model.card.periodTitle}</p><h2 id="journey-card-heading">Your progress, ready to keep.</h2><span>Create a polished Journey Card. Nothing is shared until you choose to share it.</span></div>
          <JourneyCardEntry card={model.card} theme={model.theme} />
        </section>
      </> : <section className={styles.empty} aria-labelledby="journey-empty-heading">
        <EmptyJourneyArtwork />
        <p className={styles.emptyEyebrow}>Your story is ready</p>
        <h2 id="journey-empty-heading">Your Journey starts here</h2>
        <p>Your Journey begins with a single opportunity. Add one from Discover and its story will grow here.</p>
        <Link href="/opportunities">Browse Discover <ArrowIcon /></Link>
      </section>}
    </article>
  </main>;
}

export function JourneyTimelineUnavailable() {
  return <main className={styles.page}><article className={styles.container}><section className={styles.empty} aria-labelledby="journey-error-heading"><h1 id="journey-error-heading">Your Journey is still here.</h1><p>We couldn’t prepare the latest timeline. Your saved opportunities and progress have not changed.</p><a href="/">Try again <ArrowIcon /></a></section></article></main>;
}
