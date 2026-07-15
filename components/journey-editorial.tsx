import Link from "next/link";
import type { CSSProperties } from "react";
import { OPEN_LINE_MOTION } from "@/data/open-line/motion";
import type { NarrativeStoryType } from "@/data/open-line/types";
import type { JourneyEditorialGeometry, JourneyEditorialHistoryChapter, JourneyEditorialHistoryItem, JourneyEditorialModel } from "@/lib/journey-editorial";
import { OpenLineEventGlyph, type OpenLineEventGlyphType } from "@/components/open-line/open-line-event-glyphs";
import { OpenLineMotionRenderer } from "@/components/open-line/open-line-motion-renderer";
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

function LineVariant({
  presentation,
  className,
  idPrefix,
  theme,
  empty,
  showDiagnostics,
}: {
  presentation: JourneyEditorialGeometry;
  className: string;
  idPrefix: string;
  theme: JourneyEditorialModel["theme"];
  empty: boolean;
  showDiagnostics: boolean;
}) {
  return <div className={className} aria-hidden="true">
    <OpenLineMotionRenderer
      geometry={presentation.geometry}
      viewport={presentation.viewport}
      motionContext={{ cause: empty ? "first_journey_creation" : "normal_revisit", preference: "system", allowDeveloperReplay: showDiagnostics }}
      theme={theme}
      background="transparent"
      quality="high"
      interactive={false}
      showLabels={false}
      showFuture={!empty}
      showBranches={!empty}
      showDiagnostics={showDiagnostics}
      decorativeMarkers
      title={empty ? "The beginning of your Open Line" : "Your current Open Line"}
      description={empty ? "An Origin marker begins an open path." : "Your completed steps lead to the current waypoint and future possibilities."}
      idPrefix={idPrefix}
    />
  </div>;
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
    <div className={styles.lineField}>
      <LineVariant presentation={model.geometries.desktop} className={styles.desktopLine} idPrefix="journey-editorial-desktop" theme={model.theme} empty={model.empty} showDiagnostics={showDiagnostics} />
      <LineVariant presentation={model.geometries.tablet} className={styles.tabletLine} idPrefix="journey-editorial-tablet" theme={model.theme} empty={model.empty} showDiagnostics={showDiagnostics} />
      <LineVariant presentation={model.geometries.mobile} className={styles.mobileLine} idPrefix="journey-editorial-mobile" theme={model.theme} empty={model.empty} showDiagnostics={showDiagnostics} />
    </div>

    {model.empty ? <div className={styles.emptyWaypoint}>
      <p className={styles.waypointLabel}>Origin</p>
      <h2 id="journey-empty-title" className={styles.waypointTitle}>Choose one opportunity worth pursuing.</h2>
      <p className={styles.waypointWhy}>Your Journey begins when you decide one opportunity is worth keeping close.</p>
      <Link href="/opportunities" className={styles.primaryAction}>Find my first opportunity <ArrowIcon /></Link>
    </div> : model.waypoint ? <div className={styles.waypoint} style={waypointStyle}>
      <p className={styles.waypointLabel}>What matters now</p>
      <h2 id="journey-waypoint-title" className={styles.waypointTitle}>{model.waypoint.title}</h2>
      <p className={styles.waypointWhy}>{model.waypoint.whyItMatters}</p>
      <dl className={styles.waypointMeta}>
        <div><dt>Estimated effort</dt><dd>{formatEffort(model.waypoint.estimatedMinutes)}</dd></div>
        <div><dt>Expected impact</dt><dd>{model.waypoint.impact}</dd></div>
      </dl>
      <Link href={model.waypoint.cta.href} className={styles.primaryAction}>{model.waypoint.cta.label} <ArrowIcon /></Link>
      <details className={styles.disclosure}>
        <summary>Why this step</summary>
        <p>{model.waypoint.whyItMatters}</p>
        <p className={styles.disclosureSource}>Chosen from your {model.waypoint.source === "roadmap" ? "roadmap" : "advisor recommendations"} and current stage.</p>
      </details>
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
    <details className={styles.momentDisclosure} data-journey-moment="">
      <summary className={styles.momentSummary}>
        <MomentMarker item={item} theme={theme} />
        <span className={styles.momentEditorial}>
          <span className={styles.momentMeta}>
            <time dateTime={item.occurredAt ?? undefined}>{formatDate(item.occurredAt)}</time>
            {item.category ? <span>{item.category}</span> : null}
          </span>
          <h4 className={styles.momentTitle}><span className={styles.srOnly}>Open details for </span>{item.title}</h4>
          <span className={styles.momentBody}>{item.body}</span>
          <span className={styles.detailHint} aria-hidden="true"><span className={styles.detailClosed}>Read this moment</span><span className={styles.detailOpen}>Close this moment</span><span className={styles.detailArrow}>↓</span></span>
        </span>
      </summary>
      <div className={styles.momentDetail}>
        <dl>
          <div><dt>Why it mattered</dt><dd>{item.detail.whyItMattered}</dd></div>
          <div><dt>What changed</dt><dd>{item.detail.whatChanged}</dd></div>
          <div><dt>Skills gained</dt><dd>{item.detail.skillsGained.length ? item.detail.skillsGained.join(" · ") : "No specific skill evidence is attached to this moment yet."}</dd></div>
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

function History({ history, theme }: { history: JourneyEditorialModel["history"]; theme: JourneyEditorialModel["theme"] }) {
  const hasMoments = history.totalMomentCount > 0;
  return <section className={styles.history} aria-labelledby="journey-history-title">
    <div className={styles.historyHeading}>
      <p className={styles.sectionLabel}>Your living story</p>
      <h2 id="journey-history-title">The moments that moved you forward.</h2>
      <p>{history.state === "exploration"
        ? "Your story is just beginning. The options you explore now give your next choice context."
        : history.state === "first_moment"
          ? "One meaningful step is enough to begin."
          : hasMoments ? "Not every click belongs here. Only the choices and outcomes that changed your path." : "Your story is just beginning."}</p>
    </div>
    {hasMoments ? <div className={styles.storyFlow} aria-label="Your Journey moments in chronological order">
      {history.earlierChapters.length ? <details className={styles.earlierChapters} data-earlier-chapters="">
        <summary><span className={styles.earlierClosed}>See earlier chapters</span><span className={styles.earlierOpen}>Hide earlier chapters</span><span>{history.totalMomentCount - history.recentChapters.reduce((count, chapter) => count + chapter.moments.length, 0)} moments</span></summary>
        <div className={styles.earlierContent}><Chapters chapters={history.earlierChapters} theme={theme} /></div>
      </details> : null}
      <Chapters chapters={history.recentChapters} theme={theme} />
    </div> : <div className={styles.historyEmpty}>
      <span className={styles.emptyStoryMarker} aria-hidden="true" />
      <p>The first meaningful step you take will appear here.</p>
    </div>}
    <details className={styles.toolsDisclosure}>
      <summary>Journey tools</summary>
      <p>Application status and saved opportunities stay in your private Journey Board.</p>
      <Link href="/my-opportunities">Open Journey Board <ArrowIcon /></Link>
    </details>
  </section>;
}

function Diagnostics({ model }: { model: JourneyEditorialModel }) {
  return <aside className={styles.diagnostics} aria-label="Journey editorial diagnostics">
    <strong>Editorial diagnostics</strong>
    <span>Narrative: {model.diagnostics.narrativeSource}</span>
    <span>Waypoint: {model.diagnostics.waypointSource}</span>
    <span>Events: {model.diagnostics.sourceEventCount}</span>
    <span>Path: {model.diagnostics.pathprintSignature.slice(0, 10)}</span>
  </aside>;
}

export function JourneyEditorial({ model, showDiagnostics = false }: JourneyEditorialProps) {
  const motionStyle = {
    "--journey-disclosure-duration": `${OPEN_LINE_MOTION.disclosure}ms`,
    "--journey-motion-easing": OPEN_LINE_MOTION.easing,
  } as CSSProperties;
  return <main className={`${styles.page} ${showDiagnostics ? styles.diagnosticGrid : ""}`} style={motionStyle} data-journey-editorial="" data-journey-state={model.empty ? "empty" : "populated"}>
    <article className={styles.article}>
      <section className={styles.opening}>
        <header className={styles.storyHeader}>
          <p className={styles.sectionLabel}>Your Journey</p>
          <h1>{model.story.text}</h1>
          {model.identity.length ? <p className={styles.identity}>{model.identity.join(" · ")}</p> : null}
        </header>
        <OpenLineComposition model={model} showDiagnostics={showDiagnostics} />
      </section>
      <History history={model.history} theme={model.theme} />
    </article>
    {showDiagnostics ? <Diagnostics model={model} /> : null}
  </main>;
}
