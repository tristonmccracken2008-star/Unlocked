import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { accountHasCompletedOnboarding, getSession, sessionCookieName } from "@/lib/auth-store";

export async function getServerSessionForProduct() {
  const cookieStore = await cookies();
  return await getSession(cookieStore.get(sessionCookieName)?.value);
}

export async function requireCompletedOnboarding() {
  const session = await getServerSessionForProduct();
  if (!session) redirect("/");
  if (!accountHasCompletedOnboarding(session.data)) redirect("/onboarding");
  return session;
}

export async function requireOnboardingSession() {
  const session = await getServerSessionForProduct();
  if (!session) redirect("/");
  if (accountHasCompletedOnboarding(session.data)) redirect("/advisor");
  return session;
}
