import assert from "node:assert/strict";
import { opportunities } from "../data/opportunities";
import { emptyOpportunityPassport, normalizeOpportunityPassport } from "../data/passport";
import { buildPassportView } from "../lib/passport";
import type { AccountData } from "../lib/account-types";

const opportunity = opportunities[0]!;
const now = "2026-09-04T12:00:00.000Z";
const account = {
  profile: { firstName: "Avery", lastName: "Chen", schoolSlug: "uchicago", schoolName: "University of Chicago", major: "Mathematics", secondaryMajor: "Computer Science", graduationYear: "2030", year: "First year", careerGoal: "Explore quantitative research", interests: "statistics", specificCareerInterests: ["Quantitative Trading"] },
  onboardingComplete: true, firstLaunchComplete: true, billing: {}, activity: null, savedOpportunities: [], watchedOpportunities: [], tracker: {}, preferences: null, journeyProgress: {}, calendarEvents: {}, applicationWorkspaces: {}, answerBank: { records: {}, version: 0 }, applicationMaterials: { records: {}, associations: {}, version: 0 },
  resumeLab: { experiences: { "experience:project": { id: "experience:project", source: "manual", kind: "project", organization: "Student Lab", title: "Credit Risk Model", current: false, skills: ["Python", "Statistics"], facts: [{ id: "fact:one", kind: "creation", text: "Built and evaluated a credit-risk model.", confirmed: true, source: "user" }], bullets: [], createdAt: now, updatedAt: now, version: 0 } }, resumes: {}, version: 0, updatedAt: now },
  accomplishments: { "manual:award": { id: "manual:award", source: "manual", snapshot: { title: "Research Prize", organization: "Student Lab", capturedAt: now }, kind: "research", outcome: "awarded", outcomeDate: "2026-05-10", description: "Selected for careful empirical work.", notes: "Private mentor feedback", skills: ["Statistics"], hidden: false, createdAt: now, updatedAt: now, version: 0 } },
  passport: { ...emptyOpportunityPassport(now), sharingEnabled: true, shareToken: "abcdefghijklmnopqrstuvwxyz123456", showSchool: true, showAcademicDetails: false, showCareerInterests: true, visibleAccomplishmentIds: ["manual:award"], visibleExperienceIds: [], highlightIds: ["manual:award"], manualEvents: [{ id: "manual:service", title: "Neighborhood data clinic", date: "2026-04-12", kind: "service", skills: ["Data communication"], visibility: "passport", createdAt: now }, { id: "manual:private", title: "Private reflection", date: "2026-04-13", kind: "milestone", skills: [], visibility: "private", createdAt: now }], collections: [] }, pathPreferences: {}, guidance: {}, advisor: null, referrals: null, updatedAt: now,
} as unknown as AccountData;

const normalized = normalizeOpportunityPassport(account.passport);
assert.equal(normalized.highlightIds.length, 1);
const privateView = buildPassportView({ user: { name: "Avery Chen" }, account, opportunities: [opportunity] });
const publicView = buildPassportView({ user: { name: "Avery Chen" }, account, opportunities: [opportunity], publicOnly: true });
assert.equal(privateView.projects.length, 1, "Private Passport should project the Experience Bank");
assert.equal(publicView.projects.length, 0, "Unselected Experience Bank records must stay private");
assert.equal(publicView.identity.school, "University of Chicago");
assert.equal(publicView.identity.major, undefined, "Academic details must follow their separate visibility toggle");
assert(publicView.timeline.some((item) => item.id === "manual:service"));
assert(!publicView.timeline.some((item) => item.id === "manual:private"));
assert.equal(publicView.highlights[0]?.title, "Research Prize");
assert(!JSON.stringify(publicView).includes("Private mentor feedback"), "Private accomplishment notes must never enter the public projection");
assert(publicView.skills.some((skill) => skill.name === "Statistics" && skill.evidence.length === 1));
console.log("Opportunity Passport projection, evidence, and privacy checks passed.");
