import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(path, "utf8");
const component = source("components/journey-command-center.tsx");
const styles = source("components/journey-command-center.module.css");
const browserChecks = source("scripts/test-journey-command-center-browser.ts");

assert.match(component, /<JourneyWorkspaceSummary model=\{model\}/, "Journey must lead with its canonical next-action projection.");
assert.ok(component.indexOf("<JourneyWorkspaceSummary") < component.indexOf("id=\"active-opportunities\""), "The next action must precede active pursuits.");
assert.ok(component.indexOf("id=\"active-opportunities\"") < component.indexOf("<JourneyContext"), "Active pursuits must precede Calendar and Strategy context.");
assert.match(component, /model\.workspace\.secondaryActions/, "Supporting attention must use the bounded workspace projection.");
assert.match(component, /model\.workspace\.upcomingDates/, "The compact schedule must use the canonical workspace projection.");
assert.match(component, /className=\{styles\.workspaceDisclosure\} id="journey-calendar"/, "Full Calendar must remain available through progressive disclosure.");
assert.match(component, /className=\{styles\.workspaceDisclosure\} id="journey-strategy"/, "Full Strategy must remain available through progressive disclosure.");
assert.match(component, /data-record-identity=/);
assert.match(component, /data-record-progress=/);
assert.match(component, /data-record-actions=/);
assert.match(component, /className=\{styles\.rowPrimaryAction\}/, "Every available pursuit needs one visible primary action.");
assert.match(component, /aria-label=\{`More actions for \$\{record\.title\}`\}/, "Secondary row actions must remain in an explicit menu.");
assert.doesNotMatch(component, /<JourneyTimelineControl control=\{record\.control\} compactLabel="Update"/, "Status management must not compete with the primary row action.");
assert.match(component, /className=\{styles\.progressControl\}/, "Canonical status controls must remain available inside record details.");
assert.match(component, /suppressed=\{showReturnBriefing\}/, "Smart Return must defer contextual guidance only when its compact briefing is actually shown.");

assert.match(styles, /\.nextAction\s*\{[^}]*grid-template-columns:/, "The dominant action needs a stable desktop layout.");
assert.match(styles, /\.secondaryAttention[^}]*grid-template-columns:/, "Supporting attention must remain compact.");
assert.match(styles, /\.contextGrid[^}]*grid-template-columns:/, "Timing and current mix must form one context layer.");
assert.match(styles, /\.rowPrimaryAction[^}]*min-height:\s*44px/, "Primary row actions must remain touch accessible.");
assert.match(styles, /\.record\s*\{[^}]*grid-template-columns:\s*minmax\(15rem,\s*1\.8fr\)/, "Opportunity identity must remain the dominant desktop column.");
assert.match(styles, /@media\s*\(max-width:\s*700px\)[\s\S]*?\.nextAction\s*\{[^}]*grid-template-columns:\s*1fr/, "The next action must collapse cleanly on mobile.");
assert.match(styles, /@media\s*\(max-width:\s*700px\)[\s\S]*?\.recordMain\s*\{\s*grid-column:\s*1\s*\/\s*-1/, "Mobile titles must use the full first row.");
assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);

assert.match(browserChecks, /Journey sections must retain a clear reading order/);
assert.match(browserChecks, /Mobile opportunity identity must use the full first row/);

console.log("Journey pursuit-workspace hierarchy checks passed.");
