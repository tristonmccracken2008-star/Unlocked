import "server-only";
import type { AdvisorCareerId } from "./types";

export const careerReadinessFrameworks: Record<AdvisorCareerId, {
  displayName: string;
  dimensions: Record<string, number>;
  requirements: Record<string, { target: number; dimension: string }>;
}> = {
  "career.quantitative-trader": {
    displayName: "Quantitative Trader",
    dimensions: {
      academic_foundation: 0.22,
      career_specific_skills: 0.25,
      projects_and_evidence: 0.18,
      experience: 0.15,
      recruiting_readiness: 0.12,
      communication_and_fit: 0.08,
    },
    requirements: {
      probability: { target: 80, dimension: "academic_foundation" },
      statistics: { target: 70, dimension: "academic_foundation" },
      programming: { target: 70, dimension: "career_specific_skills" },
      mental_math: { target: 65, dimension: "career_specific_skills" },
      quant_project: { target: 1, dimension: "projects_and_evidence" },
      relevant_experience: { target: 1, dimension: "experience" },
      resume_ready: { target: 1, dimension: "recruiting_readiness" },
      interview_prep: { target: 50, dimension: "recruiting_readiness" },
      career_fit_explored: { target: 1, dimension: "communication_and_fit" },
    },
  },
  "career.software-engineer": {
    displayName: "Software Engineer",
    dimensions: {
      academic_foundation: 0.15,
      career_specific_skills: 0.25,
      projects_and_evidence: 0.25,
      experience: 0.15,
      recruiting_readiness: 0.12,
      communication_and_fit: 0.08,
    },
    requirements: {
      programming: { target: 75, dimension: "career_specific_skills" },
      data_structures: { target: 70, dimension: "academic_foundation" },
      algorithms: { target: 65, dimension: "academic_foundation" },
      finished_projects: { target: 2, dimension: "projects_and_evidence" },
      team_project: { target: 1, dimension: "projects_and_evidence" },
      relevant_experience: { target: 1, dimension: "experience" },
      resume_ready: { target: 1, dimension: "recruiting_readiness" },
      interview_prep: { target: 50, dimension: "recruiting_readiness" },
      project_explanation: { target: 60, dimension: "communication_and_fit" },
    },
  },
  "career.physician": {
    displayName: "Physician",
    dimensions: {
      academic_foundation: 0.25,
      career_specific_skills: 0.1,
      projects_and_evidence: 0.1,
      experience: 0.25,
      recruiting_readiness: 0.15,
      communication_and_fit: 0.15,
    },
    requirements: {
      science_foundation: { target: 80, dimension: "academic_foundation" },
      quantitative_reasoning: { target: 65, dimension: "academic_foundation" },
      clinical_exposure: { target: 1, dimension: "experience" },
      service_experience: { target: 1, dimension: "experience" },
      research_or_inquiry: { target: 1, dimension: "projects_and_evidence" },
      application_timeline_ready: { target: 1, dimension: "recruiting_readiness" },
      letters_plan: { target: 1, dimension: "recruiting_readiness" },
      career_fit_explored: { target: 1, dimension: "communication_and_fit" },
      reflection_quality: { target: 60, dimension: "communication_and_fit" },
    },
  },
  "career.general-exploration": {
    displayName: "General Exploration",
    dimensions: {
      direction_and_fit: 0.25,
      visible_evidence: 0.25,
      experience: 0.2,
      academic_foundation: 0.15,
      communication_and_reflection: 0.15,
    },
    requirements: {
      career_fit_explored: { target: 1, dimension: "direction_and_fit" },
      finished_projects: { target: 1, dimension: "visible_evidence" },
      relevant_experience: { target: 1, dimension: "experience" },
      research_or_inquiry: { target: 1, dimension: "experience" },
      statistics: { target: 45, dimension: "academic_foundation" },
      resume_ready: { target: 1, dimension: "communication_and_reflection" },
      reflection_quality: { target: 50, dimension: "communication_and_reflection" },
    },
  },
};

