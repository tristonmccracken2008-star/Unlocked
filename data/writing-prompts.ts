import type { WritingPrompt, WritingPromptType } from "./writing";

const cycle = "2026–27";
const verifiedAt = "2026-09-11";
const commonAppSource = "https://www.commonapp.org/apply/essay-prompts/";

const commonAppPrompts: Array<[string, string, string, WritingPromptType]> = [
  ["background", "Background, identity, interest, or talent", "Share a story about a background, identity, interest, or talent that is meaningful to you.", "identity"],
  ["obstacle", "Challenge, setback, or failure", "Reflect on an obstacle and what you learned from the experience.", "challenge"],
  ["belief", "Questioning a belief or idea", "Reflect on a time you questioned or challenged a belief or idea.", "intellectual_curiosity"],
  ["gratitude", "A surprising act of gratitude", "Reflect on an act that made you thankful and how that gratitude affected you.", "personal_statement"],
  ["growth", "A period of personal growth", "Discuss an event or realization that led to personal growth or new understanding.", "personal_statement"],
  ["curiosity", "An absorbing topic or idea", "Describe a subject that absorbs your attention and explain why.", "intellectual_curiosity"],
  ["choice", "Topic of your choice", "Share an essay on a topic of your choice.", "personal_statement"],
];

const personalStatementPrompts: WritingPrompt[] = commonAppPrompts.map(([id, title, text, type]) => ({
  id: "common-app-2026-" + id,
  cycle,
  type,
  title,
  text,
  wordLimit: 650,
  required: false,
  provider: "common_app",
  applicationPlans: [],
  sourceLabel: "Common Application",
  sourceUrl: commonAppSource,
  lastVerified: verifiedAt,
  verificationStatus: "verified",
}));

const supplements: WritingPrompt[] = [
  {
    id: "northwestern-2026-context",
    institutionId: "147767",
    institutionName: "Northwestern University",
    cycle,
    type: "community",
    title: "Personal context",
    text: "What parts of your background or setting have most shaped how you see yourself engaging in Northwestern’s community?",
    wordLimit: 300,
    required: true,
    provider: "institution",
    applicationPlans: ["early_decision", "regular_decision"],
    sourceLabel: "Northwestern Undergraduate Admissions",
    sourceUrl: "https://admissions.northwestern.edu/apply/requirements.html",
    lastVerified: verifiedAt,
    verificationStatus: "verified",
  },
  {
    id: "northwestern-2026-interdisciplinary",
    institutionId: "147767",
    institutionName: "Northwestern University",
    cycle,
    type: "intellectual_curiosity",
    title: "Interdisciplinary idea",
    text: "Imagine an undergraduate class, research project, or creative effort. What would it be, and who might be ideal collaborators?",
    wordLimit: 200,
    required: false,
    provider: "institution",
    applicationPlans: ["early_decision", "regular_decision"],
    sourceLabel: "Northwestern Undergraduate Admissions",
    sourceUrl: "https://admissions.northwestern.edu/apply/requirements.html",
    lastVerified: verifiedAt,
    verificationStatus: "verified",
  },
  {
    id: "northwestern-2026-community",
    institutionId: "147767",
    institutionName: "Northwestern University",
    cycle,
    type: "why_us",
    title: "Community and belonging",
    text: "Which communities, networks, or student groups do you see yourself connecting with at Northwestern?",
    wordLimit: 200,
    required: false,
    provider: "institution",
    applicationPlans: ["early_decision", "regular_decision"],
    sourceLabel: "Northwestern Undergraduate Admissions",
    sourceUrl: "https://admissions.northwestern.edu/apply/requirements.html",
    lastVerified: verifiedAt,
    verificationStatus: "verified",
  },
  {
    id: "duke-2026-why",
    institutionId: "198419",
    institutionName: "Duke University",
    cycle,
    type: "why_us",
    title: "Why Duke",
    text: "What is your impression of Duke as a university and community, and why is it a good match for your goals, values, and interests?",
    wordLimit: 250,
    required: true,
    provider: "common_app",
    applicationPlans: ["early_decision", "regular_decision"],
    sourceLabel: "Duke Undergraduate Admissions",
    sourceUrl: "https://admissions.duke.edu/apply/",
    lastVerified: verifiedAt,
    verificationStatus: "verified",
  },
  {
    id: "duke-2026-community",
    institutionId: "198419",
    institutionName: "Duke University",
    cycle,
    type: "community",
    title: "Communities",
    text: "Describe a community that shaped you, what you learned from it, and what you hope to bring to Duke.",
    wordLimit: 250,
    required: true,
    provider: "common_app",
    applicationPlans: ["early_decision", "regular_decision"],
    sourceLabel: "Duke Undergraduate Admissions",
    sourceUrl: "https://admissions.duke.edu/apply/",
    lastVerified: verifiedAt,
    verificationStatus: "verified",
  },
  {
    id: "common-app-2026-additional-information",
    cycle,
    type: "additional_information",
    title: "Additional Information",
    text: "Use this only for relevant context that does not fit elsewhere in the application. You do not need to fill the space.",
    required: false,
    provider: "common_app",
    applicationPlans: [],
    sourceLabel: "Common Application first-year guide",
    sourceUrl: "https://www.commonapp.org/apply/first-year-students/",
    lastVerified: verifiedAt,
    verificationStatus: "verified",
  },
];

export const writingPrompts: WritingPrompt[] = [...personalStatementPrompts, ...supplements];
export const writingPromptById = new Map(writingPrompts.map((prompt) => [prompt.id, prompt]));

export const writingPromptCoverage: Record<string, {
  institutionName: string;
  cycle: string;
  requirementSummary: string;
  sourceUrl: string;
  lastVerified: string;
  verificationStatus: "verified" | "not_yet_verified";
}> = {
  "144050": {
    institutionName: "University of Chicago",
    cycle,
    requirementSummary: "Two required supplements: one extended essay and one Why UChicago response. Current prompt text is not yet verified.",
    sourceUrl: "https://collegeadmissions.uchicago.edu/apply/application/required-materials/",
    lastVerified: verifiedAt,
    verificationStatus: "not_yet_verified",
  },
};

export const writingResources = [
  { title: "Common App essay prompts", detail: "The official current-cycle personal essay prompts.", href: commonAppSource, source: "Common App" },
  { title: "How to approach the essay", detail: "Official planning guidance for first-year applicants.", href: "https://www.commonapp.org/apply/fy-toolkit/", source: "Common App" },
  { title: "Northwestern writing supplements", detail: "Current prompts and institution guidance.", href: "https://admissions.northwestern.edu/apply/requirements.html", source: "Northwestern" },
  { title: "Duke application essays", detail: "Current prompts and application guidance.", href: "https://admissions.duke.edu/apply/", source: "Duke" },
];
