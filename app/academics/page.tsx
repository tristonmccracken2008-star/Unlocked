import type { Metadata } from "next";
import { HighSchoolAcademics } from "@/components/high-school-academics";
import { normalizeAccomplishmentStore } from "@/data/accomplishments";
import { normalizeHighSchoolAcademicStore } from "@/data/high-school-academics";
import { requireHighSchoolStage } from "@/lib/onboarding";
import { getColleges } from "@/lib/colleges";
import { latestCollegeCds } from "@/lib/college-admissions-insights";
import { verifiedCollegeTestingPolicies } from "@/data/college-admissions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Academics & Testing",
  robots: { index: false, follow: false },
};

export default async function AcademicsPage() {
  const session = await requireHighSchoolStage();
  const accomplishments = Object.values(
    normalizeAccomplishmentStore(session.data.accomplishments),
  ).filter(
    (item) =>
      !item.hidden &&
      !item.inactiveAt &&
      /academic|honor|merit|scholar|department|olympiad/i.test(
        `${item.snapshot.title} ${item.snapshot.category ?? ""}`,
      ),
  );
  return (
    <HighSchoolAcademics
      initialStore={normalizeHighSchoolAcademicStore(
        session.data.highSchoolAcademics,
      )}
      profile={{
        schoolName: session.data.profile?.schoolName,
        graduationYear: session.data.profile?.graduationYear,
        year: session.data.profile?.year,
      }}
      academicHonors={accomplishments.map((item) => ({
        id: item.id,
        title: item.snapshot.title,
        outcome: item.outcome,
        date: item.outcomeDate,
      }))}
      collegeContexts={getColleges((session.data.savedColleges ?? []).map((item) => item.collegeId)).map((college) => {
        const testing = latestCollegeCds(college.id)?.testing;
        const policy = verifiedCollegeTestingPolicies[college.id];
        return {
          id: college.id,
          name: college.name,
          slug: college.slug,
          policy: policy?.label ?? "Policy needs verification",
          policyVerified: Boolean(policy),
          satRange: testing?.satComposite,
          actRange: testing?.actComposite,
          cohort: testing?.cohortLabel,
        };
      })}
    />
  );
}
