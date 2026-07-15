import type { NarrativeTemplateParameters } from "./types";

export const openLineNarrativeTemplates = {
  "origin.title": "Your path began",
  "origin.empty.body": "No journey activity has been recorded yet.",
  "origin.started.body": "This is the earliest activity UnlockED can verify.",
  "origin.explanation": "Every path begins with one meaningful choice.",

  "editorial.story.career": "You’re building the experience to pursue {direction}.",
  "editorial.story.direction": "You’re building experience through {direction}.",
  "editorial.story.moment": "{statement}",
  "editorial.story.progress": "Your path is taking shape through real choices and action.",
  "editorial.story.empty": "Every path begins with one meaningful choice.",

  "event.viewed.title": "Explored {categoryTitle}",
  "event.saved.named.title": "Saved {opportunityTitle}",
  "event.saved.generic.title": "Saved a {category} opportunity",
  "event.chosen.named.title": "Chose {opportunityTitle}",
  "event.chosen.generic.title": "Chose a {category} opportunity",
  "event.started.named.title": "Started {opportunityTitle}",
  "event.started.generic.title": "Started a {category} application",
  "event.submitted.named.title": "Submitted {opportunityTitle}",
  "event.submitted.generic.title": "Submitted a {category} application",
  "event.interview.named.title": "Interviewed for {opportunityTitle}",
  "event.interview.generic.title": "Reached a {category} interview",
  "event.accepted.named.title": "Accepted to {opportunityTitle}",
  "event.accepted.generic.title": "Accepted a {category} opportunity",
  "event.completed.named.title": "Completed {opportunityTitle}",
  "event.completed.generic.title": "Completed a {category} opportunity",
  "event.skill.named.title": "Created evidence through {evidenceLabel}",
  "event.skill.generic.title": "Created {categoryTitle} evidence",
  "event.direction.selected.title": "Chose {direction}",
  "event.direction.changed.title": "Changed direction to {direction}",
  "event.direction.paused.title": "Paused {direction}",
  "event.opportunity.resumed.title": "Resumed {opportunityTitle}",
  "event.direction.closed.title": "Closed {direction}",

  "event.viewed.first.body": "You started exploring {categoryPlural}.",
  "event.viewed.repeated.body": "You explored another {category} opportunity.",
  "event.saved.first.body": "You began exploring {categoryPlural}.",
  "event.saved.repeated.body": "You saved another {category} opportunity to review.",
  "event.chosen.first.body": "You chose a {category} opportunity to move forward with.",
  "event.chosen.repeated.body": "You chose another {category} opportunity to pursue.",
  "event.started.first.body": "A {category} opportunity became an active application.",
  "event.started.repeated.body": "You started another {category} application.",
  "event.submitted.first.body": "You submitted your first {category} application.",
  "event.submitted.repeated.body": "You submitted another {category} application.",
  "event.interview.first.body": "Your {category} application moved forward to an interview.",
  "event.interview.repeated.body": "Another {category} application moved forward to an interview.",
  "event.accepted.first.body": "You received your first accepted {category} opportunity.",
  "event.accepted.repeated.body": "You received another accepted {category} opportunity.",
  "event.completed.first.body": "You completed a {category} opportunity and created evidence of your experience.",
  "event.completed.repeated.body": "You completed another {category} opportunity.",
  "event.skill.first.body": "Your completed work now provides evidence of {skills}.",
  "event.skill.repeated.body": "Your completed work added more evidence of {skills}.",
  "event.direction.selected.body": "{direction} became a direction you chose to pursue.",
  "event.direction.changed.from.body": "You shifted your direction from {previousDirection} to {direction}.",
  "event.direction.changed.body": "You shifted your direction to {direction}.",
  "event.direction.expanded.body": "{direction} became another direction you chose to explore.",
  "event.direction.paused.body": "You paused {direction} while focusing elsewhere.",
  "event.opportunity.resumed.body": "You returned to this {category} direction and made it active again.",
  "event.direction.closed.body": "This opportunity ended, but the broader {direction} direction remains part of your history.",
  "event.opportunity.closed.body": "This {category} opportunity ended, but the broader direction remains open.",

  "explanation.exploration": "Exploration gives later choices a clearer point of comparison.",
  "explanation.direction": "Future recommendations can become more specific around this direction.",
  "explanation.direction.changed": "Your current direction changed without erasing prior work.",
  "explanation.direction.paused": "This direction is not active for now, and its history remains available.",
  "explanation.direction.resumed": "This direction is active again without losing the progress you made before pausing.",
  "explanation.direction.closed": "The closed opportunity no longer needs attention; related directions remain available.",
  "explanation.chosen": "Exploration became a direction you intend to act on.",
  "explanation.started": "You moved from considering this opportunity to preparing a real application.",
  "explanation.submitted": "You now have real application experience you can build on.",
  "explanation.interview": "Someone outside UnlockED responded to your application.",
  "explanation.accepted": "You now have a confirmed opportunity to turn preparation into experience.",
  "explanation.completed": "Your work has become evidence you can reuse in future applications and interviews.",
  "explanation.completed.skills": "Your work now provides evidence of {skills} that you can reuse in future applications and interviews.",
  "explanation.skill": "This evidence can support future applications that ask for {skills}.",

  "moment.exploration.merged.title": "Explored {categoryTitle}",
  "moment.exploration.merged.body": "You explored several {categoryPlural}.",
  "moment.exploration.merged.explanation": "Comparing several options gives later choices a stronger basis.",
  "moment.rejoin.title": "Two directions now support the same goal",
  "moment.rejoin.shared-skill.body": "{sourceOne} and {sourceTwo} now both provide evidence of {skills}.",
  "moment.rejoin.shared-goal.body": "{sourceOne} and {sourceTwo} now both support {target}.",
  "moment.rejoin.experience.body": "Completed experience from {sourceOne} now strengthens {target}.",
  "moment.rejoin.synthesis.body": "{sourceOne} and {sourceTwo} now combine in support of {target}.",
  "moment.rejoin.explanation": "Evidence from separate directions can now support the same next step.",

  "waypoint.early-program": "Early {category} programs help {yearLabel} students build experience before later recruiting begins.",
  "waypoint.skill": "This step builds {skills} before later {category} work.",
  "waypoint.before": "This step is useful before {recommendedBefore}.",
  "waypoint.unlocks": "Completing this step prepares you for {unlocks}.",
  "waypoint.roadmap": "This milestone prepares you for later academic and career steps.",
  "waypoint.opportunity": "This is a concrete next step toward {categoryPlural}.",
  "waypoint.fallback": "This is the next structured step in your current path.",

  "horizon.skill": "Building {skills} strengthens your preparation for {title}.",
  "horizon.prerequisite": "Completing the related milestone can prepare you to pursue {title}.",
  "horizon.progress": "Your current progress can prepare you to pursue {title}.",
} as const;

