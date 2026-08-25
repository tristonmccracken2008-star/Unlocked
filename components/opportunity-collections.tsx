import Link from "next/link";
import type { CollectionDetailModel, CollectionsLandingModel, CollectionOpportunityView, CollectionSummary } from "@/lib/opportunity-collections";
import { OrganizationMark } from "./organization-logo";
import { ArrowIcon, BookmarkIcon, SearchIcon, SparkIcon, TrophyIcon } from "./icons";
import { CollectionLink, CollectionOpportunityActions, CollectionsAnalytics } from "./opportunity-collections-actions";
import { CollectionsGuidance } from "./contextual-guidance";
import type { GuidanceState } from "@/lib/guidance";
import styles from "./opportunity-collections.module.css";

function countLabel(count: number) {
  return `${count} current ${count === 1 ? "opportunity" : "opportunities"}`;
}

function CollectionRow({ collection, featured = false }: { collection: CollectionSummary; featured?: boolean }) {
  return <CollectionLink href={collection.href} event="collection" collectionId={collection.id} className={featured ? styles.featuredRow : styles.collectionRow}>
    <span className={styles.collectionIndex} aria-hidden="true">{featured ? "Start" : "•"}</span>
    <span className={styles.collectionCopy}><span>{collection.profileRelated ? "Connected to your profile" : countLabel(collection.safe)}</span><strong>{collection.title}</strong><small>{collection.description}</small></span>
    <span className={styles.collectionFacts}>{collection.organizations} organizations</span>
    <ArrowIcon />
  </CollectionLink>;
}

function stateLabel(opportunity: CollectionOpportunityView) {
  if (opportunity.state === "completed") return "Completed";
  if (opportunity.state === "in_journey") return "In Journey";
  if (opportunity.state === "watching") return "Watching";
  if (opportunity.eligibility === "eligible") return "Fits your profile";
  return "Check eligibility";
}

function OpportunityRow({ opportunity, collectionId, pro, compact = false }: { opportunity: CollectionOpportunityView; collectionId: string; pro: boolean; compact?: boolean }) {
  return <article className={compact ? styles.compactOpportunity : styles.opportunity} data-collection-opportunity={opportunity.id}>
    <OrganizationMark organization={opportunity.organization} officialSource={opportunity.officialSource} icon={opportunity.icon} type={opportunity.type} category={opportunity.category} size="sm" className={styles.organizationMark} />
    <div className={styles.opportunityCopy}>
      <p>{opportunity.factualLabel}<span aria-hidden="true"> · </span>{stateLabel(opportunity)}</p>
      <CollectionLink href={opportunity.href} event="opportunity" collectionId={collectionId}><h3>{opportunity.title}</h3></CollectionLink>
      <span>{opportunity.organization}</span>
      <div><span>{opportunity.deadlineLabel}</span><span>{opportunity.lifecycleLabel}</span>{opportunity.highValue ? <span>High-value experience</span> : null}</div>
    </div>
    {compact ? <CollectionLink href={opportunity.href} event="opportunity" collectionId={collectionId} className={styles.openLink}>View <ArrowIcon /></CollectionLink> : opportunity.state === "completed" ? <Link href="/accomplishments" className={styles.completedAction}><TrophyIcon /> View accomplishment</Link> : <CollectionOpportunityActions collectionId={collectionId} opportunityId={opportunity.id} pro={pro} initialWatched={opportunity.state === "watching"} initialAdded={opportunity.state === "in_journey"} />}
  </article>;
}

export function OpportunityCollectionsLanding({ model, guidance }: { model: CollectionsLandingModel; guidance: GuidanceState }) {
  const featuredIds = new Set(model.featured.map((item) => item.id));
  return <main className={styles.page} data-opportunity-collections>
    <CollectionsAnalytics />
    <div className={styles.shell}>
      <header className={styles.hero}><p className={styles.eyebrow}>Collections</p><h1>Good places to start.</h1><p>Curated groups for common student situations, fields, and timing. Each one is built from current opportunities with official sources.</p></header>
      <CollectionsGuidance initialState={guidance} />
      <section className={styles.featured} aria-labelledby="recommended-starts"><div className={styles.sectionHeading}><p>{model.featured.some((item) => item.profileRelated) ? "Relevant to you" : "Strong starting points"}</p><h2 id="recommended-starts">Choose one direction</h2><small>A short list first. The full catalog remains in Discover.</small></div><div>{model.featured.map((collection) => <CollectionRow key={collection.id} collection={collection} featured />)}</div></section>
      {model.groups.map((group) => {
        const collections = group.collections.filter((collection) => !featuredIds.has(collection.id));
        return collections.length ? <section key={group.id} className={styles.group} aria-labelledby={`collection-group-${group.id}`}><div className={styles.sectionHeading}><p>Browse</p><h2 id={`collection-group-${group.id}`}>{group.label}</h2></div><div>{collections.map((collection) => <CollectionRow key={collection.id} collection={collection} />)}</div></section> : null;
      })}
      <footer className={styles.catalogHandoff}><SearchIcon /><p><strong>Need the complete catalog?</strong> Discover has every current listing, search, and filter.</p><CollectionLink href="/opportunities" event="discover">Open Discover <ArrowIcon /></CollectionLink></footer>
    </div>
  </main>;
}

