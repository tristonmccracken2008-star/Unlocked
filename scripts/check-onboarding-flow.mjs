import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];

function expect(file, description, test) {
  const source = read(file);
  if (!test(source)) failures.push(`${file}: ${description}`);
}

expect("app/api/auth/callback/google/route.ts", "OAuth callback must route from persisted onboarding state", (source) =>
  source.includes("accountHasCompletedOnboarding(accountData)") && source.includes("\"/onboarding\"") && source.includes("\"/advisor\"") && !source.includes("/profile?auth=signed-in"),
);

expect("lib/onboarding.ts", "protected product routes must use a shared server onboarding guard", (source) =>
  source.includes("requireCompletedOnboarding") && source.includes("accountHasCompletedOnboarding(session.data)") && source.includes("redirect(\"/onboarding\")"),
);

for (const route of ["app/advisor/page.tsx", "app/profile/page.tsx", "app/my-opportunities/page.tsx", "app/opportunities/page.tsx"]) {
  expect(route, "product route must require completed onboarding", (source) => source.includes("requireCompletedOnboarding()"));
}

expect("app/onboarding/page.tsx", "onboarding route must reject signed-out and completed users server-side", (source) =>
  source.includes("requireOnboardingSession") && source.includes("<OnboardingFlow"),
);

expect("data/student-profile.ts", "profile completion must require first name and graduation year while preserving migration defaults", (source) =>
  source.includes("isCompletedStudentProfile") && source.includes("profile.firstName?.trim()") && source.includes("profile.graduationYear?.trim()") && source.includes("markedComplete && isCompletedStudentProfile(profile)") && source.includes("normalizeStudentProfile") && source.includes("minorStatus") && source.includes("gpaStatus") && source.includes("currentPriority"),
);

expect("data/student-profile.ts", "profile saves must mark the account as onboarded", (source) =>
  source.includes("body: JSON.stringify({ profile: normalized, onboardingComplete: true, expectedUpdatedAt })"),
);

expect("lib/auth-store.ts", "account merge must preserve existing profile data when login sends no profile", (source) =>
  source.includes("incoming.profile && isCompletedStudentProfile(incoming.profile)") && source.includes("profile = incomingProfile ?? current.profile ?? null") && source.includes("current.onboardingComplete || incoming.onboardingComplete"),
);

expect("components/personalized-home.tsx", "onboarding save must wait for account persistence before opening dashboard", (source) =>
  source.includes("window.location.replace(\"/onboarding\")") && source.includes("Opening onboarding."),
);

expect("components/onboarding-flow.tsx", "new onboarding must be one question per screen with the ten purposeful steps", (source) =>
  [
    "What school do you attend?",
    "When do you expect to graduate?",
    "What are you studying?",
    "What kinds of opportunities are you looking for?",
    "What fields are you interested in?",
    "What are you working toward right now?",
    "How would you like to participate?",
    "How important is paid work?",
    "What time commitment fits you?",
    "Any specific career paths you are interested in?",
  ].every((snippet) => source.includes(snippet)) && source.includes("const totalSteps = 10"),
);

expect("components/onboarding-flow.tsx", "minor and GPA must be safely deferred instead of required during cold start", (source) =>
  source.includes('const minorStatus: MinorStatus = draft.minorStatus || (draft.minor ? "declared" : "none")')
    && source.includes('const gpaStatus: GpaStatus = draft.gpaStatus || "none_yet"'),
);

expect("components/onboarding-flow.tsx", "onboarding must persist through the canonical profile writer before routing to Discover", (source) =>
  source.includes("await writeStudentProfile(profile)") && source.includes("window.location.assign(\"/opportunities\")") && source.includes("onboardingCompletedAt"),
);

expect("components/onboarding-flow.tsx", "refresh, account switching, selection limits, and duplicate submission must be safe", (source) =>
  source.includes("unlocked-onboarding-draft-v2")
    && source.includes("accountSessionEvent")
    && source.includes("if (savingRef.current) return")
    && source.includes("activeUserId.current !== session.user?.id")
    && source.includes("onboardingSelectionLimits"),
);

expect("app/api/account/data/route.ts", "first-time completion must be validated server-side", (source) =>
  source.includes("onboardingProfileV2Issues") && source.includes("incomplete_onboarding") && source.includes("currentAccount?.onboardingComplete"),
);

expect("components/onboarding-flow.tsx", "onboarding analytics must avoid answer values and use step identifiers", (source) =>
  ["onboarding_started", "onboarding_step_viewed", "onboarding_step_completed", "onboarding_back_clicked", "onboarding_validation_failed", "onboarding_abandoned", "onboarding_completed", "onboarding_save_failed"].every((event) => source.includes(event)) && source.includes("stepId") && source.includes("stepIndex"),
);

expect("components/profile-page.tsx", "edit profile must pass the saved profile into the form", (source) =>
  source.includes("initialProfile={profile}") && source.includes("await writeStudentProfile(nextProfile, session.data?.updatedAt)"),
);

expect("components/personalized-home.tsx", "edit form must initialize and edit every canonical personalization field", (source) =>
  ["initialProfile?.firstName", "initialProfile?.lastName", "initialProfile?.major", "initialProfile?.graduationYear", "initialProfile?.minor", "initialProfile?.gpaStatus", "personalizationFromLegacyProfile", "opportunityTypeInterests", "fieldInterests", "specificCareerInterests", "locationFormats", "compensationPreference", "timeCommitments"].every((snippet) => source.includes(snippet)),
);

expect("data/advisor-engine.ts", "advisor profile must expose new onboarding fields to structured recommendations", (source) =>
  ["currentPriority", "gpaStatus", "gpa", "specificCareerInterests", "locationFormats", "compensationPreference", "timeCommitments"].every((snippet) => source.includes(snippet)),
);

expect("data/onboarding-personalization.ts", "each onboarding question must document its recommendation purpose", (source) =>
  source.includes("onboardingQuestionPurpose") && ["eligibility", "Category prioritization", "Work-mode preference", "Paid-opportunity preference", "Program-duration preference"].every((snippet) => source.includes(snippet)),
);

if (failures.length) {
  console.error("Onboarding flow regression check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Onboarding flow regression check passed.");
