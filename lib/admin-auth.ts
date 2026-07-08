import { cookies } from "next/headers";
import { getSession, sessionCookieName } from "./auth-store";

export function configuredAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get(sessionCookieName)?.value);
  if (!session?.user.email) return null;
  const admins = configuredAdminEmails();
  const allowed = admins.includes(session.user.email.toLowerCase()) || process.env.NODE_ENV !== "production" && admins.length === 0;
  return allowed ? session : null;
}