export function OpportunityCollectionDetail({ model }: { model: CollectionDetailModel }) {
  return <main className={styles.page} data-opportunity-collections data-collection-id={model.id}>
    <CollectionsAnalytics collectionId={model.id} />
    <div className={styles.shell}>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}><Link href="/collections">Collections</Link><span aria-hidden="true">/</span><span>{model.shortTitle}</span></nav>
      <header className={styles.detailHero}><div><p className={styles.eyebrow}>Curated collection</p><h1>{model.title}</h1><p>{model.description}</p></div><div className={styles.detailFacts}><span>{countLabel(model.safe)}</span><span>{model.organizations} official organizations</span><span>{model.highValue} high-value options</span></div></header>
      <aside className={styles.trustNote}><SparkIcon /><p><strong>Selected as a starting point.</strong> We include only current, recommendation-safe records. Confirm your own eligibility on the official source before applying.</p></aside>
      <section className={styles.startSection} aria-labelledby="start-here"><div className={styles.sectionHeading}><p>Start here</p><h2 id="start-here">A useful first shortlist</h2><small>{model.pro ? "Ordered with light profile context and kept intentionally small." : "Four strong examples. Pro members see one additional profile-aware starting point."}</small></div><div>{model.startHere.map((opportunity) => <OpportunityRow key={opportunity.id} opportunity={opportunity} collectionId={model.id} pro={model.pro} />)}</div></section>
      {model.more.length ? <section className={styles.moreSection} aria-labelledby="more-to-explore"><div className={styles.sectionHeading}><p>More to explore</p><h2 id="more-to-explore">Keep looking</h2></div><div>{model.more.map((opportunity) => <OpportunityRow key={opportunity.id} opportunity={opportunity} collectionId={model.id} pro={model.pro} compact />)}</div></section> : null}
      <section className={styles.handoffs} aria-label="Continue exploring">
        <CollectionLink href={model.discoverHref} event="discover" collectionId={model.id}><SearchIcon /><span><strong>See every matching result</strong><small>Continue in Discover with the relevant filters.</small></span><ArrowIcon /></CollectionLink>
        {model.explorer ? <Link href={model.explorer.href}><SparkIcon /><span><strong>{model.explorer.title}</strong><small>Understand the wider opportunity landscape.</small></span><ArrowIcon /></Link> : null}
        {model.path ? <CollectionLink href={model.path.href} event="path" collectionId={model.id} pathId={model.path.href.split("/").pop()}><BookmarkIcon /><span><strong>{model.path.title}</strong><small>See how related experiences connect over time.</small></span><ArrowIcon /></CollectionLink> : null}
      </section>
      {model.related.length ? <section className={styles.related} aria-labelledby="related-collections"><p>Another starting point</p><h2 id="related-collections">Related collections</h2><div>{model.related.map((collection) => <CollectionLink key={collection.id} href={collection.href} event="collection" collectionId={collection.id}>{collection.title}<ArrowIcon /></CollectionLink>)}</div></section> : null}
    </div>
  </main>;
}

export function OpportunityCollectionsUnavailable() {
  return <main className={styles.page} data-opportunity-collections><div className={styles.shell}><div className={styles.unavailable}><SparkIcon /><h1>Collections are temporarily unavailable.</h1><p>You can still use the complete catalog. Your Watch list and Journey are unchanged.</p><Link href="/opportunities">Open Discover</Link></div></div></main>;
}

export function OpportunityCollectionsSkeleton() {
  return <main className={styles.page} aria-busy="true" aria-label="Loading Collections"><div className={styles.shell}><div className={styles.skeletonHero}><span/><span/><span/></div><div className={styles.skeletonRows}>{Array.from({ length: 5 }, (_, index) => <span key={index}/>)}</div></div></main>;
}
