# Student Profile

UnlockED stores one student profile in the browser under `unlocked-student-profile` and syncs completed authenticated profiles through the existing account data API. Authentication, onboarding, and profile persistence remain the source of truth for personalized recommendations.

The schema is defined in `data/student-profile.ts` and includes school, major, graduation year, academic year, career goal, interests, current experience, weekly availability, preferred opportunity types, and Advisor Interview answers. Use `readStudentProfile` and `writeStudentProfile` rather than accessing local storage with a second key.

The dashboard converts the profile into a `RecommendationProfile`. The unified recommendation engine ranks all opportunity types with the same signals. Section-specific directories also use the profile when ordering benefits, AI tools, careers, research, and scholarships.

Older locally saved profiles are migrated in place. Missing career goals or interests receive neutral migration defaults so returning users keep their dashboard and can refine it through **Edit student profile**.

Advisor infrastructure also converts the profile into:

- an `AdvisorProfile` for roadmap, recommendation, digest, notification, and interview systems;
- a normalized server-side Advisor Brain profile for protected advisor APIs;
- an evidence inventory and Student Digital Twin for internal Interview Intelligence.

Interview Intelligence is additive and deterministic. It does not change the saved profile schema or require new onboarding questions.
