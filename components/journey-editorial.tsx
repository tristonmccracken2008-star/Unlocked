import Link from "next/link";
import type { CSSProperties } from "react";
import { OPEN_LINE_MOTION } from "@/data/open-line/motion";
import type { NarrativeStoryType } from "@/data/open-line/types";
import type { JourneyEditorialHistoryChapter, JourneyEditorialHistoryItem, JourneyEditorialHorizonItem, JourneyEditorialModel } from "@/lib/journey-editorial";
import { OpenLineEventGlyph, type OpenLineEventGlyphType } from "@/components/open-line/open-line-event-glyphs";
import { JourneyTransitionControl } from "@/components/journey-transition-control";
import { JourneyAnalytics } from "@/components/journey-analytics";
import { PathMomentEntry } from "@/components/path-moment-entry";
import { SemesterStoryEntry } from "@/components/semester-story-entry";
import { ArrowIcon } from "@/components/icons";
import styles from "./journey-editorial.module.css";

type JourneyEditorialProps = {
  model: JourneyEditorialModel;
  showDiagnostics?: boolean;
};

const stageCopy: Record<JourneyEditorialModel["state"], { label: string; description: string }> = {
  empty: { label: "Ready to begin", description: "Your first meaningful choice will give your Journey a direction." },
  sparse: { label: "Choosing a direction", description: "You have something worth exploring. The next step is deciding whether to pursue it." },
  active: { label: "Building momentum", description: "You are turning possibilities into real work." },
  validated: { label: "Gaining real experience", description: "Your actions are becoming evidence you can carry forward." },
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

function flattenChapters(chapters: JourneyEditorialHistoryChapter[]) {
  return chapters.flatMap((chapter) => chapter.moments);
}

function latestMoment(model: JourneyEditorialModel) {
  return flattenChapters(model.history.recentChapters).at(-1);
}

function progressSummary(count: number) {
  if (count === 0) return "Your first meaningful step will appear here.";
  if (count === 1) return "One meaningful step is now part of your story.";
  return `${count} meaningful moments now show how far you have come.`;
}

function glyphForStory(storyType: NarrativeStoryType): OpenLineEventGlyphType | null {
  if (storyType === "action" || storyType === "commitment") return "application";
  if (storyType === "validation") return "interview";
  if (storyType === "acceptance") return "completion";
  if (storyType === "experience") return "experience";
  if (storyType === "skill") return "skill";
  return null;
}

function momentMeaning(item: JourneyEditorialHistoryItem) {
  if (item.storyType === "validation") return "External validation moment";
  if (item.storyType === "acceptance") return "Accepted opportunity moment";
  if (item.storyType === "experience") return "Completed experience moment";
  if (item.storyType === "commitment") return "Commitment moment";
  if (item.storyType === "action") return "Action moment";
  if (item.storyType === "skill") return "Skill-building moment";
  return "Journey moment";
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
            <span className={styles.srOnly}>{momentMeaning(item)}. </span>
            <time dateTime={item.occurredAt ?? undefined}>{formatDate(item.occurredAt)}</time>
            {item.category ? <span>{item.category}</span> : null}
          </span>
          <h3 className={styles.momentTitle}><span className={styles.srOnly}>Open details for </span>{item.title}</h3>
          <span className={styles.momentBody}>{item.body}</span>
          <span className={styles.detailHint} aria-hidden="true"><span className={styles.detailClosed}>See what changed</span><span className={styles.detailOpen}>Hide details</span><span className={styles.detailArrow}>↓</span></span>
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

function NextStep({ model }: { model: JourneyEditorialModel }) {
  if (model.empty || !model.waypoint) return <section className={styles.nextStep} aria-labelledby="journey-next-step-title" data-journey-next-action="">
    <p className={styles.stepLabel}>Your next step</p>
    <h2 id="journey-next-step-title">Find one opportunity worth pursuing.</h2>
    <p>Add it to your Journey when it feels worth a closer look.</p>
    <Link href="/opportunities" className={styles.primaryAction}>Find my first opportunity <ArrowIcon /></Link>
  </section>;

  return <section className={styles.nextStep} aria-labelledby="journey-next-step-title" data-journey-next-action="">
    <p className={styles.stepLabel}>Your next step</p>
    <h2 id="journey-next-step-title">{model.waypoint.title}</h2>
    <p>{model.waypoint.whyItMatters}</p>
    <div className={styles.stepSignals} aria-label="Next step details">
      <span>{formatEffort(model.waypoint.estimatedMinutes)}</span>
      <span>{model.waypoint.impact} impact</span>
    </div>
    {model.transitionControl ? <JourneyTransitionControl control={model.transitionControl} /> : <Link href={model.waypoint.cta.href} className={styles.primaryAction} data-journey-analytics="waypoint" data-journey-source={model.waypoint.source}>{model.waypoint.cta.label} <ArrowIcon /></Link>}
    <details className={styles.disclosure} data-journey-waypoint-detail="">
      <summary>Why this step</summary>
      <p>{model.waypoint.source === "journey"
        ? "This follows the latest confirmed status in your Journey."
        : `This fits your ${model.identity.at(-1)?.toLowerCase() ?? "current"} stage and has not been marked complete.`}</p>
    </details>
    {!model.transitionControl ? <Link href="/my-opportunities" className={styles.manageApplicationsLink} data-journey-analytics="application-management">Manage applications <ArrowIcon /></Link> : null}
  </section>;
}

function LivingPath({ model }: { model: JourneyEditorialModel }) {
  const latest = latestMoment(model);
  const stage = stageCopy[model.state];
  const pastLabel = latest?.title ?? (model.empty ? "Your story begins here" : "You chose a direction");
  return <div className={styles.livingPath} aria-label="Where you have been, where you are, and what comes next" data-journey-living-path="">
    <div className={styles.pathConnection} aria-hidden="true" />
    <div className={styles.pathPoint} data-path-position="past">
      <span className={styles.pathMarker} aria-hidden="true">✓</span>
      <div><p>Behind you</p><strong>{pastLabel}</strong></div>
    </div>
    <div className={styles.pathPoint} data-path-position="current">
      <span className={styles.pathMarker} aria-hidden="true" />
      <div><p>Where you are</p><strong>{stage.label}</strong><span>{stage.description}</span></div>
    </div>
    <div className={styles.pathPoint} data-path-position="next">
      <span className={styles.pathMarker} aria-hidden="true" />
      <div><p>What comes next</p><strong>{model.waypoint?.title ?? "Choose your first opportunity"}</strong></div>
    </div>
  </div>;
}

function JourneyFocus({ model }: { model: JourneyEditorialModel }) {
  return <section className={styles.opening} aria-labelledby="journey-story-title" data-journey-focus="">
    <header className={styles.storyHeader}>
      <p className={styles.sectionLabel}>Your Journey</p>
      <h1 id="journey-story-title">{model.story.text}</h1>
      {model.identity.length ? <p className={styles.identity}>{model.identity.join(" · ")}</p> : null}
    </header>
    <div className={styles.focusLayout}>
      <div className={styles.orientation} data-journey-stage={model.state}>
        <p className={styles.orientationLabel}>Right now</p>
        <h2>{stageCopy[model.state].label}</h2>
        <p>{stageCopy[model.state].description}</p>
        <LivingPath model={model} />
        <p className={styles.progressSentence} data-journey-progress="">{progressSummary(model.history.totalMomentCount)}</p>
      </div>
      <NextStep model={model} />
    </div>
  </section>;
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
  if (!history.totalMomentCount) return null;
  const recentCount = flattenChapters(history.recentChapters).length;
  const earlierCount = history.totalMomentCount - recentCount;
  return <section className={styles.history} aria-labelledby="journey-history-title">
    <header className={styles.historyHeading}>
      <p className={styles.sectionLabel}>Proof of progress</p>
      <h2 id="journey-history-title">What you have made real.</h2>
      <p>Only meaningful actions and outcomes appear here.</p>
    </header>
    <div className={styles.storyFlow} aria-label="Your Journey moments in chronological order" data-journey-text-timeline="">
      {history.earlierChapters.length ? <details className={styles.earlierChapters} data-earlier-chapters="">
        <summary><span className={styles.earlierClosed}>See earlier chapters</span><span className={styles.earlierOpen}>Hide earlier chapters</span><span>{earlierCount} moments</span></summary>
        <div className={styles.earlierContent}><Chapters chapters={history.earlierChapters} theme={theme} /></div>
      </details> : null}
      <Chapters chapters={history.recentChapters} theme={theme} />
      {history.omittedMomentCount ? <p className={styles.omittedHistory}>{history.omittedMomentCount} older moments remain in application history.</p> : null}
    </div>
    {pathMoments.moments.length ? <div className={styles.shareMoment}>
      <div><p className={styles.sectionLabel}>A moment worth keeping</p><p>Create a private preview before deciding whether to share it.</p></div>
      <PathMomentEntry collection={pathMoments} theme={theme} />
    </div> : null}
  </section>;
}

function HorizonItem({ item, primary }: { item: JourneyEditorialHorizonItem; primary: boolean }) {
  return <li className={styles.horizonItem} data-horizon-item="" data-horizon-primary={primary ? "true" : "false"} data-horizon-source={item.source}>
    <article>
      <p className={styles.horizonOrder}>{primary ? "A direction taking shape" : "Another possibility"}</p>
      <h3>{item.title}</h3>
      <p className={styles.horizonExplanation}>{item.explanation}</p>
      <details className={styles.horizonDisclosure} data-horizon-detail="" name="journey-horizon-detail">
        <summary><span className={styles.horizonDetailClosed}>Why this may fit</span><span className={styles.horizonDetailOpen}>Hide details</span><span aria-hidden="true">↓</span></summary>
        <div className={styles.horizonDetail}>
          <p>{item.whyAvailable}</p>
          <dl>
            <div><dt>Approximate effort</dt><dd>{item.effort}</dd></div>
            <div><dt>Expected impact</dt><dd>{item.impact}</dd></div>
            {item.detail.requiredEvidence.length ? <div><dt>Preparation that helps</dt><dd>{item.detail.requiredEvidence.join(" · ")}</dd></div> : null}
            {item.detail.skills.length ? <div><dt>Skills involved</dt><dd>{item.detail.skills.join(" · ")}</dd></div> : null}
          </dl>
          <Link href={item.cta.href} className={styles.horizonAction}>{item.cta.label} <ArrowIcon /></Link>
        </div>
      </details>
    </article>
  </li>;
}

function Horizon({ horizon }: { horizon: JourneyEditorialModel["horizon"] }) {
  const [primary, secondary] = horizon.items;
  if (!primary) return null;
  return <section className={styles.horizon} aria-labelledby="journey-horizon-title" data-journey-horizon="" data-horizon-state={horizon.state}>
    <header className={styles.horizonHeading}>
      <p className={styles.sectionLabel}>A little farther ahead</p>
      <h2 id="journey-horizon-title">One direction that may open next.</h2>
      <p>A possibility supported by your current path, not a promise.</p>
    </header>
    <ol className={styles.horizonList} aria-label="Plausible future directions"><HorizonItem item={primary} primary /></ol>
    {secondary ? <details className={styles.additionalDirection} data-additional-horizon="">
      <summary>Consider another direction</summary>
      <ol className={styles.horizonList}><HorizonItem item={secondary} primary={false} /></ol>
    </details> : null}
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
    <span>Audit: {model.diagnostics.editorialAuditVersion}</span>
    <span>Suppressed: {model.diagnostics.suppressedClaimCount}</span>
  </aside>;
}

export function JourneyEditorial({ model, showDiagnostics = false }: JourneyEditorialProps) {
  const motionStyle = {
    "--journey-disclosure-duration": `${OPEN_LINE_MOTION.disclosure}ms`,
    "--journey-motion-easing": OPEN_LINE_MOTION.easing,
  } as CSSProperties;
  return <main className={`${styles.page} ${showDiagnostics ? styles.diagnosticGrid : ""}`} style={motionStyle} aria-labelledby="journey-story-title" data-journey-editorial="" data-journey-state={model.state}>
    <JourneyAnalytics state={model.state} serverProjectionMs={model.diagnostics.serverProjectionMs} />
    <article className={styles.article}>
      <JourneyFocus model={model} />
      <History history={model.history} theme={model.theme} pathMoments={model.pathMoments} />
      {model.horizon.items.length ? <Horizon horizon={model.horizon} /> : null}
      {model.semesterStories.stories.length ? <section className={styles.reflection} aria-label="Journey reflection"><SemesterStoryEntry collection={model.semesterStories} theme={model.theme} /></section> : null}
    </article>
    {showDiagnostics ? <Diagnostics model={model} /> : null}
  </main>;
}

export function JourneyEditorialUnavailable() {
  return <main className={styles.page} data-journey-editorial-error="">
    <article className={styles.article}>
      <section className={styles.unavailable} aria-labelledby="journey-unavailable-title">
        <p className={styles.sectionLabel}>Your Journey</p>
        <h1 id="journey-unavailable-title">Your progress is still here.</h1>
        <p>We could not prepare the latest view. Your saved opportunities and application progress have not changed.</p>
        <a href="/" className={styles.primaryAction}>Try again <ArrowIcon /></a>
        <Link href="/my-opportunities" className={styles.manageApplicationsLink}>Manage applications <ArrowIcon /></Link>
      </section>
    </article>
  </main>;
}