export const dependencyGraph = {
  graphVersion: "0.4.0",
  nodes: [
    { id: "skill.probability", type: "skill", displayName: "Probability" },
    { id: "skill.statistics", type: "skill", displayName: "Statistics" },
    { id: "skill.programming", type: "skill", displayName: "Programming" },
    { id: "skill.data-structures", type: "skill", displayName: "Data Structures" },
    { id: "skill.algorithms", type: "skill", displayName: "Algorithms" },
    { id: "skill.quant-project", type: "evidence", displayName: "Quantitative Project" },
    { id: "skill.finished-project", type: "evidence", displayName: "Finished Technical Project" },
    { id: "skill.resume-ready", type: "artifact", displayName: "Role-Specific Resume" },
    { id: "skill.interview-prep", type: "readiness", displayName: "Interview Preparation" },
    { id: "skill.clinical-exposure", type: "experience", displayName: "Clinical Exposure" },
    { id: "skill.service", type: "experience", displayName: "Sustained Service" },
    { id: "skill.research", type: "experience", displayName: "Research or Inquiry" },
    { id: "milestone.quant-internship-ready", type: "milestone", displayName: "Quant Internship Ready" },
    { id: "milestone.swe-internship-ready", type: "milestone", displayName: "Software Internship Ready" },
    { id: "milestone.medical-application-ready", type: "milestone", displayName: "Medical School Application Ready" },
    { id: "milestone.exploration-ready", type: "milestone", displayName: "Exploration Ready" },
  ],
  edges: [
    { from: "skill.probability", to: "skill.quant-project", relationship: "supports", weight: 0.9 },
    { from: "skill.statistics", to: "skill.quant-project", relationship: "supports", weight: 0.8 },
    { from: "skill.programming", to: "skill.quant-project", relationship: "supports", weight: 0.9 },
    { from: "skill.quant-project", to: "milestone.quant-internship-ready", relationship: "contributes", weight: 0.9 },
    { from: "skill.resume-ready", to: "milestone.quant-internship-ready", relationship: "contributes", weight: 0.7 },
    { from: "skill.interview-prep", to: "milestone.quant-internship-ready", relationship: "contributes", weight: 0.8 },
    { from: "skill.programming", to: "skill.finished-project", relationship: "supports", weight: 0.9 },
    { from: "skill.data-structures", to: "skill.algorithms", relationship: "prerequisite", weight: 1.0 },
    { from: "skill.finished-project", to: "milestone.swe-internship-ready", relationship: "contributes", weight: 0.9 },
    { from: "skill.algorithms", to: "milestone.swe-internship-ready", relationship: "contributes", weight: 0.8 },
    { from: "skill.resume-ready", to: "milestone.swe-internship-ready", relationship: "contributes", weight: 0.7 },
    { from: "skill.interview-prep", to: "milestone.swe-internship-ready", relationship: "contributes", weight: 0.8 },
    { from: "skill.clinical-exposure", to: "milestone.medical-application-ready", relationship: "contributes", weight: 0.95 },
    { from: "skill.service", to: "milestone.medical-application-ready", relationship: "contributes", weight: 0.8 },
    { from: "skill.research", to: "milestone.medical-application-ready", relationship: "contributes", weight: 0.5 },
    { from: "skill.resume-ready", to: "milestone.exploration-ready", relationship: "contributes", weight: 0.7 },
    { from: "skill.finished-project", to: "milestone.exploration-ready", relationship: "contributes", weight: 0.7 },
    { from: "skill.research", to: "milestone.exploration-ready", relationship: "contributes", weight: 0.6 },
  ],
};

