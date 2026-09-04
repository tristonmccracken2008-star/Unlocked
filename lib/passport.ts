import "server-only";

import crypto from "node:crypto";
import type { AccountData, AuthUser } from "./account-types";
import type { Opportunity } from "@/data/opportunities";
import { normalizeOpportunityPassport, type OpportunityPassport, type PassportCollection } from "@/data/passport";
import { normalizeResumeLabStore, type ResumeExperienceKind } from "@/data/resume-lab";
import { buildAccomplishmentsModel } from "./accomplishments";

export type PassportStoryItem = {
  id: string; source: "journey" | "student" | "experience"; kind: string; title: string; organization?: string;
  date: string; description?: string; skills: string[]; opportunityId?: string; outcome?: string;
};
export type PassportExperience = PassportStoryItem & { current?: boolean };
export type PassportSkill = { name: string; evidence: Array<{ id: string; title: string }>; supported: boolean };
export type PassportCollectionView = { id: string; title: string; description?: string; shareToken?: string; sharingEnabled: boolean; opportunities: Array<{ id: string; title: string; organization: string; type: string; deadline?: string | null }> };
export type PassportView = {
  identity: { name: string; firstName: string; school?: string; major?: string; secondaryMajor?: string; minor?: string; graduationYear?: string; headline?: string; careerInterests: string[] };
  sharingEnabled: boolean; shareToken?: string; sections: OpportunityPassport["sectionOrder"];
  highlights: PassportStoryItem[]; timeline: PassportStoryItem[]; experiences: PassportExperience[]; projects: PassportExperience[];
  accomplishments: PassportStoryItem[]; skills: PassportSkill[]; collections: PassportCollectionView[]; updatedAt: string;
};

const projectKinds = new Set<ResumeExperienceKind>(["project", "course_project", "independent_project"]);
const displayDate = (value?: string) => value && /^\d{4}-\d{2}/.test(value) ? value.slice(0, 10) : new Date().toISOString().slice(0, 10);
const unique = <T,>(items: T[]) => [...new Set(items)];

export function generatePublicToken() { return crypto.randomBytes(24).toString("base64url"); }

