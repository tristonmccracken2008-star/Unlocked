import type { AccomplishmentsModel, AccomplishmentView } from "@/lib/accomplishments";
import type { GuidanceState } from "@/lib/guidance";
import { AccomplishmentsManager } from "./accomplishments-manager";
import { AccomplishmentsGuidance } from "./contextual-guidance";
import { ArrowIcon, PenLineIcon, TrophyIcon } from "./icons";
import styles from "./accomplishments.module.css";

function readableDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00.000Z`));
}

function dateRange(record: AccomplishmentView) {
  if (record.startDate && record.endDate) return `${readableDate(record.startDate)} – ${readableDate(record.endDate)}`;
  if (record.startDate) return `Started ${readableDate(record.startDate)}`;
  if (record.endDate) return `Ended ${readableDate(record.endDate)}`;
  return readableDate(record.outcomeDate);
}

function RecordRow({ record }: { record: AccomplishmentView }) {
  const details = [record.roleTitle, record.projectTitle, record.labOrGroup, record.location].filter(Boolean);
  return <article className={styles.record} id={`accomplishment-${record.id}`} data-accomplishment-source={record.source}>
    <span className={styles.marker} aria-hidden="true"><TrophyIcon /></span>
    <div className={styles.identity}><p>{record.kindLabel}</p><h3>{record.snapshot.title}</h3><span>{record.snapshot.organization}</span>{details.length ? <small>{details.join(" · ")}</small> : null}</div>
    <div className={styles.outcome}><strong>{record.outcomeLabel}</strong><span>{dateRange(record)}</span><small>{record.source === "journey" ? "From Journey" : "Added by you"}</small></div>
    <details className={styles.details}>
      <summary>Details</summary>
      <div>
        {record.description ? <section><h4>Description</h4><p>{record.description}</p></section> : null}
        {record.notes ? <section><h4>Private notes</h4><p>{record.notes}</p></section> : null}
        {record.skills?.length ? <section><h4>Skills or areas</h4><p>{record.skills.join(", ")}</p></section> : null}
        <nav aria-label={`${record.snapshot.title} links`}>
          {record.journeyHref ? <a href={record.journeyHref}>View Journey history <ArrowIcon /></a> : null}
          {record.opportunityHref ? <a href={record.opportunityHref}>View opportunity <ArrowIcon /></a> : null}
          <button type="button" data-accomplishment-edit={record.id}><PenLineIcon /> Edit details</button>
        </nav>
      </div>
    </details>
  </article>;
}

export function Accomplishments({ model, guidance }: { model: AccomplishmentsModel; guidance: GuidanceState }) {
  return <main className={styles.page} data-accomplishments="v1">
    <div className={styles.shell}>
      <header className={styles.hero}>
        <div><p className={styles.eyebrow}>Private college record</p><h1>Accomplishments</h1><p>Meaningful opportunities you completed, earned, or experienced. This record is visible only to you.</p></div>
        <div className={styles.heroActions}><AccomplishmentsManager showTrigger={model.total > 0} /><a href="/passport">Add to Passport</a><a href="/">View Journey</a></div>
      </header>

      <AccomplishmentsGuidance initialState={guidance} hasRecords={model.total > 0} />

      {model.total ? <>
        <section className={styles.summary} aria-label="Accomplishment summary" data-guide-anchor="accomplishments-summary"><strong>{model.total} {model.total === 1 ? "accomplishment" : "accomplishments"}</strong><div>{model.summary.slice(0, 6).map((item) => <span key={item.kind}>{item.count} {item.count === 1 ? item.label : `${item.label}s`}</span>)}</div></section>
        <section className={styles.timeline} aria-labelledby="accomplishment-history-heading" data-guide-anchor="accomplishments-history">
          <h2 id="accomplishment-history-heading" className="sr-only">Accomplishment history</h2>
          {model.groups.map((group) => <section className={styles.year} key={group.year} aria-labelledby={`accomplishment-year-${group.year}`}><header><h2 id={`accomplishment-year-${group.year}`}>{group.year}</h2><span>{group.records.length} {group.records.length === 1 ? "record" : "records"}</span></header><div>{group.records.map((record) => <RecordRow key={record.id} record={record} />)}</div></section>)}
        </section>
      </> : <section className={styles.empty} data-guide-anchor="accomplishments-empty"><span aria-hidden="true"><TrophyIcon /></span><p className={styles.eyebrow}>Your record</p><h2>Your accomplishments will appear here.</h2><p>When you complete or earn an opportunity in Journey, UnlockED adds it to this private record. You can also add something you have already done.</p><div><button type="button" data-accomplishment-create="">Add something you’ve done</button><a href="/">View Journey</a></div></section>}
    </div>
  </main>;
}

export function AccomplishmentsUnavailable() {
  return <main className={styles.page}><div className={styles.shell}><section className={styles.empty}><h1>Your record could not load.</h1><p>Journey is unchanged. Refresh to try again.</p><a href="/accomplishments">Retry</a></section></div></main>;
}
