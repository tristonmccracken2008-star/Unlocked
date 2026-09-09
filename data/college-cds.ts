export const cdsImportanceLevels = [
  "very_important",
  "important",
  "considered",
  "not_considered",
] as const;

export type CdsImportance = (typeof cdsImportanceLevels)[number];
export type CdsAdmissionFactor =
  | "rigor"
  | "class_rank"
  | "academic_gpa"
  | "standardized_tests"
  | "essay"
  | "recommendations"
  | "interview"
  | "extracurriculars"
  | "talent_ability"
  | "character_personal_qualities"
  | "first_generation"
  | "alumni_relation"
  | "geographic_residence"
  | "state_residency"
  | "religious_affiliation"
  | "volunteer_work"
  | "work_experience"
  | "level_of_interest";

export type CollegeCdsSnapshot = {
  academicYear: string;
  cohortLabel: string;
  sourceUrl: string;
  verifiedAt: string;
  factors?: Partial<Record<CdsAdmissionFactor, CdsImportance>>;
  admissions?: {
    applicants?: number;
    admitted?: number;
    enrolled?: number;
    waitlistOffered?: number;
    waitlistAccepted?: number;
    waitlistAdmitted?: number;
    earlyDecisionApplicants?: number;
    earlyDecisionAdmitted?: number;
  };
  testing?: {
    cohortLabel: string;
    satSubmittingPercent?: number;
    actSubmittingPercent?: number;
    satComposite?: [number, number];
    satReading?: [number, number];
    satMath?: [number, number];
    actComposite?: [number, number];
  };
  classRank?: {
    cohortLabel: string;
    reportingPercent: number;
    topTenth?: number;
    topQuarter?: number;
    topHalf?: number;
  };
  gpa?: {
    cohortLabel: string;
    scale: "4.0";
    reportingPercent: number;
    average?: number;
    distribution?: Partial<Record<"4.0" | "3.75–3.99" | "3.50–3.74" | "3.25–3.49" | "3.00–3.24" | "2.50–2.99" | "2.00–2.49" | "1.00–1.99" | "Below 1.00", number>>;
  };
};

export type CollegeCdsRecord = {
  collegeId: string;
  institutionName: string;
  snapshots: CollegeCdsSnapshot[];
};

const verifiedAt = "2026-09-09";

