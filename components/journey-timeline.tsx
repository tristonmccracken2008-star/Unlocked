import Link from "next/link";
import type { ComponentType } from "react";
import type { JourneyTimelineEvent, JourneyTimelineEventType, JourneyTimelineModel } from "@/lib/journey-timeline";
import { ArrowIcon, BookmarkIcon, CheckCircleIcon, HeartIcon, PenLineIcon, SendIcon, TargetIcon, TrophyIcon, XCircleIcon } from "@/components/icons";
import { OrganizationLogo } from "@/components/organization-logo";
import { JourneyTimelineControl } from "@/components/journey-timeline-control";
import { JourneyCardEntry } from "@/components/journey-card-entry";
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

function statusLabel(status: JourneyTimelineEvent["status"]) {
  if (status === "Interview") return "Interviewing";
  if (status === "Rejected") return "Closed";
  return status;
}

function TimelineEvent({ event, theme }: { event: JourneyTimelineEvent; theme: JourneyTimelineModel["theme"] }) {
  const Icon = eventIcons[event.type];
  const important = ["interview", "accepted", "scholarship_awarded", "completed", "milestone"].includes(event.type);
  return <li className={styles.event} data-event-type={event.type} data-event-emphasis={important ? "strong" : "standard"}>
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
      {event.control ? <JourneyTimelineControl control={event.control} /> : null}
    </article>
  </li>;
}

export function JourneyTimeline({ model }: { model: JourneyTimelineModel }) {
  const hasEvents = model.events.length > 0;
  return <main className={styles.page} data-journey-timeline="" data-theme={model.theme}>
    <article className={styles.container}>
      <header className={styles.header}>
        <h1>Journey</h1>
        <span>A timeline of the opportunities and milestones that have shaped your progress.</span>
      </header>

      {hasEvents ? <>
        <ol className={styles.timeline} aria-label="Journey events in chronological order">
          {model.events.map((event) => <TimelineEvent key={event.id} event={event} theme={model.theme} />)}
        </ol>
        <section className={styles.share} aria-labelledby="journey-card-heading">
          <div><p>Journey Card</p><h2 id="journey-card-heading">Keep or share a snapshot of your progress.</h2><span>Only the details visible in your preview are included.</span></div>
          <JourneyCardEntry card={model.card} theme={model.theme} />
        </section>
      </> : <section className={styles.empty} aria-labelledby="journey-empty-heading">
        <span className={styles.emptyMark} aria-hidden="true"><BookmarkIcon /></span>
        <h2 id="journey-empty-heading">Your Journey starts here</h2>
        <p>Save opportunities, track applications, and record meaningful milestones. They’ll appear here as your story grows.</p>
        <Link href="/opportunities">Browse Discover <ArrowIcon /></Link>
      </section>}
    </article>
  </main>;
}

export function JourneyTimelineUnavailable() {
  return <main className={styles.page}><article className={styles.container}><section className={styles.empty} aria-labelledby="journey-error-heading"><h1 id="journey-error-heading">Your Journey is still here.</h1><p>We couldn’t prepare the latest timeline. Your saved opportunities and progress have not changed.</p><a href="/">Try again <ArrowIcon /></a></section></article></main>;
}
