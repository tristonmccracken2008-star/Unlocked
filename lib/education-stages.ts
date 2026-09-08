export const educationalStages = ["high_school", "undergraduate", "graduate"] as const;

export type EducationalStage = (typeof educationalStages)[number];

export type EducationalStageTransition = {
  from: EducationalStage | null;
  to: EducationalStage;
  changedAt: string;
};

export const educationalStageSchemaVersion = 1;

export const educationalStageDetails: Record<EducationalStage, {
  label: string;
  shortDescription: string;
  description: string;
  homeEyebrow: string;
  homeTitle: string;
  homeDescription: string;
  priorities: readonly { title: string; description: string }[];
}> = {
  high_school: {
    label: "High School",
    shortDescription: "Preparing for college",
    description: "Preparing for college and exploring what comes next.",
    homeEyebrow: "High School UnlockED",
    homeTitle: "Your high school journey starts here.",
    homeDescription: "A focused place to explore what comes next and build toward it with intention.",
    priorities: [
      { title: "Explore colleges", description: "Find the environments and possibilities that fit you." },
      { title: "Find opportunities", description: "Build experience before college, one step at a time." },
      { title: "Plan your applications", description: "Keep the work ahead clear and manageable." },
      { title: "Build your experiences", description: "Keep a lasting record of what you have done." },
    ],
  },
  undergraduate: {
    label: "Undergraduate",
    shortDescription: "Building experience",
    description: "Finding opportunities, building experience, and preparing for your career.",
    homeEyebrow: "Undergraduate UnlockED",
    homeTitle: "Build toward what comes next.",
    homeDescription: "Discover opportunities, build experience, and prepare for your career.",
    priorities: [],
  },
  graduate: {
    label: "Graduate",
    shortDescription: "Specializing and moving forward",
    description: "Building specialized experience, research, and your next career step.",
    homeEyebrow: "Graduate UnlockED",
    homeTitle: "Deepen your work. Shape what comes next.",
    homeDescription: "A focused place for advanced experience, research, and the transition into your next professional chapter.",
    priorities: [
      { title: "Research", description: "Keep your questions, work, and direction connected." },
      { title: "Opportunities", description: "Find the fellowships and experiences that move your work forward." },
      { title: "Career transition", description: "Turn specialized expertise into a clear next step." },
      { title: "Experience", description: "Preserve the work and evidence that define your path." },
    ],
  },
};

export function normalizeEducationalStage(value: unknown): EducationalStage | null {
  return educationalStages.includes(value as EducationalStage) ? value as EducationalStage : null;
}

export function stageHomePath(_stage: EducationalStage) {
  return "/";
}
