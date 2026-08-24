import type { OpportunityPlannerModel, PlannerItem } from "@/lib/opportunity-planner";
import { OpportunityPlannerEvents, PlannerMonthDisclosure, PlannerTrackedLink } from "./opportunity-planner-events";
import { PlannerGuidance } from "./contextual-guidance";
import type { GuidanceState } from "@/lib/guidance";
import styles from "./opportunity-planner.module.css";

function readableDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00.000Z`));
}

function destinationFor(item: PlannerItem): "journey" | "for_you" | "discover" {
  return item.relationship === "Pursuing" ? "journey" : item.relationship === "Recommended" ? "for_you" : "discover";
}

function PlannerRow({ item, compact = false }: { item: PlannerItem; compact?: boolean }) {
  return <article className={compact ? styles.comingItem : styles.nowItem}>
    <span className={styles.relationship}>{item.relationship}</span>
    <div><h3 className={styles.itemTitle}>{item.title}</h3><p className={styles.itemMeta}>{item.organization} · {item.label}{item.missingMaterials ? ` · ${item.missingMaterials} ${item.missingMaterials === 1 ? "material" : "materials"} missing` : ""}</p><PlannerTrackedLink href={item.href} destination={destinationFor(item)} className={styles.textLink}>{item.action} →</PlannerTrackedLink></div>
    <div className={styles.itemDate}>{item.date ? <><strong>{readableDate(item.date)}</strong>{item.timing ? <span>{item.timing}</span> : null}</> : <strong>{item.label}</strong>}</div>
  </article>;
}

export function OpportunityPlanner({ model, guidance }: { model: OpportunityPlannerModel; guidance: GuidanceState }) {
  const populatedMonths = model.months.filter((month) => month.events.length).length;
  return <main className={styles.page} data-opportunity-planner="v1">
    <OpportunityPlannerEvents />
    <div className={styles.shell}>
      <header className={styles.hero}>
        <div><p className={styles.eyebrow}>Opportunity Planner</p><h1 className={styles.title}>Your year ahead.</h1><p className={styles.dek}>What needs attention now, what has a verified date ahead, and what you chose to keep in view.</p></div>
        <div className={styles.heroLinks}><PlannerTrackedLink href="/#journey-calendar" destination="calendar" className={styles.linkButton}>View Calendar</PlannerTrackedLink><PlannerTrackedLink href="/" destination="journey" className={styles.primaryLink}>Open Journey</PlannerTrackedLink></div>
      </header>

      <PlannerGuidance initialState={guidance} hasWatching={model.watchingNextCycle.length > 0} />

      <div className={styles.mainGrid}>
        <div>
          <section className={styles.section} data-guide-anchor="planner-now">
            <div className={styles.sectionHeader}><div><p className={styles.eyebrow}>What matters now</p><h2 className={styles.sectionTitle}>Now</h2></div><span className={styles.sectionNote}>{model.now.length ? `${model.now.length} ${model.now.length === 1 ? "item" : "items"}` : "No manufactured urgency"}</span></div>
            {model.now.length ? <div className={styles.nowList}>{model.now.map((item) => <PlannerRow key={item.id} item={item} />)}</div> : <div className={styles.empty}><strong>{model.summary.pursuing + model.summary.watching + model.summary.matched === 0 ? "Start your year." : "Your plan is steady."}</strong><p>{model.summary.pursuing + model.summary.watching + model.summary.matched === 0 ? "Save an opportunity to Journey or review your matches." : "No verified date or application task needs attention right now."}</p>{model.summary.pursuing + model.summary.watching + model.summary.matched === 0 ? <PlannerTrackedLink href="/advisor" destination="for_you" className={styles.textLink}>View For You →</PlannerTrackedLink> : null}</div>}
          </section>

          <section className={styles.section} id="year-ahead" data-guide-anchor="planner-year">
            <div className={styles.sectionHeader}><div><p className={styles.eyebrow}>Verified dates only</p><h2 className={styles.sectionTitle}>Year Ahead</h2></div><span className={styles.sectionNote}>{populatedMonths ? `${populatedMonths} active ${populatedMonths === 1 ? "month" : "months"}` : "No confirmed dates yet"}</span></div>
            <div className={styles.timeline} aria-label="Nine month opportunity timeline">
              {model.months.map((month) => month.events.length ? <PlannerMonthDisclosure key={month.key} monthKey={month.key} className={styles.month}>
                <summary aria-label={`${month.label}: ${month.events.length} verified ${month.events.length === 1 ? "event" : "events"}`}>
                  <span className={styles.monthName}>{month.shortLabel}</span><span className={styles.monthCount}>{month.events.length}</span><span className={styles.monthCaption}>{month.counts.slice(0, 2).map((count) => `${count.count} ${count.label.toLocaleLowerCase()}`).join(" · ")}</span>
                </summary>
                <div className={styles.monthDetails}>{month.events.map((event) => <div key={event.id} className={styles.monthEvent}><strong>{event.title}</strong><span>{event.relationship} · {event.label} · {readableDate(event.date!)}</span></div>)}</div>
              </PlannerMonthDisclosure> : <div className={styles.month} key={month.key} aria-label={`${month.label}: no confirmed dates`}><div className={styles.monthStatic}><span className={styles.monthName}>{month.shortLabel}</span><span className={styles.monthCount} data-empty="true">—</span><span className={styles.monthCaption}>No confirmed dates</span></div></div>)}
            </div>
          </section>

          {model.comingUp.length ? <section className={styles.section}>
            <div className={styles.sectionHeader}><div><p className={styles.eyebrow}>What is coming</p><h2 className={styles.sectionTitle}>Coming Up</h2></div></div>
            {model.comingUp.map((group) => <div className={styles.comingGroup} key={group.id}><h3 className={styles.comingLabel}>{group.label}</h3><div className={styles.comingList}>{group.items.map((item) => <PlannerRow key={`${group.id}:${item.id}`} item={item} compact />)}</div></div>)}
          </section> : null}
        </div>

        <aside className={styles.aside} aria-label="Opportunity planning context">
          <section className={styles.asideBlock}><p className={styles.eyebrow}>At a glance</p><h2 className={styles.asideTitle}>Opportunity Mix</h2><div>{model.mix.map((item) => <div className={styles.mixRow} key={item.category}><PlannerTrackedLink href={item.href} destination="discover" category={item.category} className={styles.mixLabel}>{item.category}</PlannerTrackedLink><span className={styles.mixValues}>{item.pursuing ? <span>{item.pursuing} pursuing</span> : null}{item.watching ? <span>{item.watching} watching</span> : null}{item.recommended ? <span>{item.recommended} matched</span> : null}{!item.pursuing && !item.watching && !item.recommended ? <span>None yet</span> : null}</span></div>)}</div></section>

          {model.areasToExplore.length ? <section className={styles.asideBlock}><p className={styles.eyebrow}>Potentially relevant</p><h2 className={styles.asideTitle}>Worth exploring</h2>{model.areasToExplore.map((item) => <div className={styles.quietItem} key={item.category}><strong>{item.category}</strong><span>{item.matchCount} current {item.matchCount === 1 ? "match" : "matches"}</span><PlannerTrackedLink href={item.href} destination="discover" category={item.category} className={styles.textLink}>Explore {item.category.toLocaleLowerCase()} →</PlannerTrackedLink></div>)}</section> : null}

          {model.watchingNextCycle.length ? <section className={styles.asideBlock} data-guide-anchor="planner-watching"><p className={styles.eyebrow}>No date assumed</p><h2 className={styles.asideTitle}>Watching for next cycle</h2>{model.watchingNextCycle.map((item) => <div className={styles.quietItem} key={item.opportunityId}><strong>{item.title}</strong><span>{item.organization}</span><p>Next cycle not announced</p><PlannerTrackedLink href={item.href} destination="discover" className={styles.textLink}>Review opportunity →</PlannerTrackedLink></div>)}</section> : null}

          {model.prepareAhead.length ? <section className={styles.asideBlock}><p className={styles.eyebrow}>Verified requirements</p><h2 className={styles.asideTitle}>Prepare ahead</h2>{model.prepareAhead.map((item) => <div className={styles.quietItem} key={item.opportunityId}><strong>{item.title}</strong><span>{item.organization}</span><ul className={styles.requirements}>{item.requirements.map((requirement) => <li key={requirement}>{requirement}</li>)}</ul><PlannerTrackedLink href={item.href} destination="discover" className={styles.textLink}>Review requirements →</PlannerTrackedLink></div>)}</section> : null}

          {model.access === "free" ? <section className={styles.upgrade}><strong>Plan beyond Journey.</strong><p>Pro adds your verified matches and watched programs to Year Ahead.</p><a className={styles.textLink} href="/pricing">See Pro →</a></section> : null}
        </aside>
      </div>
    </div>
  </main>;
}

export function OpportunityPlannerUnavailable() {
  return <main className={styles.page}><div className={styles.shell}><div className={styles.empty}><strong>Your plan could not load.</strong><p>Journey is unchanged. Refresh to try again.</p><a href="/planner" className={styles.textLink}>Retry →</a></div></div></main>;
}
