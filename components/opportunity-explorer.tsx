import Link from "next/link";
import type { ExplorerAreaModel, ExplorerAreaSummary, ExplorerLandingModel, ExplorerLandscapeView, ExplorerOpportunityView } from "@/lib/opportunity-explorer";
import type { GuidanceState } from "@/lib/guidance";
import { ExplorerGuidance } from "./contextual-guidance";
import { OrganizationMark } from "./organization-logo";
import { ArrowIcon, SearchIcon, SparkIcon, TargetIcon, TrophyIcon } from "./icons";
import { ExplorerAnalytics, ExplorerLink, ExplorerOpportunityActions } from "./opportunity-explorer-actions";
import styles from "./opportunity-explorer.module.css";

function countLabel(count: number) {
  return `${count} current ${count === 1 ? "opportunity" : "opportunities"}`;
}

function AreaRow({ area, label }: { area: ExplorerAreaSummary; label?: string }) {
  return <ExplorerLink href={area.href} event="area" areaId={area.id} className={styles.areaRow}>
    <span className={styles.areaMark} aria-hidden="true"><SparkIcon /></span>
    <span className={styles.areaCopy}><span>{label ?? countLabel(area.count)}</span><strong>{area.name}</strong><small>{area.description}</small></span>
    <span className={styles.areaCount}>{area.organizationCount} organizations</span>
    <ArrowIcon />
  </ExplorerLink>;
}

function OpportunityExample({ opportunity, areaId, pro }: { opportunity: ExplorerOpportunityView; areaId: string; pro: boolean }) {
  const state = opportunity.state === "in_journey" ? "In Journey" : opportunity.state === "watching" ? "Watching" : opportunity.state === "completed" ? "Completed" : opportunity.eligibilityLabel;
  return <article className={styles.opportunity} data-explorer-opportunity={opportunity.id}>
    <OrganizationMark organization={opportunity.organization} officialSource={opportunity.officialSource} icon={opportunity.icon} type={opportunity.type} category={opportunity.category} size="sm" className={styles.organizationMark} />
    <div className={styles.opportunityCopy}>
      <p>{opportunity.category}<span aria-hidden="true"> · </span>{state}</p>
      <ExplorerLink href={opportunity.href} event="opportunity" areaId={areaId} opportunityId={opportunity.id}><h3>{opportunity.title}</h3></ExplorerLink>
      <span>{opportunity.organization}</span>
      <div><span>{opportunity.deadlineLabel}</span>{opportunity.highValue ? <span>High-value experience</span> : null}</div>
    </div>
    {opportunity.state === "completed" ? <Link href="/accomplishments" className={styles.completedAction}><TrophyIcon /> View accomplishment</Link> : <ExplorerOpportunityActions areaId={areaId} opportunityId={opportunity.id} pro={pro} initialWatched={opportunity.state === "watching"} initialAdded={opportunity.state === "in_journey"} />}
  </article>;
}

function Landscape({ landscape, areaId, pro }: { landscape: ExplorerLandscapeView; areaId: string; pro: boolean }) {
  return <section className={styles.landscape} id={landscape.id} aria-labelledby={`landscape-${landscape.id}`}>
    <div className={styles.landscapeIntro}>
      <p>{countLabel(landscape.count)}</p>
      <h2 id={`landscape-${landscape.id}`}>{landscape.name}</h2>
      <p>{landscape.description}</p>
      <ExplorerLink href={landscape.discoverHref} event="discover" areaId={areaId} typeId={landscape.id} className={styles.textAction}>Explore all in Discover <ArrowIcon /></ExplorerLink>
    </div>
    <div className={styles.examples}>
      {landscape.opportunities.length ? landscape.opportunities.map((opportunity) => <OpportunityExample key={opportunity.id} opportunity={opportunity} areaId={areaId} pro={pro} />) : <p className={styles.quietEmpty}>Current examples need an eligibility review. Discover still has the broader catalog.</p>}
    </div>
  </section>;
}

