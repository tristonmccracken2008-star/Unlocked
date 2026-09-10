import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { accountHasCompletedFirstLaunch, accountHasCompletedOnboarding, getSession, sessionCookieName } from "@/lib/auth-store";

export async function getServerSessionForProduct() {
  const cookieStore = await cookies();
  return await getSession(cookieStore.get(sessionCookieName)?.value);
}

export async function requireCompletedOnboarding() {
  const session = await getServerSessionForProduct();
  if (!session) redirect("/");
  if (!accountHasCompletedOnboarding(session.data)) redirect("/onboarding");
  if (!accountHasCompletedFirstLaunch(session.data)) redirect("/welcome");
  return session;
}

export async function requireSelectedEducationalStage() {
  const session = await getServerSessionForProduct();
  if (!session) redirect("/");
  if (!session.data.educationalStage) redirect("/onboarding");
  return session;
}

export async function requireHighSchoolStage() {
  const session = await requireSelectedEducationalStage();
  if (session.data.educationalStage !== "high_school") redirect("/");
  return session;
}

export async function requireOnboardingSession() {
  const session = await getServerSessionForProduct();
  if (!session) redirect("/");
  if (session.data.educationalStage === "graduate") redirect("/");
  if (accountHasCompletedOnboarding(session.data)) redirect(accountHasCompletedFirstLaunch(session.data) ? "/advisor" : "/welcome");
  return session;
}

export async function requireFirstLaunchSession() {
  const session = await getServerSessionForProduct();
  if (!session) redirect("/");
  if (!accountHasCompletedOnboarding(session.data)) redirect("/onboarding");
  if (accountHasCompletedFirstLaunch(session.data)) redirect("/opportunities");
  return session;
}
