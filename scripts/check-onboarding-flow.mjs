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
  source.includes("body: JSON.stringify({ profile: normalized, onboardingComplete: true })"),
);

expect("lib/auth-store.ts", "account merge must preserve existing profile data when login sends no profile", (source) =>
  source.includes("incoming.profile && isCompletedStudentProfile(incoming.profile)") && source.includes("profile = incomingProfile ?? current.profile ?? null") && source.includes("current.onboardingComplete || incoming.onboardingComplete"),
);

expect("components/personalized-home.tsx", "onboarding save must wait for account persistence before opening dashboard", (source) =>
  source.includes("window.location.replace(\"/onboarding\")") && source.includes("Opening onboarding."),
);

expect("components/onboarding-flow.tsx", "new onboarding must be one question per screen with required steps", (source) =>
  ["What school do you attend?", "When do you expect to graduate?", "What is your major?", "Do you have a minor?", "What is your current GPA?", "What are you interested in working toward?", "What kinds of opportunities matter most to you?", "What matters most to you right now?"].every((snippet) => source.includes(snippet)) && source.includes("const totalSteps = 8"),
);

expect("components/onboarding-flow.tsx", "onboarding must support no-minor and GPA unavailable states", (source) =>
  source.includes("\"none\"") && source.includes("\"none_yet\"") && source.includes("\"nonstandard\"") && source.includes("Enter a GPA from 0.00 to 4.00."),
);

expect("components/onboarding-flow.tsx", "onboarding must persist through the canonical profile writer and route to For You", (source) =>
  source.includes("await writeStudentProfile(profile)") && source.includes("window.location.assign(\"/advisor\")") && source.includes("onboardingCompletedAt"),
);

expect("components/onboarding-flow.tsx", "onboarding analytics must avoid answer values and use step identifiers", (source) =>
  ["onboarding_started", "onboarding_step_viewed", "onboarding_step_completed", "onboarding_back_clicked", "onboarding_validation_failed", "onboarding_completed", "onboarding_save_failed"].every((event) => source.includes(event)) && source.includes("stepId") && source.includes("stepIndex"),
);

expect("components/profile-page.tsx", "edit profile must pass the saved profile into the form", (source) =>
  source.includes("initialProfile={profile}") && source.includes("await writeStudentProfile(next)"),
);

expect("components/personalized-home.tsx", "edit form fields must initialize from the saved profile", (source) =>
  ["initialProfile?.firstName", "initialProfile?.lastName", "initialProfile?.major", "initialProfile?.graduationYear", "initialProfile?.interests", "initialProfile?.careerGoal", "initialProfile?.minor", "initialProfile?.gpaStatus", "initialProfile?.currentPriority"].every((snippet) => source.includes(snippet)),
);

expect("data/advisor-engine.ts", "advisor profile must expose new onboarding fields to structured recommendations", (source) =>
  source.includes("currentPriority") && source.includes("gpaStatus") && source.includes("gpa"),
);

if (failures.length) {
  console.error("Onboarding flow regression check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Onboarding flow regression check passed.");
