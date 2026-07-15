import Link from "next/link";
import type { CSSProperties } from "react";
import type { JourneyEditorialGeometry, JourneyEditorialModel } from "@/lib/journey-editorial";
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

function History({ items }: { items: JourneyEditorialModel["history"] }) {
  return <section className={styles.history} aria-labelledby="journey-history-title">
    <div className={styles.historyHeading}>
      <p className={styles.sectionLabel}>The path behind you</p>
      <h2 id="journey-history-title">Your story so far.</h2>
    </div>
    {items.length ? <ol className={styles.historyList}>
      {items.map((item) => <li key={item.id}>
        <time dateTime={item.occurredAt ?? undefined}>{formatDate(item.occurredAt)}</time>
        <div><h3>{item.title}</h3><p>{item.body}</p></div>
      </li>)}
    </ol> : <p className={styles.historyEmpty}>The first meaningful step you take will appear here.</p>}
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
  return <main className={`${styles.page} ${showDiagnostics ? styles.diagnosticGrid : ""}`} data-journey-editorial="" data-journey-state={model.empty ? "empty" : "populated"}>
    <article className={styles.article}>
      <section className={styles.opening}>
        <header className={styles.storyHeader}>
          <p className={styles.sectionLabel}>Your Journey</p>
          <h1>{model.story.text}</h1>
          {model.identity.length ? <p className={styles.identity}>{model.identity.join(" · ")}</p> : null}
        </header>
        <OpenLineComposition model={model} showDiagnostics={showDiagnostics} />
      </section>
      <History items={model.history} />
    </article>
    {showDiagnostics ? <Diagnostics model={model} /> : null}
  </main>;
}
