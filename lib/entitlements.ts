import { getEntitlementsForBilling, type Entitlements } from "./billing";
import { readAccountData } from "./auth-store";

export type { Entitlements };

export async function getUserEntitlements(userId: string): Promise<Entitlements> {
  const data = await readAccountData(userId);
  return getEntitlementsForBilling(data.billing);
}