export type OpenLineNarrativeTemplateKey = keyof typeof openLineNarrativeTemplates;

const categoryLabels: Record<string, { singular: string; plural: string; title: string }> = {
  "ai tool": { singular: "AI tool", plural: "AI tools", title: "AI Tools" },
  "campus job": { singular: "campus job", plural: "campus jobs", title: "Campus Jobs" },
  "career": { singular: "career program", plural: "career programs", title: "Career Programs" },
  "competition": { singular: "competition", plural: "competitions", title: "Competitions" },
  "fellowship": { singular: "fellowship", plural: "fellowships", title: "Fellowships" },
  "internship": { singular: "internship", plural: "internships", title: "Internships" },
  "research": { singular: "research", plural: "research opportunities", title: "Research" },
  "scholarship": { singular: "scholarship", plural: "scholarships", title: "Scholarships" },
  "student benefit": { singular: "student benefit", plural: "student benefits", title: "Student Benefits" },
};

function cleanLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function titleCase(value: string) {
  return value.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()).trim();
}

export function narrativeCategoryLabels(value: string | undefined) {
  const normalized = cleanLabel(value?.toLowerCase() || "opportunity");
  const known = categoryLabels[normalized];
  if (known) return known;
  const singular = normalized.replace(/s$/, "") || "opportunity";
  return { singular, plural: normalized.endsWith("s") ? normalized : `${normalized}s`, title: titleCase(normalized) };
}

export function narrativeDisplayLabel(value: string | undefined, fallback = "a direction") {
  const cleaned = cleanLabel(value ?? "");
  return cleaned || fallback;
}

export function narrativeList(values: readonly string[], fallback: string) {
  const cleaned = [...new Set(values.map(cleanLabel).filter(Boolean))];
  if (!cleaned.length) return fallback;
  if (cleaned.length === 1) return cleaned[0];
  if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
  return `${cleaned.slice(0, -1).join(", ")}, and ${cleaned.at(-1)}`;
}

export function renderNarrativeTemplate(key: OpenLineNarrativeTemplateKey, parameters: NarrativeTemplateParameters = {}) {
  const template = openLineNarrativeTemplates[key];
  if (!template.includes("{")) return template;
  return template.replace(/\{([a-zA-Z0-9]+)\}/g, (_match, name: string) => {
    const value = parameters[name];
    if (value === undefined || value === null || String(value).trim() === "") throw new Error(`Missing narrative template parameter: ${name}`);
    return String(value);
  });
}

export function getNarrativeTemplatePlaceholders(key: OpenLineNarrativeTemplateKey) {
  return [...openLineNarrativeTemplates[key].matchAll(/\{([a-zA-Z0-9]+)\}/g)].map((match) => match[1]);
}
