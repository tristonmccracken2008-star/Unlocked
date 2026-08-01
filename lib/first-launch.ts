import "server-only";
import { accountHasCompletedOnboarding, mergeAccountData, readAccountData, withSecurityLock } from "./auth-store";
import { SecurityError } from "./security";

export const firstLaunchVersion = 1 as const;

export async function completeFirstLaunch(userId: string) {
  return await withSecurityLock("first-launch-completion", userId, async () => {
    const current = await readAccountData(userId);
    if (!accountHasCompletedOnboarding(current)) {
      throw new SecurityError("Complete onboarding before continuing.", 409, "onboarding_required");
    }
    if (current.firstLaunchComplete) return { data: current, duplicate: true };
    const completedAt = new Date().toISOString();
    const data = await mergeAccountData(userId, { firstLaunchComplete: true, firstLaunchCompletedAt: completedAt });
    return { data, duplicate: false };
  });
}
