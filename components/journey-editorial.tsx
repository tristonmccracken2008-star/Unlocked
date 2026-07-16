import Link from "next/link";
import type { CSSProperties } from "react";
import { OPEN_LINE_MOTION } from "@/data/open-line/motion";
import type { NarrativeStoryType } from "@/data/open-line/types";
import type { JourneyEditorialHistoryChapter, JourneyEditorialHistoryItem, JourneyEditorialHorizonItem, JourneyEditorialModel } from "@/lib/journey-editorial";
import { OpenLineEventGlyph, type OpenLineEventGlyphType } from "@/components/open-line/open-line-event-glyphs";
import { JourneyResponsiveLine } from "@/components/journey-live-line";
import { JourneyTransitionControl } from "@/components/journey-transition-control";
import { PathMomentCreator } from "@/components/path-moment-creator";
import { SemesterStoryEntry } from "@/components/semester-story-entry";
import { ArrowIcon } from "@/components/icons";
import styles from "./journey-editorial.module.css";

type JourneyEditorialProps = {
  model: JourneyEditorialModel;
  showDiagnostics?: boolean;
};

function formatEffort(minutes: number | undefined) {
  if (!minutes) return "A focused session";
  if (minutes < 60) return `About ${minutes} min`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `About ${hours} hr` : `About ${hours.toFixed(1)} hr`;
}