export function OpportunityExplorerLanding({ model, guidance }: { model: ExplorerLandingModel; guidance: GuidanceState }) {
  const primaryAreas = model.related.length ? model.related : model.areas.slice(0, 4);
  const remaining = model.areas.filter((area) => !primaryAreas.some((primary) => primary.id === area.id));
  return <main className={styles.page} data-opportunity-explorer>
    <ExplorerAnalytics />
    <div className={styles.shell}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>Explore</p>
        <h1>Discover what’s possible.</h1>
        <p>See the kinds of opportunities students can pursue, including options you may not know to search for yet.</p>
      </header>
      <ExplorerGuidance initialState={guidance} />

      <section className={styles.primarySection} aria-labelledby="start-with-interest">
        <div className={styles.sectionHeading}><p>{model.related.length ? "From your profile" : "Start with an interest"}</p><h2 id="start-with-interest">{model.related.length ? "Areas connected to what you study" : "Choose a broad area"}</h2></div>
        <div>{primaryAreas.map((area) => <AreaRow key={area.id} area={area} label={area.profileRelated ? "Related to your profile" : undefined} />)}</div>
      </section>

      {model.firstYear.length ? <section className={styles.firstYear} aria-labelledby="first-year-title">
        <div className={styles.sectionHeading}><p>First year</p><h2 id="first-year-title">Things you can do now</h2><small>Only opportunities with supported first-year eligibility appear here.</small></div>
        <div className={styles.firstYearList}>{model.firstYear.map((item) => <ExplorerLink key={item.id} href={item.discoverHref} event="discover" areaId="first-year" typeId={item.id}><span>{item.name}</span><strong>{item.count}</strong><ArrowIcon /></ExplorerLink>)}</div>
      </section> : null}

      <section id="experience-types" className={styles.experienceSection} aria-labelledby="experience-title">
        <div className={styles.sectionHeading}><p>Not sure yet?</p><h2 id="experience-title">Explore by experience</h2><small>Start with what you might want to try, without choosing a career direction.</small></div>
        <div className={styles.experienceGrid}>{model.experiences.map((experience) => <ExplorerLink key={experience.id} href={experience.href} event="type" typeId={experience.id} className={styles.experienceItem}><span aria-hidden="true"><TargetIcon /></span><span><strong>{experience.name}</strong><small>{experience.description}</small></span><em>{experience.count}</em><ArrowIcon /></ExplorerLink>)}</div>
      </section>

      {model.experienceSpotlight ? <div id="experience-spotlight" className={styles.landscapeList}><Landscape landscape={model.experienceSpotlight} areaId="experience" pro={model.pro} /></div> : null}

      {model.serendipity ? <aside className={styles.serendipity} aria-labelledby="something-different">
        <span aria-hidden="true"><SparkIcon /></span>
        <div><p>Something different</p><h2 id="something-different">{model.serendipity.name}</h2><small>{model.serendipity.reason}. {model.serendipity.description}</small></div>
        <ExplorerLink href={model.serendipity.href} event="serendipity" areaId={model.serendipity.id}>Explore this area <ArrowIcon /></ExplorerLink>
      </aside> : null}

      {remaining.length ? <section className={styles.moreAreas} aria-labelledby="more-areas-title"><div className={styles.sectionHeading}><p>More possibilities</p><h2 id="more-areas-title">Keep exploring</h2></div><div>{remaining.map((area) => <AreaRow key={area.id} area={area} />)}</div></section> : null}

      <footer className={styles.catalogHandoff}><SearchIcon /><p><strong>Know what you want?</strong> Discover is the complete catalog for search and filters.</p><Link href="/opportunities">Open Discover <ArrowIcon /></Link></footer>
    </div>
  </main>;
}

export function OpportunityExplorerArea({ model }: { model: ExplorerAreaModel }) {
  return <main className={styles.page} data-opportunity-explorer data-explorer-area={model.id}>
    <ExplorerAnalytics areaId={model.id} />
    <div className={styles.shell}>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}><Link href="/explore">Explore</Link><span aria-hidden="true">/</span><span>{model.shortName}</span></nav>
      <header className={styles.areaHero}>
        <div><p className={styles.eyebrow}>Opportunity landscape</p><h1>{model.name}</h1><p>{model.description}</p></div>
        <div className={styles.areaFacts}><span>{countLabel(model.count)}</span><span>{model.organizationCount} organizations</span></div>
      </header>
      <aside className={styles.landscapeNote}><SparkIcon /><p><strong>This is a map, not a ranking.</strong> Explore a kind of experience, then use Discover for the full catalog.</p></aside>
      <div className={styles.landscapeList}>{model.landscapes.map((landscape) => <Landscape key={landscape.id} landscape={landscape} areaId={model.id} pro={model.pro} />)}</div>
      {model.collection ? <aside className={styles.pathHandoff}><div><p>Want a shorter place to start?</p><strong>{model.collection.name} is a curated shortlist from this landscape.</strong></div><Link href={model.collection.href}>Open Collection <ArrowIcon /></Link></aside> : null}
      {model.path ? <aside className={styles.pathHandoff}><div><p>Want to follow this direction over time?</p><strong>Opportunity Paths shows how related experience types connect.</strong></div><ExplorerLink href={model.path.href} event="path" areaId={model.id} pathId={model.path.id}>View {model.path.name} Path <ArrowIcon /></ExplorerLink></aside> : null}
      {model.adjacent.length ? <section className={styles.adjacent} aria-labelledby="adjacent-title"><p>Related areas</p><h2 id="adjacent-title">Explore another possibility</h2><div>{model.adjacent.map((area) => <ExplorerLink key={area.id} href={area.href} event="area" areaId={area.id}>{area.name}<ArrowIcon /></ExplorerLink>)}</div></section> : null}
    </div>
  </main>;
}

export function OpportunityExplorerUnavailable() {
  return <main className={styles.page} data-opportunity-explorer><div className={styles.shell}><div className={styles.unavailable}><SparkIcon /><h1>Explore is temporarily unavailable.</h1><p>You can still browse the complete catalog. Your profile, Watch list, and Journey are unchanged.</p><Link href="/opportunities">Open Discover</Link></div></div></main>;
}

export function OpportunityExplorerSkeleton() {
  return <main className={styles.page} aria-busy="true" aria-label="Loading Explore"><div className={styles.shell}><div className={styles.skeletonHero}><span/><span/><span/></div><div className={styles.skeletonRows}>{Array.from({ length: 5 }, (_, index) => <span key={index}/>)}</div></div></main>;
}
