import { opportunities, type Opportunity } from "./opportunities";

export type OpportunityUpdate = {
  opportunity: Opportunity;
  date: string;
  badge: "NEW" | "UPDATED";
  activity: "Newly added" | "Newly verified" | "Recently updated";
};

/**
 * Builds a single, deduplicated update for every opportunity from dates already
 * maintained in the catalog. The latest documented event wins.
 */
export function getOpportunityUpdates(): OpportunityUpdate[] {
  return opportunities
    .filter((opportunity) => opportunity.verification_status !== "expired")
    .map((opportunity) => {
      if (opportunity.date_added >= opportunity.last_verified) {
        return {
          opportunity,
          date: opportunity.date_added,
          badge: "NEW" as const,
          activity: "Newly added" as const,
        };
      }

      return {
        opportunity,
        date: opportunity.last_verified,
        badge: "UPDATED" as const,
        activity:
          opportunity.verification_status === "verified"
            ? ("Newly verified" as const)
            : ("Recently updated" as const),
      };
    })
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        a.opportunity.title.localeCompare(b.opportunity.title),
    );
}