function formatDate(value: string | null) {
  if (!value) return "Your path";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function OpenLineComposition({ model, showDiagnostics }: { model: JourneyEditorialModel; showDiagnostics: boolean }) {
  const desktopWaypoint = model.geometries.desktop.waypointPosition;
  const waypointStyle = desktopWaypoint ? {
    "--waypoint-desktop-x": `${desktopWaypoint.xPercent}%`,
    "--waypoint-desktop-y": `${desktopWaypoint.yPercent}%`,
    "--waypoint-tablet-y": `${model.geometries.tablet.waypointPosition?.yPercent ?? desktopWaypoint.yPercent}%`,
    "--waypoint-mobile-y": `${model.geometries.mobile.waypointPosition?.yPercent ?? desktopWaypoint.yPercent}%`,
  } as CSSProperties : undefined;

  return <section className={styles.lineComposition} aria-labelledby={model.empty ? "journey-empty-title" : "journey-waypoint-title"}>
    <div className={styles.lineField} aria-hidden="true">
      <JourneyResponsiveLine geometries={model.geometries} theme={model.theme} empty={model.empty} showDiagnostics={showDiagnostics} />
    </div>

    {model.empty ? <div className={styles.emptyWaypoint}>
      <p className={styles.waypointLabel}>Your first step</p>
      <h2 id="journey-empty-title" className={styles.waypointTitle}>Find one opportunity worth pursuing.</h2>
      <p className={styles.waypointWhy}>Add it to your Journey when it feels worth a closer look.</p>
      <Link href="/opportunities" className={styles.primaryAction}>Find my first opportunity <ArrowIcon /></Link>
    </div> : model.waypoint ? <div className={styles.waypoint} style={waypointStyle}>
      <p className={styles.waypointLabel}>What matters now</p>
      <h2 id="journey-waypoint-title" className={styles.waypointTitle}>{model.waypoint.title}</h2>
      <p className={styles.waypointWhy}>{model.waypoint.whyItMatters}</p>
      <dl className={styles.waypointMeta}>
        <div><dt>Estimated effort</dt><dd>{formatEffort(model.waypoint.estimatedMinutes)}</dd></div>
        <div><dt>Expected impact</dt><dd>{model.waypoint.impact}</dd></div>
      </dl>
      {model.transitionControl ? <JourneyTransitionControl control={model.transitionControl} /> : <Link href={model.waypoint.cta.href} className={styles.primaryAction}>{model.waypoint.cta.label} <ArrowIcon /></Link>}
      <details className={styles.disclosure}>
        <summary>See why this matters</summary>
        <p>{model.waypoint.source === "journey"
          ? "This action follows the latest confirmed status in your Journey."
          : `This step fits your ${model.identity.at(-1)?.toLowerCase() ?? "current"} stage and has not been marked complete.`}</p>
      </details>
      {!model.transitionControl ? <Link href="/my-opportunities" className={styles.manageApplicationsLink}>Manage applications <ArrowIcon /></Link> : null}
    </div> : null}
  </section>;
}

function glyphForStory(storyType: NarrativeStoryType): OpenLineEventGlyphType | null {
  if (storyType === "action" || storyType === "commitment") return "application";
  if (storyType === "validation") return "interview";
  if (storyType === "acceptance") return "completion";
  if (storyType === "experience") return "experience";
  if (storyType === "skill") return "skill";
  return null;
}

function MomentMarker({ item, theme }: { item: JourneyEditorialHistoryItem; theme: JourneyEditorialModel["theme"] }) {
  const glyph = glyphForStory(item.storyType);
  return <span className={styles.momentMarker} aria-hidden="true">
    {glyph ? <OpenLineEventGlyph type={glyph} theme={theme} size={item.weight === "landmark" ? 20 : 16} decorative /> : <span className={styles.momentCenter} />}
  </span>;
}

function Moment({ item, theme }: { item: JourneyEditorialHistoryItem; theme: JourneyEditorialModel["theme"] }) {
  return <li className={styles.moment} data-moment-weight={item.weight} data-moment-kind={item.storyType}>
    <details className={styles.momentDisclosure} data-journey-moment="" name="journey-moment-detail">
      <summary className={styles.momentSummary}>
        <MomentMarker item={item} theme={theme} />
        <span className={styles.momentEditorial}>
          <span className={styles.momentMeta}>
            <time dateTime={item.occurredAt ?? undefined}>{formatDate(item.occurredAt)}</time>
            {item.category ? <span>{item.category}</span> : null}
          </span>
          <h4 className={styles.momentTitle}><span className={styles.srOnly}>Open details for </span>{item.title}</h4>
          <span className={styles.momentBody}>{item.body}</span>
          <span className={styles.detailHint} aria-hidden="true"><span className={styles.detailClosed}>View what changed</span><span className={styles.detailOpen}>Hide details</span><span className={styles.detailArrow}>↓</span></span>
        </span>
      </summary>
      <div className={styles.momentDetail}>
        <dl>
          <div><dt>Why it mattered</dt><dd>{item.detail.whyItMattered}</dd></div>
          <div><dt>What changed</dt><dd>{item.detail.whatChanged}</dd></div>
          {item.detail.skillsGained.length ? <div><dt>Evidence from this moment</dt><dd>{item.detail.skillsGained.join(" · ")}</dd></div> : null}
          <div><dt>What this opens next</dt><dd>{item.detail.nextConsequence}</dd></div>
        </dl>
        {item.detail.relatedOpportunity ? <Link href={`/opportunities/${item.detail.relatedOpportunity.id}`} className={styles.relatedOpportunity}>View {item.detail.relatedOpportunity.title} <ArrowIcon /></Link> : null}
      </div>
    </details>
  </li>;
}

function Chapters({ chapters, theme }: { chapters: JourneyEditorialHistoryChapter[]; theme: JourneyEditorialModel["theme"] }) {
  return <>{chapters.map((chapter) => <section key={chapter.id} className={styles.chapter} aria-labelledby={`${chapter.id}-title`}>
    <h3 id={`${chapter.id}-title`} className={styles.chapterTitle}>{chapter.title}</h3>
    <ol className={styles.momentList}>
      {chapter.moments.map((item) => <Moment key={item.id} item={item} theme={theme} />)}
    </ol>
  </section>)}</>;
}

function History({ history, theme, pathMoments }: { history: JourneyEditorialModel["history"]; theme: JourneyEditorialModel["theme"]; pathMoments: JourneyEditorialModel["pathMoments"] }) {
  const hasMoments = history.totalMomentCount > 0;
  return <section className={styles.history} aria-labelledby="journey-history-title">
    <div className={styles.historyHeading}>
      <p className={styles.sectionLabel}>Story so far</p>
      <h2 id="journey-history-title">The moments that shaped your path.</h2>
      <p>{history.state === "first_moment" ? "One real step is enough to begin." : "Only actions and outcomes supported by your Journey appear here."}</p>
      {pathMoments.moments.length ? <div className={styles.pathMomentAction}><PathMomentCreator collection={pathMoments} theme={theme} /></div> : null}
    </div>
    {hasMoments ? <div className={styles.storyFlow} aria-label="Your Journey moments in chronological order">
      {history.earlierChapters.length ? <details className={styles.earlierChapters} data-earlier-chapters="">
        <summary><span className={styles.earlierClosed}>See earlier moments</span><span className={styles.earlierOpen}>Hide earlier moments</span><span>{history.totalMomentCount - history.recentChapters.reduce((count, chapter) => count + chapter.moments.length, 0)} moments</span></summary>
        <div className={styles.earlierContent}><Chapters chapters={history.earlierChapters} theme={theme} /></div>
      </details> : null}
      <Chapters chapters={history.recentChapters} theme={theme} />
      {history.omittedMomentCount ? <p className={styles.omittedHistory}>{history.omittedMomentCount} older moments remain in application history.</p> : null}
    </div> : <div className={styles.historyEmpty}>
      <span className={styles.emptyStoryMarker} aria-hidden="true" />
      <p>The first meaningful step you take will appear here.</p>
    </div>}
  </section>;
}

function HorizonItem({ item, primary }: { item: JourneyEditorialHorizonItem; primary: boolean }) {
  return <li className={styles.horizonItem} data-horizon-item="" data-horizon-primary={primary ? "true" : "false"} data-horizon-source={item.source}>
    <article>
      <p className={styles.horizonOrder}>{primary ? "A direction taking shape" : "Another direction"}</p>
      <h3>{item.title}</h3>
      <p className={styles.horizonExplanation}>{item.explanation}</p>
      <p className={styles.horizonReason}>{item.whyAvailable}</p>
      <details className={styles.horizonDisclosure} data-horizon-detail="" name="journey-horizon-detail">
        <summary><span className={styles.horizonDetailClosed}>See why this may fit</span><span className={styles.horizonDetailOpen}>Hide details</span><span aria-hidden="true">↓</span></summary>
        <div className={styles.horizonDetail}>
          <dl>
            <div><dt>Approximate effort</dt><dd>{item.effort}</dd></div>
            <div><dt>Expected impact</dt><dd>{item.impact}</dd></div>
            {item.detail.requiredEvidence.length ? <div><dt>Preparation that helps</dt><dd>{item.detail.requiredEvidence.join(" · ")}</dd></div> : null}
            {item.detail.skills.length ? <div><dt>Skills involved</dt><dd>{item.detail.skills.join(" · ")}</dd></div> : null}
            <div><dt>Expected preparation</dt><dd>{item.detail.expectedPreparation}</dd></div>
          </dl>
          <Link href={item.cta.href} className={styles.horizonAction}>{item.cta.label} <ArrowIcon /></Link>
        </div>
      </details>
    </article>
  </li>;
}

function Horizon({ horizon }: { horizon: JourneyEditorialModel["horizon"] }) {
  const hasPossibilities = horizon.items.length > 0;
  const [primary, secondary] = horizon.items;
  return <section className={styles.horizon} aria-labelledby="journey-horizon-title" data-journey-horizon="" data-horizon-state={horizon.state}>
    <header className={styles.horizonHeading}>
      <p className={styles.sectionLabel}>On the horizon</p>
      <h2 id="journey-horizon-title">What may open next.</h2>
      <p>These are possibilities supported by your current path, not promises.</p>
    </header>
    <div className={styles.horizonComposition}>
      <span className={styles.horizonOpenEnd} aria-hidden="true" />
      {hasPossibilities && primary ? <div className={styles.horizonContent}>
        <ol className={styles.horizonList} aria-label="Plausible future directions">
          <HorizonItem item={primary} primary />
        </ol>
        {secondary ? <details className={styles.additionalDirection} data-additional-horizon="">
          <summary>Explore another direction</summary>
          <ol className={styles.horizonList}><HorizonItem item={secondary} primary={false} /></ol>
        </details> : null}
      </div> : null}
    </div>
  </section>;
}

function Diagnostics({ model }: { model: JourneyEditorialModel }) {
  return <aside className={styles.diagnostics} aria-label="Journey editorial diagnostics">
    <strong>Editorial diagnostics</strong>
    <span>Narrative: {model.diagnostics.narrativeSource}</span>
    <span>Waypoint: {model.diagnostics.waypointSource}</span>
    <span>Events: {model.diagnostics.sourceEventCount}</span>
    <span>Path: {model.diagnostics.pathprintSignature.slice(0, 10)}</span>
    <span>Future: {model.diagnostics.horizonSources.join(", ") || "none"}</span>
    <span>Branch: {model.diagnostics.horizonBranchSource}</span>
    <span>Evidence: {model.diagnostics.horizonEvidenceSource.join(", ") || "none"}</span>
    <span>Audit: {model.diagnostics.editorialAuditVersion}</span>
    <span>Suppressed: {model.diagnostics.suppressedClaimCount}</span>
    <span>Semester term: {model.semesterStories.diagnostics.selectedTermId ?? "none"}</span>
    <span>Semester calendar: {model.semesterStories.diagnostics.calendarSource}</span>
    <span>Semester evidence: {model.semesterStories.diagnostics.includedEventCount}</span>
    <span>Semester signature: {model.semesterStories.diagnostics.deterministicSignature.slice(0, 10)}</span>
  </aside>;
}

export function JourneyEditorial({ model, showDiagnostics = false }: JourneyEditorialProps) {
  const motionStyle = {
    "--journey-disclosure-duration": `${OPEN_LINE_MOTION.disclosure}ms`,
    "--journey-motion-easing": OPEN_LINE_MOTION.easing,
  } as CSSProperties;
  return <main className={`${styles.page} ${showDiagnostics ? styles.diagnosticGrid : ""}`} style={motionStyle} data-journey-editorial="" data-journey-state={model.state}>
    <article className={styles.article}>
      <section className={styles.opening}>
        <header className={styles.storyHeader}>
          <p className={styles.sectionLabel}>Your Journey</p>
          <h1>{model.story.text}</h1>
          {model.identity.length ? <p className={styles.identity}>{model.identity.join(" · ")}</p> : null}
        </header>
        <OpenLineComposition model={model} showDiagnostics={showDiagnostics} />
      </section>
      {model.history.totalMomentCount ? <History history={model.history} theme={model.theme} pathMoments={model.pathMoments} /> : null}
      {!model.pathMoments.moments.length ? <p className={styles.pathMomentEmpty}>You’ll unlock your first Path Moment after a meaningful milestone.</p> : null}
      {!model.history.totalMomentCount && model.pathMoments.moments.length ? <section className={styles.pathMomentStandalone} aria-label="Path Moments"><PathMomentCreator collection={model.pathMoments} theme={model.theme} /></section> : null}
      {model.semesterStories.stories.length ? <SemesterStoryEntry collection={model.semesterStories} theme={model.theme} /> : null}
      {model.horizon.items.length ? <Horizon horizon={model.horizon} /> : null}
    </article>
    {showDiagnostics ? <Diagnostics model={model} /> : null}
  </main>;
}

export function JourneyEditorialUnavailable() {
  return <main className={styles.page} data-journey-editorial-error="">
    <article className={styles.article}>
      <section className={styles.unavailable} aria-labelledby="journey-unavailable-title">
        <p className={styles.sectionLabel}>Your Journey</p>
        <h1 id="journey-unavailable-title">Your path is still here.</h1>
        <p>We couldn’t prepare the latest view of it. Your saved applications and progress have not changed.</p>
        <a href="/" className={styles.primaryAction}>Try again <ArrowIcon /></a>
        <Link href="/my-opportunities" className={styles.manageApplicationsLink}>Manage applications <ArrowIcon /></Link>
      </section>
    </article>
  </main>;
}