export const collegeCdsRecords: Record<string, CollegeCdsRecord> = {
  "170976": {
    collegeId: "170976",
    institutionName: "University of Michigan-Ann Arbor",
    snapshots: [{
      academicYear: "2024–25",
      cohortLabel: "Fall 2024 entering class",
      sourceUrl: "https://obp.umich.edu/wp-content/uploads/pubdata/cds/CDS_2024-25_UMAA.pdf",
      verifiedAt,
      factors: {
        rigor: "very_important", class_rank: "not_considered", academic_gpa: "very_important", standardized_tests: "important",
        essay: "important", recommendations: "important", interview: "not_considered", extracurriculars: "considered",
        talent_ability: "considered", character_personal_qualities: "important", first_generation: "important", alumni_relation: "not_considered",
        geographic_residence: "considered", state_residency: "considered", religious_affiliation: "not_considered", volunteer_work: "considered",
        work_experience: "considered", level_of_interest: "considered",
      },
      admissions: { applicants: 98310, admitted: 15373, enrolled: 7278, waitlistOffered: 24804, waitlistAccepted: 18793, waitlistAdmitted: 973 },
      testing: { cohortLabel: "Fall 2024 enrolled first-year students", satSubmittingPercent: 51, actSubmittingPercent: 18, satReading: [680, 750], satMath: [680, 780], actComposite: [31, 34] },
      gpa: { cohortLabel: "Fall 2024 enrolled first-year students who submitted GPA", scale: "4.0", reportingPercent: 92.4, average: 3.9, distribution: { "4.0": 38.8, "3.75–3.99": 54, "3.50–3.74": 5.7, "3.25–3.49": 0.9, "3.00–3.24": 0.4 } },
    }],
  },
  "168342": {
    collegeId: "168342",
    institutionName: "Williams College",
    snapshots: [{
      academicYear: "2024–25",
      cohortLabel: "Fall 2024 entering class",
      sourceUrl: "https://www.williams.edu/institutional-research/files/2025/05/CDS_2024_2025_Williams_V4.pdf",
      verifiedAt,
      factors: {
        rigor: "very_important", class_rank: "very_important", academic_gpa: "very_important", standardized_tests: "considered",
        essay: "important", recommendations: "very_important", interview: "not_considered", extracurriculars: "important",
        talent_ability: "important", character_personal_qualities: "very_important", first_generation: "important", alumni_relation: "considered",
        geographic_residence: "considered", state_residency: "not_considered", religious_affiliation: "considered", volunteer_work: "important",
        work_experience: "important", level_of_interest: "not_considered",
      },
      admissions: { applicants: 15411, admitted: 1272, enrolled: 547, waitlistOffered: 2303, waitlistAccepted: 858, waitlistAdmitted: 113 },
      testing: { cohortLabel: "Fall 2024 enrolled first-year students", satSubmittingPercent: 35, actSubmittingPercent: 17, satComposite: [1500, 1560], satReading: [740, 780], satMath: [750, 790], actComposite: [34, 35] },
      classRank: { cohortLabel: "Fall 2024 enrolled first-year students who submitted class rank", reportingPercent: 20.5, topTenth: 88.4, topQuarter: 98.2, topHalf: 99.1 },
    }],
  },
  "166683": {
    collegeId: "166683",
    institutionName: "Massachusetts Institute of Technology",
    snapshots: [{
      academicYear: "2025–26",
      cohortLabel: "Fall 2025 entering class",
      sourceUrl: "https://ir.mit.edu/projects/2025-26-common-data-set/",
      verifiedAt,
      factors: {
        rigor: "important", class_rank: "considered", academic_gpa: "important", standardized_tests: "important",
        essay: "important", recommendations: "important", interview: "important", extracurriculars: "important",
        talent_ability: "important", character_personal_qualities: "very_important", first_generation: "considered", alumni_relation: "not_considered",
        geographic_residence: "considered", state_residency: "not_considered", religious_affiliation: "not_considered", volunteer_work: "considered",
        work_experience: "considered", level_of_interest: "not_considered",
      },
      admissions: { applicants: 29281, admitted: 1334, enrolled: 1152, waitlistOffered: 561, waitlistAccepted: 468, waitlistAdmitted: 10 },
      testing: { cohortLabel: "Fall 2025 enrolled first-year students", satSubmittingPercent: 83, actSubmittingPercent: 31, satComposite: [1520, 1570], satReading: [740, 780], satMath: [780, 800], actComposite: [34, 35] },
      classRank: { cohortLabel: "Fall 2025 enrolled first-year students who submitted class rank", reportingPercent: 31, topTenth: 97, topQuarter: 100, topHalf: 100 },
    }],
  },
};

export const collegeCdsSources: Record<string, { label: string; url: string; verifiedAt: string }> = {
  "170976": { label: "University of Michigan Common Data Set", url: collegeCdsRecords["170976"].snapshots[0].sourceUrl, verifiedAt },
  "168342": { label: "Williams College Common Data Set", url: collegeCdsRecords["168342"].snapshots[0].sourceUrl, verifiedAt },
  "144740": { label: "DePaul University Common Data Set", url: "https://irma.depaul.edu/FFPlus.asp?cont=cds", verifiedAt },
  "131520": { label: "Howard University Common Data Set", url: "https://ira.howard.edu/institutional-research/common-data-set", verifiedAt },
  "110556": { label: "Fresno State Common Data Set", url: "https://academics.fresnostate.edu/oie/data/common.html", verifiedAt },
  "166683": { label: "MIT Common Data Set", url: collegeCdsRecords["166683"].snapshots[0].sourceUrl, verifiedAt },
};
