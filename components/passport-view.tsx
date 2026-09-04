import Link from "next/link";
import type { PassportStoryItem, PassportView } from "@/lib/passport";
import { ArrowIcon } from "./icons";
import styles from "./opportunity-passport.module.css";

const month = (value: string) => new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
const year = (value: string) => value.slice(0, 4);
const study = (model: PassportView) => [model.identity.major, model.identity.secondaryMajor].filter(Boolean).join(" + ");

function OpportunityLink({ item, shareToken }: { item: PassportStoryItem; shareToken?: string }) {
  return item.opportunityId ? <Link href={`/discover/${encodeURIComponent(item.opportunityId)}${shareToken ? `?from=passport&share=${encodeURIComponent(shareToken)}` : ""}`} className={styles.storyLink}>Explore opportunity <ArrowIcon /></Link> : null;
}

export function PassportDocument({ model, publicView = false, featuredId }: { model: PassportView; publicView?: boolean; featuredId?: string }) {
  const grouped = [...new Set(model.timeline.map((item) => year(item.date)))];
  const featured = featuredId ? model.highlights.find((item) => item.id === featuredId) : undefined;
  const sections = new Set(model.sections);
  return <article className={styles.passport} data-passport-document="" data-public={publicView ? "true" : "false"}>
    <header className={styles.cover}>
      <div className={styles.coverMark}><span>U</span><p>Opportunity Passport</p></div>
      <div className={styles.coverIdentity}>
        <p className={styles.eyebrow}>{publicView ? "A college journey" : "Your college journey, in one place"}</p>
        <h1>{model.identity.name}</h1>
        {model.identity.headline ? <p className={styles.headline}>{model.identity.headline}</p> : null}
        <div className={styles.identityLine}>{model.identity.school ? <span>{model.identity.school}</span> : null}{study(model) ? <span>{study(model)}</span> : null}{model.identity.minor ? <span>Minor in {model.identity.minor}</span> : null}{model.identity.graduationYear ? <span>Class of {model.identity.graduationYear}</span> : null}</div>
      </div>
      <div className={styles.coverTrail} aria-hidden="true"><i/><i/><i/><i/></div>
    </header>
    {featured ? <section className={styles.featuredMoment} aria-label="Shared milestone"><p>{featured.outcome || featured.kind}</p><h2>{featured.title}</h2>{featured.organization ? <strong>{featured.organization}</strong> : null}<OpportunityLink item={featured} shareToken={publicView ? model.shareToken : undefined}/></section> : null}
    {model.highlights.length && !featured ? <section className={styles.highlights}><div className={styles.sectionIntro}><p>Selected highlights</p><h2>The moments that matter to me.</h2></div><div className={styles.highlightGrid} style={model.highlights.length === 1 ? { gridTemplateColumns: "1fr" } : undefined}>{model.highlights.map((item, index) => <article key={item.id}><span>0{index + 1}</span><p>{item.outcome || item.kind}</p><h3>{item.title}</h3>{item.organization ? <small>{item.organization}</small> : null}<OpportunityLink item={item} shareToken={publicView ? model.shareToken : undefined}/></article>)}</div></section> : null}
    {sections.has("timeline") && model.timeline.length ? <section className={styles.timelineSection}><div className={styles.sectionIntro}><p>Journey timeline</p><h2>Where the journey has taken me.</h2></div><div className={styles.timeline}>{grouped.map((groupYear) => <div key={groupYear} className={styles.yearGroup}><h3>{groupYear}</h3><ol>{model.timeline.filter((item) => year(item.date) === groupYear).map((item) => <li key={item.id}><time>{month(item.date)}</time><div><p>{item.outcome || item.kind}</p><h4>{item.title}</h4>{item.organization ? <span>{item.organization}</span> : null}{item.description ? <small>{item.description}</small> : null}<OpportunityLink item={item} shareToken={publicView ? model.shareToken : undefined}/></div></li>)}</ol></div>)}</div></section> : null}
    {(sections.has("experiences") || sections.has("projects")) && (model.experiences.length || model.projects.length) ? <section className={styles.workSection}><div className={styles.sectionIntro}><p>Experiences & projects</p><h2>What I have done and built.</h2></div><div className={styles.workGrid}>{[...model.projects, ...model.experiences].map((item) => <article key={item.id}><p>{item.kind}{item.current ? " · Current" : ""}</p><h3>{item.title}</h3>{item.organization ? <strong>{item.organization}</strong> : null}{item.description ? <span>{item.description}</span> : null}{item.skills.length ? <ul>{item.skills.slice(0, 5).map((skill) => <li key={skill}>{skill}</li>)}</ul> : null}<OpportunityLink item={item} shareToken={publicView ? model.shareToken : undefined}/></article>)}</div></section> : null}
    {sections.has("skills") && model.skills.length ? <section className={styles.skillsSection}><div className={styles.sectionIntro}><p>Skills in context</p><h2>Evidence, not endorsements.</h2></div><div className={styles.skillList}>{model.skills.slice(0, 12).map((skill) => <div key={skill.name}><h3>{skill.name}</h3><p>Demonstrated through {skill.evidence.map((item) => item.title).join(" · ")}</p></div>)}</div></section> : null}
    {sections.has("interests") && model.identity.careerInterests.length ? <section className={styles.interests}><p>Currently exploring</p>{model.identity.careerInterests.map((item) => <span key={item}>{item}</span>)}</section> : null}
    {!model.timeline.length && !model.experiences.length && !model.projects.length && !model.accomplishments.length ? <section className={styles.empty}><p>Your Passport starts with what you’ve actually done.</p><h2>Add a project, experience, accomplishment, or meaningful Journey milestone.</h2>{!publicView ? <Link href="/accomplishments">Add something meaningful <ArrowIcon /></Link> : null}</section> : null}
    {publicView ? <footer className={styles.madeWith}><span>U</span><p>Made with UnlockED</p><Link href="/">Build your own journey <ArrowIcon /></Link></footer> : null}
  </article>;
}
