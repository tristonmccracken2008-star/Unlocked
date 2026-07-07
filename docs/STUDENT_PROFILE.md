# Local Student Profile

UnlockED stores one student profile in the browser under `unlocked-student-profile`. It does not send profile data to a server and does not require authentication.

The schema is defined in `data/student-profile.ts` and includes school, major, optional minor, academic year, career goal, interests, and optional clubs. Use `readStudentProfile` and `writeStudentProfile` rather than accessing local storage with a second key.

The dashboard converts the profile into a `RecommendationProfile`. The unified recommendation engine ranks all opportunity types with the same signals. Section-specific directories also use the profile when ordering benefits, AI tools, careers, research, and scholarships.

Older locally saved profiles are migrated in place. Missing career goals or interests receive neutral migration defaults so returning users keep their dashboard and can refine it through **Edit student profile**.
