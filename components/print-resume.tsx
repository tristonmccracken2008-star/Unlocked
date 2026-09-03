"use client";

import { useEffect } from "react";
import type { ResumeDocumentView, ResumeLabModel } from "@/lib/resume-lab";
import styles from "./print-resume.module.css";
import { trackProductEvent } from "@/data/product-analytics";

export function PrintResume({ model, resume }: { model: ResumeLabModel; resume: ResumeDocumentView }) {
  useEffect(() => { document.body.classList.add("resume-print-mode"); return () => document.body.classList.remove("resume-print-mode"); }, []);
  const byId = new Map(model.experiences.map((item) => [item.id, item]));
  return <main className={styles.page}><div className={styles.toolbar}><a href="/resume-lab">Back to Resume Studio</a><button type="button" onClick={() => { trackProductEvent("resume_export_opened_v1", { format: "print" }); window.print(); }}>Download PDF / print</button></div><article className={styles.paper} data-template={resume.template}>
    <header><h1>{model.profile.name}</h1><p>{[resume.contact.email, resume.contact.phone, resume.contact.city, resume.contact.linkedIn, resume.contact.portfolio].filter(Boolean).join(" · ")}</p></header>{resume.summary ? <p className={styles.summary}>{resume.summary}</p> : null}
    {resume.sections.filter((section) => section.visible).map((section) => <section key={section.id}><h2>{section.title}</h2>{section.kind === "education" ? <div className={styles.entry}><div><strong>{model.profile.school}</strong><span>{model.profile.major}</span></div><time>{model.profile.graduationYear}</time></div> : section.kind === "skills" ? <p>{resume.skills.join(" · ")}</p> : section.entries.map((entry) => { const experience = byId.get(entry.experienceId); if (!experience) return null; return <div key={entry.experienceId} className={styles.entry}><div><strong>{experience.resolved.title}</strong><span>{experience.resolved.organization}{experience.resolved.location ? ` · ${experience.resolved.location}` : ""}</span></div><time>{[experience.resolved.startDate, experience.current ? "Present" : experience.resolved.endDate].filter(Boolean).join(" – ")}</time><ul>{entry.bulletIds.map((bulletId) => { const bullet = experience.bullets.find((item) => item.id === bulletId); return bullet ? <li key={bulletId}>{entry.bulletOverrides?.[bulletId] ?? bullet.text}</li> : null; })}</ul></div>; })}</section>)}
  </article></main>;
}