export const recruitingCalendars: Record<string, Record<string, { term: string; action: string; urgency: "critical" | "high" | "medium" | "low" }[]>> = {
  "career.quantitative-trader": {
    "incoming-first-year": [
      { term: "summer-before-first-year", action: "Explore the role and build probability/programming foundations.", urgency: "low" },
      { term: "first-year-fall", action: "Track early insight programs and build one quantitative project.", urgency: "medium" },
      { term: "first-year-spring", action: "Apply to sophomore-facing opportunities where eligible.", urgency: "medium" },
    ],
    "second-year": [
      { term: "second-year-summer-before-fall", action: "Prepare resume and firm list before recruiting accelerates.", urgency: "high" },
      { term: "second-year-fall", action: "Apply early to selective trading internships and prepare for interviews.", urgency: "critical" },
      { term: "second-year-spring", action: "Continue smaller-firm, research, and alternative quantitative applications.", urgency: "medium" },
    ],
    "third-year": [
      { term: "third-year-summer-before-fall", action: "Finalize internship recruiting preparation.", urgency: "critical" },
      { term: "third-year-fall", action: "Complete primary internship recruiting.", urgency: "critical" },
      { term: "third-year-spring", action: "Use research, finance, software, or data alternatives if primary recruiting is incomplete.", urgency: "medium" },
    ],
  },
  "career.software-engineer": {
    "first-year": [
      { term: "first-year-fall", action: "Build one finished project and attend technical recruiting events.", urgency: "medium" },
      { term: "first-year-spring", action: "Apply broadly to internships, campus development, and research roles.", urgency: "medium" },
    ],
    "second-year": [
      { term: "second-year-summer-before-fall", action: "Prepare resume, portfolio, and interview fundamentals.", urgency: "high" },
      { term: "second-year-fall", action: "Apply to larger internship programs early.", urgency: "critical" },
      { term: "second-year-spring", action: "Continue startups, labs, campus, and local employers.", urgency: "medium" },
    ],
    "third-year": [
      { term: "third-year-summer-before-fall", action: "Prepare for primary internship cycle.", urgency: "critical" },
      { term: "third-year-fall", action: "Apply and interview broadly.", urgency: "critical" },
      { term: "third-year-spring", action: "Continue later-cycle employers and alternatives.", urgency: "medium" },
    ],
    "fourth-year": [
      { term: "fourth-year-summer-before-fall", action: "Prepare full-time resume and interview materials.", urgency: "critical" },
      { term: "fourth-year-fall", action: "Complete primary new-grad recruiting.", urgency: "critical" },
      { term: "fourth-year-spring", action: "Continue smaller-company and just-in-time hiring.", urgency: "high" },
    ],
  },
  "career.physician": {
    "first-year": [
      { term: "first-year-fall", action: "Establish academic foundations and begin sustainable service/clinical exploration.", urgency: "medium" },
      { term: "first-year-spring", action: "Review prerequisites and continue meaningful experiences.", urgency: "medium" },
    ],
    "second-year": [
      { term: "second-year-fall", action: "Continue prerequisites and sustained experiences; evaluate research fit.", urgency: "medium" },
      { term: "second-year-spring", action: "Begin high-level MCAT and application-timeline planning.", urgency: "medium" },
    ],
    "third-year": [
      { term: "third-year-fall", action: "Decide MCAT timing, letters plan, and whether a gap year is appropriate.", urgency: "high" },
      { term: "third-year-spring", action: "Complete application readiness review before submitting.", urgency: "critical" },
    ],
    "fourth-year": [
      { term: "fourth-year-fall", action: "Interview or use a purposeful gap year to close readiness gaps.", urgency: "high" },
      { term: "fourth-year-spring", action: "Evaluate offers, finances, and transition readiness.", urgency: "high" },
    ],
  },
  "career.general-exploration": {
    "incoming-first-year": [
      { term: "first-year-fall", action: "Test two interests through low-risk campus roles, short projects, or advisor conversations.", urgency: "medium" },
      { term: "first-year-spring", action: "Choose one direction to build visible evidence before sophomore recruiting.", urgency: "medium" },
    ],
    "first-year": [
      { term: "first-year-fall", action: "Use clubs, office hours, and small projects to compare possible paths.", urgency: "medium" },
      { term: "first-year-spring", action: "Turn the strongest interest into one visible artifact or role.", urgency: "medium" },
    ],
    "second-year": [
      { term: "second-year-fall", action: "Narrow exploration into two target paths and build one concrete evidence piece.", urgency: "high" },
      { term: "second-year-spring", action: "Apply to campus, research, internship, or project roles that test the leading path.", urgency: "medium" },
    ],
    "third-year": [
      { term: "third-year-fall", action: "Convert the strongest direction into applications and advisor-reviewed materials.", urgency: "high" },
      { term: "third-year-spring", action: "Use feedback from applications to refine the path or choose a backup route.", urgency: "medium" },
    ],
    "fourth-year": [
      { term: "fourth-year-fall", action: "Focus on verified applications and a simple backup plan.", urgency: "critical" },
      { term: "fourth-year-spring", action: "Compare offers, graduate options, or gap-year plans against fit and cost.", urgency: "high" },
    ],
  },
};
