import Link from "next/link";
import type { BuildWorkspaceModel } from "@/lib/build-workspace";
import {
  ArrowIcon,
  CheckIcon,
  ListIcon,
  PenLineIcon,
  TrophyIcon,
} from "./icons";
import { BuildNavigation } from "./build-navigation";
import styles from "./build-workspace.module.css";

function relativeDate(value: string) {
  const days = Math.max(
    0,
    Math.round((Date.now() - Date.parse(value)) / 86_400_000),
  );
  if (days === 0) return "Updated today";
  if (days === 1) return "Updated yesterday";
  if (days < 30) return `Updated ${days} days ago`;
  return `Updated ${new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(value))}`;
}

export function BuildWorkspace({ model }: { model: BuildWorkspaceModel }) {
  const { resumeLab, materials, mainResume } = model;
  return (
    <main className={styles.page} data-build-workspace="">
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className="rule-label text-forest">Build</p>
            <h1>Turn experience into materials you can use.</h1>
            <p>
              Keep the facts once. Shape them into resumes and reuse the right
              version in each application.
            </p>
          </div>
          <BuildNavigation current="overview" />
        </header>

        <section className={styles.next} aria-labelledby="build-next-heading">
          <div>
            <p className="rule-label">Next in Build</p>
            <h2 id="build-next-heading">{model.nextAction.label}</h2>
            <p>{model.nextAction.detail}</p>
          </div>
          <Link href={model.nextAction.href} className="button button-primary">
            Continue <ArrowIcon />
          </Link>
        </section>

        <div className={styles.flow} aria-label="How Build works">
          <span>
            <TrophyIcon /> Experience
          </span>
          <ArrowIcon />
          <span>
            <PenLineIcon /> Resumes
          </span>
          <ArrowIcon />
          <span>
            <ListIcon /> Materials
          </span>
          <ArrowIcon />
          <span>
            <CheckIcon /> Application use
          </span>
        </div>

        <section
          className={styles.primary}
          aria-labelledby="main-resume-heading"
        >
          <div className={styles.sectionIntro}>
            <p className="rule-label text-forest">Your main resume</p>
            <h2 id="main-resume-heading">
              {mainResume?.title ?? "Master resume"}
            </h2>
            <p>
              {mainResume
                ? "Your complete source. Create targeted versions when an application needs a different emphasis."
                : "Create one complete source from your Experience Bank, then tailor copies without retyping your history."}
            </p>
          </div>
          {mainResume ? (
            <article className={styles.resumeFeature}>
              <div>
                <span>
                  {mainResume.kind === "master" ? "Master resume" : "Resume"}
                </span>
                <h3>{mainResume.title}</h3>
                <p>
                  {mainResume.statusLabel} ·{" "}
                  {mainResume.usageCount
                    ? `Used in ${mainResume.usageCount} ${mainResume.usageCount === 1 ? "application" : "applications"}`
                    : "Not assigned to an application"}
                </p>
              </div>
              <div className={styles.resumeMeta}>
                <span>{relativeDate(mainResume.updatedAt)}</span>
                {mainResume.audit.issues.length ? (
                  <span>
                    {mainResume.audit.issues.length}{" "}
                    {mainResume.audit.issues.length === 1 ? "item" : "items"} to
                    review
                  </span>
                ) : (
                  <span>
                    <CheckIcon /> Review clear
                  </span>
                )}
              </div>
              <Link
                href={`/resume-lab?view=resumes&resume=${encodeURIComponent(mainResume.id)}`}
              >
                Open resume <ArrowIcon />
              </Link>
            </article>
          ) : (
            <Link
              className={styles.emptyAction}
              href="/resume-lab?view=resumes"
            >
              <PenLineIcon />
              <span>
                <strong>Create your master resume</strong>
                <small>
                  Start from confirmed experience and profile education.
                </small>
              </span>
              <ArrowIcon />
            </Link>
          )}
        </section>

        <div className={styles.columns}>
          <section aria-labelledby="experience-heading">
            <div className={styles.sectionHeader}>
              <div>
                <p className="rule-label text-forest">Experience Bank</p>
                <h2 id="experience-heading">Facts you can reuse</h2>
              </div>
              <Link href="/resume-lab?view=experience">
                Open <ArrowIcon />
              </Link>
            </div>
            <p className={styles.sectionCopy}>
              {resumeLab.experiences.length
                ? `${resumeLab.experiences.length} ${resumeLab.experiences.length === 1 ? "experience" : "experiences"} recorded`
                : "Jobs, projects, research, activities, and other confirmed work belong here."}
            </p>
            {resumeLab.sourceAccomplishments.length ? (
              <Link
                id="experience-inbox"
                href="/resume-lab?view=experience#experience-inbox"
                className={styles.inbox}
              >
                <TrophyIcon />
                <span>
                  <strong>
                    {resumeLab.sourceAccomplishments.length} new{" "}
                    {resumeLab.sourceAccomplishments.length === 1
                      ? "accomplishment"
                      : "accomplishments"}{" "}
                    to review
                  </strong>
                  <small>Nothing is added to a resume automatically.</small>
                </span>
                <ArrowIcon />
              </Link>
            ) : null}
            <div className={styles.compactList}>
              {resumeLab.experiences.slice(0, 4).map((experience) => (
                <Link
                  key={experience.id}
                  href={`/resume-lab?view=experience&experience=${encodeURIComponent(experience.id)}`}
                >
                  <div>
                    <strong>{experience.resolved.title}</strong>
                    <span>
                      {experience.resolved.organization || experience.kind}
                    </span>
                  </div>
                  <small>
                    {model.experienceUsage[experience.id]
                      ? `Used in ${model.experienceUsage[experience.id]} ${model.experienceUsage[experience.id] === 1 ? "resume" : "resumes"}`
                      : "Not yet used"}
                  </small>
                </Link>
              ))}
            </div>
          </section>

          <section aria-labelledby="versions-heading">
            <div className={styles.sectionHeader}>
              <div>
                <p className="rule-label text-forest">Other resumes</p>
                <h2 id="versions-heading">Versions with a purpose</h2>
              </div>
              <Link href="/resume-lab?view=resumes">
                View all <ArrowIcon />
              </Link>
            </div>
            <p className={styles.sectionCopy}>
              Targeted versions reuse the same facts while changing what you
              include and emphasize.
            </p>
            <div className={styles.compactList}>
              {model.recentResumes.map((resume) => (
                <Link
                  key={resume.id}
                  href={`/resume-lab?view=resumes&resume=${encodeURIComponent(resume.id)}`}
                >
                  <div>
                    <strong>{resume.title}</strong>
                    <span>
                      {resume.target.label ??
                        (resume.kind === "master"
                          ? "Complete source"
                          : "General target")}
                    </span>
                  </div>
                  <small>
                    {resume.statusLabel}
                    {resume.usageCount
                      ? ` · ${resume.usageCount} use${resume.usageCount === 1 ? "" : "s"}`
                      : ""}
                  </small>
                </Link>
              ))}
            </div>
            {!model.recentResumes.length ? (
              <div className={styles.quietEmpty}>
                <p>No targeted versions yet.</p>
                <span>
                  Create one when a specific application needs a different
                  emphasis.
                </span>
              </div>
            ) : null}
          </section>
        </div>

        <section
          className={styles.materials}
          aria-labelledby="materials-heading"
        >
          <div className={styles.sectionHeader}>
            <div>
              <p className="rule-label text-forest">Materials</p>
              <h2 id="materials-heading">Reusable application assets</h2>
            </div>
            <Link href="/materials">
              Open Materials <ArrowIcon />
            </Link>
          </div>
          <p className={styles.sectionCopy}>
            Records for resumes, transcripts, statements, references, and other
            assets. Files remain wherever you store them.
          </p>
          <div className={styles.materialSummary}>
            <span>
              <strong>
                {
                  materials.records.filter((item) => item.status !== "archived")
                    .length
                }
              </strong>{" "}
              active records
            </span>
            <span>
              <strong>{model.readyMaterialCount}</strong> marked ready
            </span>
            <span>
              <strong>{model.applicationNeedCount}</strong> active{" "}
              {model.applicationNeedCount === 1
                ? "application needs"
                : "applications need"}{" "}
              materials
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}
