import Link from "next/link";
import type { OpportunityPathView, OpportunityPathsLandingModel, PathOpportunityView } from "@/lib/opportunity-paths";
import { ArrowIcon, BookmarkIcon, CheckIcon, SearchIcon, SparkIcon, TrophyIcon } from "./icons";
import { OrganizationMark } from "./organization-logo";
import { PathAnalytics, PathDiscoverLink, PathFollowButton, PathOpportunityActions, PathOpportunityLink } from "./opportunity-path-actions";
import styles from "./opportunity-paths.module.css";
import { PathsGuidance } from "./contextual-guidance";
import type { GuidanceState } from "@/lib/guidance";

function countLabel(count: number) {
  return `${count} current ${count === 1 ? "opportunity" : "opportunities"}`;
}

function PathRow({ path, label }: { path: OpportunityPathView; label?: string }) {
  return <Link href={`/paths/${path.id}`} className={styles.pathRow}>
    <span className={styles.pathIndex} aria-hidden="true"><SparkIcon /></span>
    <span className={styles.pathCopy}><span className={styles.pathMeta}>{label ?? countLabel(path.currentCount)}</span><strong>{path.name}</strong><span>{path.description}</span></span>
    <span className={styles.pathActivity}>{path.completedCount ? `${path.completedCount} completed` : path.journeyCount ? `${path.journeyCount} in Journey` : path.watchingCount ? `${path.watchingCount} watching` : "Explore"}</span>
    <ArrowIcon className={styles.arrow} />
  </Link>;
}

export function OpportunityPathsLanding({ model, guidance }: { model: OpportunityPathsLandingModel; guidance: GuidanceState }) {
  return <main className={styles.page} data-opportunity-paths>
    <div className={styles.shell}>
      <header className={styles.landingHeader}>
        <p className={styles.eyebrow}>Opportunity Paths</p>
        <h1>See how opportunities connect.</h1>
        <p>Explore real opportunities around a direction or interest. Paths show possibilities; Journey holds only what you choose to pursue.</p>
      </header>
      <PathsGuidance initialState={guidance} />

      {model.followed.length ? <section className={styles.pathGroup} aria-labelledby="followed-paths">
        <div className={styles.groupHeading}><p>Your paths</p><h2 id="followed-paths">Easy to return to</h2></div>
        <div>{model.followed.map((path) => <PathRow key={path.id} path={path} label="Following" />)}</div>
      </section> : null}

      {model.related.length ? <section className={styles.pathGroup} aria-labelledby="related-paths">
        <div className={styles.groupHeading}><p>From your profile</p><h2 id="related-paths">Directions connected to your interests</h2></div>
        <div>{model.related.map((path) => <PathRow key={path.id} path={path} />)}</div>
      </section> : null}

      <section className={styles.pathGroup} aria-labelledby="explore-paths">
        <div className={styles.groupHeading}><p>Explore</p><h2 id="explore-paths">Browse by direction</h2></div>
        <div>{(model.followed.length || model.related.length ? model.explore : model.all).map((path) => <PathRow key={path.id} path={path} />)}</div>
      </section>

      <aside className={styles.modelNote}>
        <SearchIcon aria-hidden="true" />
        <p><strong>Not sure where you’re headed?</strong> Start with Research, Public Policy & Service, or another broad area. You can explore or follow more than one Path.</p>
      </aside>
    </div>
  </main>;
}

function stateLabel(opportunity: PathOpportunityView) {
  if (opportunity.state === "completed") return "Completed";
  if (opportunity.state === "in_journey") return "In Journey";
  if (opportunity.state === "watching") return "Watching";
  return opportunity.eligibilityLabel;
}

function OpportunityRow({ pathId, opportunity, pro }: { pathId: string; opportunity: PathOpportunityView; pro: boolean }) {
  return <article className={styles.opportunityRow} data-path-opportunity={opportunity.id}>
    <OrganizationMark organization={opportunity.organization} officialSource={opportunity.officialSource} icon={opportunity.icon} type={opportunity.type} category={opportunity.category} size="sm" className={styles.logo} />
    <div className={styles.opportunityCopy}>
      <p>{opportunity.category}<span aria-hidden="true"> · </span>{stateLabel(opportunity)}</p>
      <PathOpportunityLink pathId={pathId} opportunityId={opportunity.id} href={opportunity.href}><h3>{opportunity.title}</h3></PathOpportunityLink>
      <span>{opportunity.organization}</span>
      <div className={styles.opportunityMeta}><span>{opportunity.deadlineLabel}</span>{opportunity.highValue ? <span>High-value experience</span> : null}</div>
    </div>
    <div className={styles.rowActions}>
      <PathOpportunityLink pathId={pathId} opportunityId={opportunity.id} href={opportunity.href} className={styles.viewAction}>View <ArrowIcon /></PathOpportunityLink>
      {opportunity.state === "completed"
        ? <Link href="/accomplishments" className={styles.historyAction}><TrophyIcon /> View accomplishment</Link>
        : <PathOpportunityActions pathId={pathId} opportunityId={opportunity.id} pro={pro} initialWatched={opportunity.state === "watching"} initialAdded={opportunity.state === "in_journey"} />}
    </div>
  </article>;
}

