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
  source.includes("accountHasCompletedOnboarding(accountData)") && !source.includes("/profile?auth=signed-in"),
);

expect("data/student-profile.ts", "profile completion must require first name and graduation year", (source) =>
  source.includes("isCompletedStudentProfile") && source.includes("profile.firstName?.trim()") && source.includes("profile.graduationYear?.trim()") && source.includes("markedComplete && isCompletedStudentProfile(profile)"),
);

expect("data/student-profile.ts", "profile saves must mark the account as onboarded", (source) =>
  source.includes("body: JSON.stringify({ profile, onboardingComplete: true })"),
);

expect("lib/auth-store.ts", "account merge must preserve existing profile data when login sends no profile", (source) =>
  source.includes("incoming.profile && isCompletedStudentProfile(incoming.profile)") && source.includes("profile = incomingProfile ?? current.profile ?? null") && source.includes("current.onboardingComplete || incoming.onboardingComplete"),
);

expect("components/personalized-home.tsx", "onboarding save must wait for account persistence before opening dashboard", (source) =>
  source.includes("async function save(next: StudentProfile)") && source.includes("await writeStudentProfile(next)") && source.includes("setProfile(next)"),
);

expect("components/profile-page.tsx", "edit profile must pass the saved profile into the form", (source) =>
  source.includes("initialProfile={profile}") && source.includes("await writeStudentProfile(next)"),
);

expect("components/personalized-home.tsx", "edit form fields must initialize from the saved profile", (source) =>
  ["initialProfile?.firstName", "initialProfile?.lastName", "initialProfile?.major", "initialProfile?.graduationYear", "initialProfile?.interests", "initialProfile?.careerGoal"].every((snippet) => source.includes(snippet)),
);

if (failures.length) {
  console.error("Onboarding flow regression check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Onboarding flow regression check passed.");
