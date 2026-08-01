import type { AccountData } from "./account-types";

export function normalizedFirstLaunchComplete(value: Pick<AccountData, "firstLaunchComplete"> | null | undefined, onboardingComplete: boolean) {
  return typeof value?.firstLaunchComplete === "boolean" ? value.firstLaunchComplete : onboardingComplete;
}