export function OpportunityPathDetail({ path, pro }: { path: OpportunityPathView; pro: boolean }) {
  const activity = [path.completedCount ? `${path.completedCount} completed` : "", path.journeyCount ? `${path.journeyCount} in Journey` : "", path.watchingCount ? `${path.watchingCount} watching` : ""].filter(Boolean);
  return <main className={styles.page} data-opportunity-paths>
    <PathAnalytics pathId={path.id} />
    <div className={styles.shell}>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}><Link href="/paths">Paths</Link><span aria-hidden="true">/</span><span>{path.shortName}</span></nav>
      <header className={styles.detailHeader}>
        <div><p className={styles.eyebrow}>Opportunity Path</p><h1>{path.name}</h1><p>{path.description}</p></div>
        <PathFollowButton pathId={path.id} initialFollowing={path.followed} />
      </header>

      <aside className={styles.pathExplanation}>
        <BookmarkIcon aria-hidden="true" />
        <p><strong>Paths organize possibilities around a goal.</strong> Watch something you want to monitor, or add it to Journey when you decide to pursue it.</p>
      </aside>

      <section className={styles.activityBand} aria-label="Your activity in this path">
        <div><p>Your activity</p><strong>{activity.length ? activity.join(" · ") : "Nothing recorded here yet"}</strong></div>
        <div><p>Current catalog</p><strong>{countLabel(path.currentCount)} from {path.organizationCount} organizations</strong></div>
      </section>

      <div className={styles.stageList}>
        {path.stages.map((stage) => <section className={styles.stage} key={stage.id} aria-labelledby={`path-stage-${stage.id}`}>
          <div className={styles.stageIntro}>
            <p>Way to build experience</p>
            <h2 id={`path-stage-${stage.id}`}>{stage.name}</h2>
            <p>{stage.description}</p>
            <ul aria-label="Experience types">{stage.experienceTypes.map((type) => <li key={type}>{type}</li>)}</ul>
            <PathDiscoverLink pathId={path.id} category={stage.name} href={stage.discoverHref} className={styles.exploreLink}>Explore in Discover <ArrowIcon /></PathDiscoverLink>
          </div>
          <div className={styles.stageContent}>
            <div className={styles.stageSummary}>
              <span>{countLabel(stage.currentCount)}</span>
              <span>{stage.completedCount ? `${stage.completedCount} completed` : stage.journeyCount ? `${stage.journeyCount} in Journey` : stage.watchingCount ? `${stage.watchingCount} watching` : "No activity yet"}</span>
            </div>
            {stage.opportunities.length ? <div>{stage.opportunities.map((opportunity) => <OpportunityRow key={opportunity.id} pathId={path.id} opportunity={opportunity} pro={pro} />)}</div> : <div className={styles.stageEmpty}><CheckIcon /><p><strong>No current match is shown here.</strong> The experience type still belongs in this Path; Discover may have broader options that need an eligibility review.</p></div>}
            {!pro && stage.currentCount > stage.opportunities.length ? <p className={styles.previewNote}>This Free preview shows one current example. Pro adds the full verified set and Watch.</p> : null}
          </div>
        </section>)}
      </div>

      {(path.watchingCount || path.journeyCount) ? <aside className={styles.plannerHandoff}>
        <div><p>Looking for dates?</p><strong>Planner keeps upcoming openings and deadlines in one place.</strong></div>
        <Link href="/planner">Open Planner <ArrowIcon /></Link>
      </aside> : null}

      {path.related.length ? <section className={styles.related} aria-labelledby="related-paths-title"><p>Related paths</p><h2 id="related-paths-title">Explore another direction</h2><div>{path.related.map((item) => <Link key={item.id} href={item.href}>{item.name}<ArrowIcon /></Link>)}</div></section> : null}
    </div>
  </main>;
}

export function OpportunityPathsUnavailable() {
  return <main className={styles.page} data-opportunity-paths><div className={styles.shell}><div className={styles.unavailable}><SparkIcon /><h1>Paths are temporarily unavailable.</h1><p>Your Journey and saved opportunities are unchanged.</p><Link href="/opportunities">Open Discover</Link></div></div></main>;
}
