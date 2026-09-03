"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import Link from "next/link";
import { authenticatedFetch } from "@/data/authenticated-request";
import type {
  ResumeLabModel,
  ResumeDocumentView,
  ResumeExperienceView,
} from "@/lib/resume-lab";
import type { ResumeDocumentRecord, ResumeFactKind, ResumeSection, ResumeSectionKind } from "@/data/resume-lab";
import {
  ArrowIcon,
  CheckIcon,
  ListIcon,
  PenLineIcon,
  SparkIcon,
  TrophyIcon,
} from "./icons";
import { trackProductEvent } from "@/data/product-analytics";
import styles from "./resume-lab.module.css";
import { auditResume, bulletAlternatives, extractClaims, factDiscoveryQuestions, resumeStudioState } from "@/lib/resume-intelligence";
import { BuildNavigation } from "./build-navigation";
import { useLayoutContinuity } from "./use-layout-continuity";

type Tab = "resumes" | "experience";
type EditorMode = "edit" | "review" | "tailor" | "preview";
const sectionLabels: Partial<Record<ResumeSectionKind, string>> = { education: "Education", experience: "Experience", projects: "Projects", research: "Research", publications: "Publications", coursework: "Relevant Coursework", leadership: "Leadership", activities: "Activities", awards: "Awards", skills: "Skills" };
const makeKey = () =>
  `resume-request-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

async function mutate(body: Record<string, unknown>) {
  const response = await authenticatedFetch("/api/resume-lab", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json().catch(() => ({}))) as {
    error?: string;
    model?: ResumeLabModel;
  };
  if (!response.ok || !result.model)
    throw new Error(result.error ?? "Resume Lab could not be updated.");
  return result.model;
}

function ResumePreview({
  resume,
  model,
}: {
  resume: ResumeDocumentView;
  model: ResumeLabModel;
}) {
  const byId = new Map(model.experiences.map((item) => [item.id, item]));
  return (
    <article className={styles.paper} data-template={resume.template} aria-label={`${resume.title} preview`}>
      <header>
        <h2>{model.profile.name}</h2>
        <p>
          {[
            resume.contact.email,
            resume.contact.phone,
            resume.contact.city,
            resume.contact.linkedIn,
            resume.contact.portfolio,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>
      {resume.summary ? (
        <p className={styles.summary}>{resume.summary}</p>
      ) : null}
      {resume.sections
        .filter((section) => section.visible)
        .map((section) => (
          <section key={section.id}>
            <h3>{section.title}</h3>
            {section.kind === "education" ? (
              <div className={styles.resumeEntry}>
                <strong>{model.profile.school}</strong>
                <span>
                  {model.profile.major}
                  {model.profile.graduationYear
                    ? ` · ${model.profile.graduationYear}`
                    : ""}
                </span>
              </div>
            ) : section.kind === "skills" ? (
              <p>
                {resume.skills.join(" · ") ||
                  "Add skills you can support with experience."}
              </p>
            ) : (
              section.entries.map((entry) => {
                const experience = byId.get(entry.experienceId);
                if (!experience) return null;
                return (
                  <div key={entry.experienceId} className={styles.resumeEntry}>
                    <div>
                      <strong>{experience.resolved.title}</strong>
                      <span>{experience.resolved.organization}</span>
                    </div>
                    <small>
                      {[
                        experience.resolved.startDate,
                        experience.current
                          ? "Present"
                          : experience.resolved.endDate,
                      ]
                        .filter(Boolean)
                        .join(" – ")}
                    </small>
                    <ul>
                      {entry.bulletIds.map((bulletId) => {
                        const bullet = experience.bullets.find(
                          (item) => item.id === bulletId,
                        );
                        return bullet ? (
                          <li key={bulletId}>
                            {entry.bulletOverrides?.[bulletId] ?? bullet.text}
                          </li>
                        ) : null;
                      })}
                    </ul>
                  </div>
                );
              })
            )}
          </section>
        ))}
    </article>
  );
}

function ResumeEditor({
  resume,
  model,
  save,
  initialTargetId,
}: {
  resume: ResumeDocumentView;
  model: ResumeLabModel;
  save: (body: Record<string, unknown>, message: string) => void;
  initialTargetId?: string;
}) {
  const [title, setTitle] = useState(resume.title);
  const [email, setEmail] = useState(
    resume.contact.email ?? model.profile.email,
  );
  const [phone, setPhone] = useState(resume.contact.phone ?? "");
  const [city, setCity] = useState(resume.contact.city ?? "");
  const [linkedIn, setLinkedIn] = useState(resume.contact.linkedIn ?? "");
  const [portfolio, setPortfolio] = useState(resume.contact.portfolio ?? "");
  const [summary, setSummary] = useState(resume.summary ?? "");
  const [skills, setSkills] = useState(resume.skills.join(", "));
  const [sections, setSections] = useState(resume.sections);
  const [template, setTemplate] = useState(resume.template);
  const [mode, setMode] = useState<EditorMode>("edit");
  const [targetId, setTargetId] = useState(initialTargetId ?? "");
  function toggleExperience(experience: ResumeExperienceView) {
    setSections((current) => {
      const desired =
          experience.kind === "project"
            ? "projects"
            : experience.kind === "research"
              ? "research"
              : ["leadership", "activity", "volunteer"].includes(
                    experience.kind,
                  )
                ? "leadership"
                : ["award", "scholarship", "competition"].includes(
                      experience.kind,
                    )
                  ? "awards"
                  : "experience";
      const has = current.some((section) => section.entries.some((entry) => entry.experienceId === experience.id));
      if (has) return current.map((section) => ({ ...section, entries: section.entries.filter((entry) => entry.experienceId !== experience.id) }));
      const entry = { experienceId: experience.id, bulletIds: experience.bullets.map((bullet) => bullet.id).slice(0, 5) };
      if (!current.some((section) => section.kind === desired)) return [...current, { id: `section:${desired}`, kind: desired, title: sectionLabels[desired] ?? "Experience", visible: true, entries: [entry] }];
      return current.map((section) => section.kind === desired ? { ...section, visible: true, entries: [...section.entries, entry] } : section);
    });
  }
  function moveSection(index: number, direction: -1 | 1) {
    setSections((current) => {
      const destination = index + direction;
      if (destination < 0 || destination >= current.length) return current;
      const next = [...current];
      [next[index], next[destination]] = [next[destination]!, next[index]!];
      return next;
    });
  }
  function setBulletOverride(experienceId: string, bulletId: string, text: string) {
    setSections((current) => current.map((section) => ({ ...section, entries: section.entries.map((entry) => entry.experienceId !== experienceId ? entry : { ...entry, bulletOverrides: { ...(entry.bulletOverrides ?? {}), [bulletId]: text } }) })));
  }
  function included(id: string) {
    return sections.some((section) =>
      section.entries.some((entry) => entry.experienceId === id),
    );
  }
  const draft = {
    ...resume,
    title,
    contact: { email, phone, city, linkedIn, portfolio },
    summary,
    skills: skills
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    sections,
    template,
  };
  const experienceRecords = Object.fromEntries(model.experiences.map((experience) => [experience.id, experience]));
  const liveAudit = auditResume(draft as ResumeDocumentRecord, experienceRecords);
  const studio = resumeStudioState(draft as ResumeDocumentRecord, experienceRecords, liveAudit);
  return (
    <>
    <section className={styles.studioStatus} aria-label="Resume studio status">
      <div>
        <p className="rule-label text-forest">Resume &amp; Application Studio</p>
        <h2>{title}</h2>
        <p><strong>Next:</strong> {studio.nextAction.label}. {studio.nextAction.detail}</p>
      </div>
      <dl>
        <div><dt>Confirmed facts</dt><dd>{studio.factsCount}</dd></div>
        <div><dt>Resume bullets</dt><dd>{studio.bulletsCount}</dd></div>
        <div><dt>Estimated pages</dt><dd>{liveAudit.layout.estimatedPages}</dd></div>
        <div><dt>Application use</dt><dd>{resume.usageCount}</dd></div>
      </dl>
      <div className={styles.modeTabs} role="tablist" aria-label="Studio mode">
        {(["edit", "review", "tailor", "preview"] as EditorMode[]).map((item) => <button key={item} type="button" role="tab" aria-selected={mode === item} onClick={() => setMode(item)}>{item}</button>)}
      </div>
    </section>
    <div className={styles.editorGrid} data-studio-mode={mode}>
      <section
        className={styles.editorPanel}
        aria-labelledby="resume-editor-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <p className="rule-label text-forest">Resume version</p>
            <h2 id="resume-editor-title">
              {resume.kind === "master" ? "Master resume" : "Targeted resume"}
            </h2>
          </div>
          <span className={styles.status}>{resume.statusLabel}</span>
        </div>
        <label>
          Version name
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <div className={styles.twoColumns}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Phone
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>
          <label>
            City
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
            />
          </label>
          <label>
            LinkedIn
            <input
              value={linkedIn}
              onChange={(event) => setLinkedIn(event.target.value)}
            />
          </label>
        </div>
        <label>
          Portfolio
          <input
            value={portfolio}
            onChange={(event) => setPortfolio(event.target.value)}
          />
        </label>
        <label>
          Summary <span>optional</span>
          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            rows={3}
          />
        </label>
        <label>
          Skills <span>comma separated, only what you can support</span>
          <input
            value={skills}
            onChange={(event) => setSkills(event.target.value)}
          />
        </label>
        <label>
          Resume template
          <select value={template} onChange={(event) => setTemplate(event.target.value as typeof template)}>
            <option value="classic">Classic</option>
            <option value="modern">Modern</option>
            <option value="technical">Technical</option>
            <option value="academic">Academic</option>
          </select>
        </label>
        <fieldset>
          <legend>Resume sections</legend>
          <div className={styles.sectionControls}>
            {sections.map((section, index) => <div key={section.id}>
              <label><input type="checkbox" checked={section.visible} onChange={() => setSections((current) => current.map((item) => item.id === section.id ? { ...item, visible: !item.visible } : item))} /><span>{section.title}</span></label>
              <button type="button" aria-label={`Move ${section.title} up`} disabled={index === 0} onClick={() => moveSection(index, -1)}>↑</button>
              <button type="button" aria-label={`Move ${section.title} down`} disabled={index === sections.length - 1} onClick={() => moveSection(index, 1)}>↓</button>
            </div>)}
          </div>
        </fieldset>
        <fieldset>
          <legend>Experience included</legend>
          {model.experiences.length ? (
            <div className={styles.checkList}>
              {model.experiences.map((experience) => (
                <label key={experience.id}>
                  <input
                    type="checkbox"
                    checked={included(experience.id)}
                    onChange={() => toggleExperience(experience)}
                  />
                  <span>
                    <strong>{experience.resolved.title}</strong>
                    <small>
                      {experience.resolved.organization} ·{" "}
                      {experience.bullets.length} bullet
                      {experience.bullets.length === 1 ? "" : "s"}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className={styles.quiet}>
              Add evidence in the Experience Bank first.
            </p>
          )}
        </fieldset>
        {sections.some((section) => section.entries.length) ? <details className={styles.bulletWorkshop}>
          <summary>Bullet workshop <span>Resume-specific wording</span></summary>
          <div>
            {sections.flatMap((section) => section.entries.map((entry) => ({ section, entry }))).map(({ entry }) => {
              const experience = model.experiences.find((item) => item.id === entry.experienceId);
              if (!experience) return null;
              return <section key={entry.experienceId}><h3>{experience.resolved.title}</h3><p>{experience.resolved.organization}</p>{entry.bulletIds.map((bulletId) => {
                const bullet = experience.bullets.find((item) => item.id === bulletId);
                if (!bullet) return null;
                const value = entry.bulletOverrides?.[bulletId] ?? bullet.text;
                const sourceFacts = experience.facts.filter((fact) => bullet.factIds.includes(fact.id) && fact.confirmed);
                const alternatives = bulletAlternatives(sourceFacts);
                return <div key={bulletId} className={styles.bulletEditor}><label>Resume wording<textarea rows={3} value={value} onChange={(event) => setBulletOverride(experience.id, bulletId, event.target.value)} /></label><aside><strong>Based on {sourceFacts.length} confirmed fact{sourceFacts.length === 1 ? "" : "s"}</strong>{sourceFacts.map((fact) => <span key={fact.id}>{fact.text}<small>{fact.sourceLabel ?? fact.source ?? "User confirmed"}</small></span>)}{alternatives.length ? <div className={styles.alternatives}>{alternatives.map((alternative) => <button type="button" key={alternative.label} onClick={() => setBulletOverride(experience.id, bulletId, alternative.text)}><strong>{alternative.label}</strong>{alternative.text}</button>)}</div> : null}{entry.bulletOverrides?.[bulletId] ? <button type="button" className={styles.resetWording} onClick={() => setBulletOverride(experience.id, bulletId, bullet.text)}>Use canonical wording</button> : null}{!experience.facts.some((fact) => fact.kind === "outcome") ? <small>Could this show known scale or a result? Add it only if you can confirm it.</small> : null}</aside></div>;
              })}</section>;
            })}
          </div>
        </details> : null}
        <div className={styles.targetRow}>
          <label>
            Target an opportunity
            <select
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
            >
              <option value="">Choose from Journey</option>
              {model.opportunities.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} · {item.organization}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="button button-secondary"
            disabled={!targetId}
            onClick={() => {
              const target = model.opportunities.find(
                (item) => item.id === targetId,
              );
              if (target)
                save(
                  {
                    action: "duplicate_resume",
                    idempotencyKey: makeKey(),
                    resumeId: resume.id,
                    title: `${target.organization} resume`,
                    target: {
                      type: "opportunity",
                      id: target.id,
                      label: target.title,
                    },
                  },
                  "Targeted resume created from this version.",
                );
            }}
          >
            Create targeted copy
          </button>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className="button button-primary"
            onClick={() =>
              save(
                {
                  action: "save_resume",
                  resumeId: resume.id,
                  expectedRecordVersion: resume.version,
                  title,
                  contact: draft.contact,
                  summary,
                  skills: draft.skills,
                  sections,
                  template,
                  materialStatus: "draft",
                },
                "Resume saved.",
              )
            }
          >
            Save draft
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={() =>
              save(
                {
                  action: "save_resume",
                  resumeId: resume.id,
                  expectedRecordVersion: resume.version,
                  title,
                  contact: draft.contact,
                  summary,
                  skills: draft.skills,
                  sections,
                  template,
                  materialStatus: "ready",
                },
                "Resume marked ready.",
              )
            }
          >
            Mark ready
          </button>
          <Link
            className="button button-secondary"
            href={`/resume-lab/print/${encodeURIComponent(resume.id)}`}
            target="_blank"
          >
            Download PDF / print
          </Link>
        </div>
      </section>
      <div>
        <ResumePreview resume={draft as ResumeDocumentView} model={model} />
        <section className={styles.audit}>
          <div className={styles.sectionHeading}>
            <h3>Resume review</h3>
            <span>
              {liveAudit.issues.length} item
              {liveAudit.issues.length === 1 ? "" : "s"}
            </span>
          </div>
          <p className={styles.layoutNote}>{liveAudit.layout.note}</p>
          <div className={styles.reviewCounts}>{Object.entries(liveAudit.counts).map(([category, count]) => <span key={category}><strong>{count}</strong>{category.replace("_", " ")}</span>)}</div>
          {liveAudit.issues.slice(0, mode === "review" ? 12 : 3).map((issue) => (
            <div key={issue.id} data-severity={issue.severity}>
              <strong>{issue.title}</strong><small>{issue.category.replace("_", " ")}</small>
              <p>{issue.detail}</p>
            </div>
          ))}
          {mode !== "review" && liveAudit.issues.length > 3 ? (
            <p className={styles.quiet}>
              {liveAudit.issues.length - 3} more items remain after these
              priorities.
            </p>
          ) : null}
          {!liveAudit.issues.length ? (
            <p className={styles.ready}>
              <CheckIcon /> No unsupported claims or structural issues found.
            </p>
          ) : null}
        </section>
        {(resume.revisions ?? []).length ? <details className={styles.history}><summary>Version history <span>{resume.revisions?.length}</span></summary><div>{[...(resume.revisions ?? [])].reverse().slice(0, 8).map((revision) => <article key={revision.id}><strong>Version {revision.version + 1} · {revision.title}</strong><span>{new Date(revision.createdAt).toLocaleString()} · {revision.template} · {revision.sections.filter((section) => section.visible).length} visible sections</span></article>)}</div></details> : null}
        {resume.target.type === "opportunity" ? (
          <section className={styles.alignment}>
            <h3>Compared with {resume.target.label ?? "target opportunity"}</h3>
            <p>{resume.alignment.note}</p>
            {resume.alignment.represented.length ? (
              <p>
                <strong>Represented:</strong>{" "}
                {resume.alignment.represented.join(", ")}
              </p>
            ) : null}
            {resume.alignment.notRepresented.length ? (
              <p>
                <strong>Not represented in this resume:</strong>{" "}
                {resume.alignment.notRepresented.slice(0, 8).join(", ")}
              </p>
            ) : null}
            {resume.alignment.availableElsewhere.length ? <p><strong>Available elsewhere in Experience Bank:</strong> {resume.alignment.availableElsewhere.slice(0, 8).join(", ")}</p> : null}
          </section>
        ) : null}
      </div>
    </div>
    </>
  );
}

function ExperienceForm({
  model,
  save,
  initialExperienceId,
}: {
  model: ResumeLabModel;
  save: (body: Record<string, unknown>, message: string) => void;
  initialExperienceId?: string;
}) {
  const [editing, setEditing] = useState<ResumeExperienceView | null>(null);
  const [title, setTitle] = useState("");
  const [organization, setOrganization] = useState("");
  const [kind, setKind] = useState("work");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [current, setCurrent] = useState(false);
  const [action, setAction] = useState("");
  const [collaboration, setCollaboration] = useState("");
  const [scope, setScope] = useState("");
  const [tools, setTools] = useState("");
  const [outcome, setOutcome] = useState("");
  const [skills, setSkills] = useState("");
  const [bullet, setBullet] = useState("");
  const [importText, setImportText] = useState("");
  const [confirmClaims, setConfirmClaims] = useState(false);
  function reset() {
    setEditing(null);
    setTitle("");
    setOrganization("");
    setKind("work");
    setLocation("");
    setStartDate("");
    setEndDate("");
    setCurrent(false);
    setAction("");
    setCollaboration("");
    setScope("");
    setTools("");
    setOutcome("");
    setSkills("");
    setBullet("");
    setImportText("");
    setConfirmClaims(false);
  }
  function beginEdit(experience: ResumeExperienceView) {
    setEditing(experience);
    setTitle(experience.resolved.title);
    setOrganization(experience.resolved.organization);
    setKind(experience.kind);
    setLocation(experience.resolved.location ?? "");
    setStartDate(experience.resolved.startDate?.slice(0, 7) ?? "");
    setEndDate(experience.resolved.endDate?.slice(0, 7) ?? "");
    setCurrent(experience.current);
    setAction(
      experience.facts.find((fact) => fact.kind === "action")?.text ?? "",
    );
    setCollaboration(experience.facts.find((fact) => fact.kind === "collaboration" || fact.kind === "audience")?.text ?? "");
    setScope(experience.facts.find((fact) => fact.kind === "scope" || fact.kind === "frequency")?.text ?? "");
    setTools(experience.facts.find((fact) => fact.kind === "tool" || fact.kind === "method")?.text ?? "");
    setOutcome(
      experience.facts.find((fact) => fact.kind === "outcome")?.text ?? "",
    );
    setSkills(experience.resolved.skills.join(", "));
    setBullet(experience.bullets[0]?.text ?? "");
    setConfirmClaims(Boolean(experience.bullets[0]?.confirmedClaims.length));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  useEffect(() => {
    const initialExperience = model.experiences.find((item) => item.id === initialExperienceId);
    if (initialExperience) beginEdit(initialExperience);
    // A deep link initializes the editor once; later model updates must not reset user input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialExperienceId]);
  function submit(event: FormEvent) {
    event.preventDefault();
    const factSeed = editing?.id ?? makeKey();
    const actionId =
      editing?.facts.find((fact) => fact.kind === "action")?.id ??
      `fact:${factSeed}:action`;
    const outcomeId =
      editing?.facts.find((fact) => fact.kind === "outcome")?.id ??
      `fact:${factSeed}:outcome`;
    const supplemental = [
      { kind: "collaboration" as ResumeFactKind, text: collaboration },
      { kind: "scope" as ResumeFactKind, text: scope },
      { kind: "tool" as ResumeFactKind, text: tools },
    ];
    const importLines = importText.split(/\n/).map((line) => line.replace(/^\s*[-•*]\s*/, "").trim()).filter(Boolean).slice(0, 12);
    const facts = [
      ...(editing?.facts.filter(
        (fact) => !["action", "outcome", "collaboration", "audience", "scope", "frequency", "tool", "method"].includes(fact.kind),
      ) ?? []),
      {
        id: actionId,
        kind: "action" as ResumeFactKind,
        text: action,
        confirmed: true,
        source: "user" as const,
      },
      ...supplemental.filter((fact) => fact.text.trim()).map((fact) => ({ id: editing?.facts.find((existing) => existing.kind === fact.kind)?.id ?? `fact:${factSeed}:${fact.kind}`, ...fact, confirmed: true, source: "user" as const })),
      ...(outcome
        ? [
            {
              id: outcomeId,
              kind: "outcome" as ResumeFactKind,
              text: outcome,
              confirmed: true,
              source: "user" as const,
            },
          ]
        : []),
      ...importLines.map((text, index) => ({ id: `fact:${factSeed}:import:${index}`, kind: "other" as ResumeFactKind, text, confirmed: true, source: "import" as const, sourceLabel: "Pasted resume text" })),
    ];
    const firstBullet = {
      id: editing?.bullets[0]?.id,
      text: bullet || undefined,
      factIds: facts.map((fact) => fact.id),
      confirmedClaims:
        confirmClaims && bullet
          ? extractClaims(bullet)
          : (editing?.bullets[0]?.confirmedClaims ?? []),
    };
    const remainingBullets =
      editing?.bullets
        .slice(1)
        .map((item) => ({
          id: item.id,
          text: item.text,
          factIds: item.factIds,
          confirmedClaims: item.confirmedClaims,
        })) ?? [];
    save(
      {
        action: "save_experience",
        idempotencyKey: editing ? undefined : makeKey(),
        experienceId: editing?.id,
        expectedRecordVersion: editing?.version,
        kind,
        organization,
        title,
        location,
        startDate,
        endDate: current ? undefined : endDate,
        current,
        skills: skills
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        facts,
        bullets: [firstBullet, ...remainingBullets],
      },
      editing
        ? "Experience updated."
        : "Experience added from confirmed facts.",
    );
    reset();
  }
  return (
    <div className={styles.bankGrid}>
      <form className={styles.editorPanel} onSubmit={submit}>
        <p className="rule-label text-forest">
          {editing ? "Edit evidence" : "Add evidence"}
        </p>
        <h2>Record facts first.</h2>
        <p className={styles.quiet}>
          UnlockED uses only what you enter or confirm. It never invents
          metrics, skills, or outcomes.
        </p>
        <div className={styles.twoColumns}>
          <label>
            Role or project
            <input
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label>
            Organization
            <input
              required
              value={organization}
              onChange={(event) => setOrganization(event.target.value)}
            />
          </label>
        </div>
        <div className={styles.twoColumns}>
          <label>
            Experience type
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              <option value="work">Work</option>
              <option value="internship">Internship</option>
              <option value="research">Research</option>
              <option value="project">Project</option>
              <option value="course_project">Course project</option>
              <option value="independent_project">Independent project</option>
              <option value="leadership">Leadership</option>
              <option value="campus_organization">Campus organization</option>
              <option value="teaching">Teaching or mentoring</option>
              <option value="athletics">Athletics</option>
              <option value="program">Program</option>
              <option value="volunteer">Volunteer</option>
              <option value="award">Award</option>
              <option value="scholarship">Scholarship</option>
              <option value="competition">Competition</option>
              <option value="publication">Publication</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            Location <span>optional</span>
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
          </label>
          <label>
            Start date <span>optional</span>
            <input
              type="month"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
          <label>
            End date <span>optional</span>
            <input
              type="month"
              value={endDate}
              disabled={current}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
        </div>
        <label className={styles.claimCheck}>
          <input
            type="checkbox"
            checked={current}
            onChange={(event) => setCurrent(event.target.checked)}
          />{" "}
          I currently hold this role or continue this project.
        </label>
        <label>
          What did you actually do?
          <textarea
            required
            rows={3}
            value={action}
            onChange={(event) => setAction(event.target.value)}
            placeholder="Use the exact action you can support."
          />
        </label>
        <div className={styles.discovery}>
          <p className="rule-label text-forest">Fact discovery</p>
          <h3>Prompts for this kind of experience</h3>
          <ul>{factDiscoveryQuestions(kind as ResumeExperienceView["kind"]).map((question) => <li key={question}>{question}</li>)}</ul>
          <small>Numbers are optional. Add scale only when you know it.</small>
        </div>
        <label>
          Who did you work with or help? <span>optional</span>
          <textarea rows={2} value={collaboration} onChange={(event) => setCollaboration(event.target.value)} />
        </label>
        <label>
          Scale or frequency <span>optional and never estimated</span>
          <textarea rows={2} value={scope} onChange={(event) => setScope(event.target.value)} placeholder="For example: weekly, 4-person team, 120 records — only if known." />
        </label>
        <label>
          Tools or methods used <span>optional</span>
          <textarea rows={2} value={tools} onChange={(event) => setTools(event.target.value)} />
        </label>
        <label>
          What happened? <span>optional</span>
          <textarea
            rows={2}
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
            placeholder="Add a known outcome. Do not estimate."
          />
        </label>
        <label>
          Skills used <span>optional, comma separated</span>
          <input
            value={skills}
            onChange={(event) => setSkills(event.target.value)}
          />
        </label>
        {!editing ? <details className={styles.importText}><summary>Paste an existing resume section</summary><p>Paste plain text to capture each non-empty bullet as a confirmed source fact. Review the text before saving; PDF and DOCX binaries are not stored.</p><textarea rows={6} value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="Paste role details or bullets here…" />{importText.trim() ? <small>{importText.split(/\n/).filter((line) => line.trim()).length} line(s) will be preserved in the Fact Ledger.</small> : null}</details> : null}
        {editing ? (
          <>
            <label>
              Resume bullet{" "}
              <span>edit without changing the underlying facts</span>
              <textarea
                rows={4}
                value={bullet}
                onChange={(event) => {
                  setBullet(event.target.value);
                  setConfirmClaims(false);
                }}
              />
            </label>
            {extractClaims(bullet).length ? (
              <label className={styles.claimCheck}>
                <input
                  type="checkbox"
                  checked={confirmClaims}
                  onChange={(event) => setConfirmClaims(event.target.checked)}
                />{" "}
                I can support the numeric claims in this bullet.
              </label>
            ) : null}
          </>
        ) : null}
        <div className={styles.actions}>
          <button className="button button-primary" type="submit">
            {editing ? "Save experience" : "Add to Experience Bank"}
          </button>
          {editing ? (
            <button
              className="button button-secondary"
              type="button"
              onClick={reset}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
      <section className={styles.bank}>
        <div className={styles.sectionHeading}>
          <div>
            <p className="rule-label text-forest">Experience Bank</p>
            <h2>Your reusable evidence.</h2>
          </div>
          <span>{model.experiences.length}</span>
        </div>
        {model.sourceAccomplishments.length ? (
          <div className={styles.imports} id="experience-inbox">
            <p className="rule-label text-forest">New experiences available</p>
            <h3>Review Accomplishments</h3>
            <p className={styles.quiet}>Choose what belongs in your Experience Bank. Nothing is added to a resume automatically.</p>
            {model.sourceAccomplishments.slice(0, 6).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  save(
                    {
                      action: "import_accomplishment",
                      idempotencyKey: makeKey(),
                      accomplishmentId: item.id,
                    },
                    "Accomplishment linked to Resume Lab.",
                  )
                }
              >
                <TrophyIcon />
                <span>
                  <strong>{item.title}</strong>
                  <small>
                    {item.organization} · {item.outcome} {item.year}
                  </small>
                </span>
                <ArrowIcon />
              </button>
            ))}
          </div>
        ) : null}
        {model.experiences.map((experience) => (
          <article key={experience.id} className={styles.experience}>
            <div className={styles.experienceHead}>
              <div>
                <span className={styles.source}>{experience.kind} · {experience.sourceLabel}</span>
                <h3>{experience.resolved.title}</h3>
                <p>{experience.resolved.organization}{experience.resolved.startDate ? ` · ${experience.resolved.startDate.slice(0, 7)}${experience.current ? " – Present" : experience.resolved.endDate ? ` – ${experience.resolved.endDate.slice(0, 7)}` : ""}` : ""}</p>
              </div>
              <button type="button" onClick={() => beginEdit(experience)}>
                Edit
              </button>
            </div>
            <dl>
              <div>
                <dt>Facts</dt>
                <dd>{experience.facts.length}</dd>
              </div>
              <div>
                <dt>Bullets</dt>
                <dd>{experience.bullets.length}</dd>
              </div>
              <div>
                <dt>Used in</dt>
                <dd>{experience.resumeUsageCount} {experience.resumeUsageCount === 1 ? "resume" : "resumes"}</dd>
              </div>
            </dl>
            {experience.bullets.map((bullet) => (
              <p key={bullet.id} className={styles.bullet}>
                {bullet.text}
              </p>
            ))}
          </article>
        ))}
        {!model.experiences.length ? (
          <div className={styles.empty}>
            <SparkIcon />
            <h3>Your evidence starts here.</h3>
            <p>
              Add one role, project, or accomplishment. Confirm the facts, then
              reuse them across resume versions.
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function ResumeLab({
  initial,
  initialTargetId,
  returnTo,
  initialView,
  initialResumeId,
  initialExperienceId,
}: {
  initial: ResumeLabModel;
  initialTargetId?: string;
  returnTo?: string;
  initialView?: Tab;
  initialResumeId?: string;
  initialExperienceId?: string;
}) {
  const [model, setModel] = useState(initial);
  const [tab, setTab] = useState<Tab>(initialView ?? (initial.resumes.length ? "resumes" : "experience"));
  const [selectedId, setSelectedId] = useState(initialResumeId ?? initial.resumes[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const selected = useMemo(
    () =>
      model.resumes.find((resume) => resume.id === selectedId) ??
      model.resumes[0],
    [model, selectedId],
  );
  const resumeStripRef = useLayoutContinuity<HTMLDivElement>(model.resumes.map((resume) => `${resume.id}:${resume.version}:${resume.statusLabel}`).join("|"));
  useEffect(() => {
    trackProductEvent("resume_lab_opened_v1");
  }, []);
  function save(body: Record<string, unknown>, success: string) {
    setError("");
    setMessage("");
    startTransition(async () => {
      try {
        const next = await mutate({
          ...body,
          expectedVersion: model.storeVersion,
        });
        setModel(next);
        if (
          body.action === "create_resume" ||
          body.action === "duplicate_resume"
        )
          setSelectedId(
            next.resumes.find(
              (item) => !model.resumes.some((old) => old.id === item.id),
            )?.id ??
              next.resumes[0]?.id ??
              "",
          );
        if (body.action === "create_resume")
          trackProductEvent("resume_created_v1", {
            category: String(body.kind ?? "unknown"),
          });
        if (body.action === "duplicate_resume")
          trackProductEvent("resume_targeted_v1");
        if (
          body.action === "save_experience" ||
          body.action === "import_accomplishment"
        )
          trackProductEvent("resume_experience_added_v1", {
            source:
              body.action === "import_accomplishment"
                ? "accomplishment"
                : "manual",
          });
        if (body.action === "save_resume" && body.materialStatus === "ready")
          trackProductEvent("resume_marked_ready_v1");
        setMessage(success);
        setTab(
          body.action === "save_experience" ||
            body.action === "import_accomplishment"
            ? "experience"
            : "resumes",
        );
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Resume Lab could not be updated.",
        );
      }
    });
  }
  return (
    <main className={styles.page} data-build-resume-lab="">
      <div className={styles.shell}>
        {returnTo ? (
          <Link
            href={returnTo}
            className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-forest hover:text-ink"
          >
            <ArrowIcon className="h-3 w-3 rotate-180" /> Back to application
          </Link>
        ) : null}
        <BuildNavigation current={tab === "experience" ? "experience" : "resumes"} />
        <header className={styles.hero}>
          <div>
            <p className="rule-label text-forest">Build</p>
            <h1>{tab === "experience" ? "Experience Bank" : "Resumes"}</h1>
            <p>
              {tab === "experience" ? "Keep confirmed facts once, then reuse them across every resume version." : "Shape confirmed experience into a complete source and focused application versions."}
            </p>
          </div>
          <div className={styles.heroActions}>
            <button
              type="button"
              onClick={() => {
                save(
                  {
                    action: "create_resume",
                    idempotencyKey: makeKey(),
                    title: model.resumes.length
                      ? "New targeted resume"
                      : "Master resume",
                    kind: model.resumes.length ? "targeted" : "master",
                    target: { type: "general" },
                  },
                  "Resume version created.",
                );
              }}
              className="button button-primary"
            >
              {model.resumes.length
                  ? "Create targeted version"
                  : "Create master resume"}
            </button>
            {!model.experiences.length ? <button type="button" className="button button-secondary" onClick={() => setTab("experience")}>Start with Experience Bank</button> : null}
          </div>
        </header>
        <nav className={styles.tabs} aria-label="Resume Lab sections">
          <button
            type="button"
            aria-current={tab === "experience" ? "page" : undefined}
            onClick={() => setTab("experience")}
          >
            <TrophyIcon /> Experience <span>{model.experiences.length}</span>
          </button>
          <button
            type="button"
            aria-current={tab === "resumes" ? "page" : undefined}
            onClick={() => setTab("resumes")}
          >
            <ListIcon /> Resumes <span>{model.resumes.length}</span>
          </button>
        </nav>
        <div className={styles.feedback} aria-live="polite">
          {pending ? "Saving…" : message}
          {error ? <span role="alert">{error}</span> : null}
        </div>
        {tab === "resumes" ? (
          model.resumes.length ? (
            <>
              <div ref={resumeStripRef} className={styles.resumeStrip}>
                {model.resumes.map((resume) => (
                  <button
                    key={resume.id}
                    data-motion-key={resume.id}
                    type="button"
                    aria-pressed={resume.id === selected?.id}
                    onClick={() => setSelectedId(resume.id)}
                  >
                    <span>
                      {resume.kind === "master" ? "Master" : "Targeted"}
                    </span>
                    <strong>{resume.title}</strong>
                    <small>
                      {resume.statusLabel} ·{" "}
                      {resume.usageCount
                        ? `used in ${resume.usageCount} application${resume.usageCount === 1 ? "" : "s"}`
                        : "not assigned"}
                    </small>
                  </button>
                ))}
              </div>
              {selected ? (
                <div key={`${selected.id}:${selected.version}:${initialTargetId ?? "general"}`} className={styles.resumeTransition} data-motion-surface="state">
                  <ResumeEditor
                    resume={selected}
                    model={model}
                    save={save}
                    initialTargetId={initialTargetId}
                  />
                </div>
              ) : null}
            </>
          ) : (
            <section className={styles.empty}>
              <PenLineIcon />
              <h2>Build from facts, not a blank page.</h2>
              <p>
                Add an experience first or create your master resume. UnlockED
                keeps resume versions connected to Materials.
              </p>
            </section>
          )
        ) : (
          <ExperienceForm model={model} save={save} initialExperienceId={initialExperienceId} />
        )}
      </div>
    </main>
  );
}