export function buildPassportView(input: { user: Pick<AuthUser, "name">; account: AccountData; opportunities: readonly Opportunity[]; publicOnly?: boolean }): PassportView {
  const passport = normalizeOpportunityPassport(input.account.passport);
  const profile = input.account.profile;
  const opportunityById = new Map(input.opportunities.map((item) => [item.id, item]));
  const accomplishmentsModel = buildAccomplishmentsModel({ account: input.account, opportunities: input.opportunities });
  const publicOnly = Boolean(input.publicOnly);
  const accomplishmentRecords = accomplishmentsModel.records.filter((item) => !publicOnly || passport.visibleAccomplishmentIds.includes(item.id));
  const accomplishments: PassportStoryItem[] = accomplishmentRecords.map((item) => ({ id: item.id, source: item.source === "journey" ? "journey" : "student", kind: item.kindLabel, title: item.projectTitle || item.roleTitle || item.snapshot.title, organization: item.snapshot.organization, date: item.outcomeDate, description: item.description, skills: item.skills ?? [], opportunityId: item.canonicalOpportunityId, outcome: item.outcomeLabel }));
  const experienceStore = normalizeResumeLabStore(input.account.resumeLab);
  const allExperiences: PassportExperience[] = Object.values(experienceStore.experiences).map((item) => {
    const accomplishment = item.accomplishmentId ? accomplishmentRecords.find((candidate) => candidate.id === item.accomplishmentId) : undefined;
    return { id: item.id, source: "experience" as const, kind: item.kind.replaceAll("_", " "), title: item.title || accomplishment?.roleTitle || accomplishment?.projectTitle || accomplishment?.snapshot.title || "Untitled experience", organization: item.organization || accomplishment?.snapshot.organization, date: displayDate(item.startDate || item.createdAt), description: item.facts.find((fact) => fact.confirmed)?.text, skills: unique([...(item.skills ?? []), ...(accomplishment?.skills ?? [])]), opportunityId: accomplishment?.canonicalOpportunityId, current: item.current };
  }).filter((item) => !publicOnly || passport.visibleExperienceIds.includes(item.id));
  const manual = passport.manualEvents.filter((item) => !publicOnly || item.visibility === "passport").map((item): PassportStoryItem => ({ id: item.id, source: "student", kind: item.kind, title: item.title, organization: item.organization, date: item.date, description: item.description, skills: item.skills }));
  const tracked = { ...(input.account.activity?.tracked ?? {}), ...(input.account.tracker ?? {}) };
  const meaningfulJourney: PassportStoryItem[] = Object.values(tracked).flatMap((record) => {
    const opportunity = opportunityById.get(record.id); if (!opportunity) return [];
    const status = record.status;
    if (!["Submitted", "Interview", "Accepted", "Completed"].includes(status)) return [];
    const id = `journey-event:${record.id}:${status.toLowerCase()}`;
    if (publicOnly && !passport.visibleAccomplishmentIds.includes(`journey:${record.id}`)) return [];
    const label = status === "Submitted" ? "Applied" : status;
    return [{ id, source: "journey" as const, kind: opportunity.type, title: opportunity.title, organization: opportunity.organization, date: displayDate(record.updatedAt), skills: [], opportunityId: opportunity.id, outcome: label }];
  });
  const timelineById = new Map<string, PassportStoryItem>();
  for (const item of [...meaningfulJourney, ...accomplishments, ...manual]) timelineById.set(item.id, item);
  const timeline = [...timelineById.values()].sort((a, b) => b.date.localeCompare(a.date));
  const evidence = [...accomplishments, ...allExperiences, ...manual];
  const skillMap = new Map<string, Array<{ id: string; title: string }>>();
  for (const item of evidence) for (const skill of item.skills) skillMap.set(skill, [...(skillMap.get(skill) ?? []), { id: item.id, title: item.title }]);
  const skills = [...skillMap.entries()].map(([name, items]) => ({ name, evidence: items.slice(0, 4), supported: true })).sort((a, b) => b.evidence.length - a.evidence.length || a.name.localeCompare(b.name));
  const allItems = [...accomplishments, ...allExperiences, ...manual];
  const highlights = passport.highlightIds.flatMap((id) => allItems.find((item) => item.id === id) ?? []).slice(0, 6);
  const collections = passport.collections.map((collection) => collectionView(collection, opportunityById)).filter((collection) => !publicOnly || collection.sharingEnabled);
  const firstName = profile?.firstName || input.user.name.split(/\s+/)[0] || "Student";
  const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || input.user.name;
  return {
    identity: { name, firstName, school: !publicOnly || passport.showSchool ? profile?.schoolName : undefined, major: !publicOnly || passport.showAcademicDetails ? profile?.major : undefined, secondaryMajor: !publicOnly || passport.showAcademicDetails ? profile?.secondaryMajor : undefined, minor: !publicOnly || passport.showAcademicDetails ? profile?.minor : undefined, graduationYear: !publicOnly || passport.showAcademicDetails ? profile?.graduationYear : undefined, headline: passport.headline, careerInterests: !publicOnly || passport.showCareerInterests ? unique(profile?.specificCareerInterests ?? []) : [] },
    sharingEnabled: passport.sharingEnabled, shareToken: passport.shareToken, sections: passport.sectionOrder,
    highlights, timeline, experiences: allExperiences.filter((item) => !projectKinds.has(item.kind.replaceAll(" ", "_") as ResumeExperienceKind)), projects: allExperiences.filter((item) => projectKinds.has(item.kind.replaceAll(" ", "_") as ResumeExperienceKind)), accomplishments, skills, collections, updatedAt: passport.updatedAt,
  };
}

function collectionView(collection: PassportCollection, opportunityById: Map<string, Opportunity>): PassportCollectionView {
  return { id: collection.id, title: collection.title, description: collection.description, shareToken: collection.shareToken, sharingEnabled: collection.sharingEnabled, opportunities: collection.opportunityIds.flatMap((id) => { const item = opportunityById.get(id); return item ? [{ id: item.id, title: item.title, organization: item.organization, type: item.type, deadline: item.application_deadline }] : []; }) };
}
