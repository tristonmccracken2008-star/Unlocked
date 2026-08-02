import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(path, "utf8");
const component = source("components/journey-command-center.tsx");
const styles = source("components/journey-command-center.module.css");
const browserChecks = source("scripts/test-journey-command-center-browser.ts");

assert.match(component, /aria-label="Journey overview" data-count=/, "Summary layout must adapt to supported information only.");
assert.match(component, /data-record-identity=/);
assert.match(component, /data-record-progress=/);
assert.match(component, /data-record-actions=/);
assert.match(component, /data-stage=\{record\.stageFilter\}/, "Progress color must be derived from the canonical Journey stage.");

assert.match(styles, /\.active\s*\{[^}]*padding-top:\s*2\.35rem/, "Primary workspace content needs deliberate separation from the summary.");
assert.match(styles, /\.toolbar nav\s*\{[^}]*border:\s*1px solid[^}]*border-radius:/, "Stage filters must read as one organized control group.");
assert.match(styles, /\.toolbar nav > a\[[^\]]*aria-current[^\]]*\][^}]*background:\s*var\(--journey-green\)/, "The active stage needs an unmistakable state.");
assert.match(styles, /\.record\s*\{[^}]*grid-template-columns:\s*minmax\(15rem,\s*1\.8fr\)/, "Opportunity identity must remain the dominant desktop column.");
assert.match(styles, /\.record\[data-stage="applied"\]::before/);
assert.match(styles, /\.record\[data-stage="interviewing"\]::before/);
assert.match(styles, /\.record\[data-stage="offers"\]::before/);
assert.match(styles, /\.recordUpdated[^}]*text-transform:\s*uppercase/, "Metadata should remain visually subordinate to titles and progress.");
assert.match(styles, /\.history\s*\{[^}]*margin-top:\s*2\.35rem/);
assert.match(styles, /\.cards\s*\{[^}]*margin-top:\s*2\.35rem/);
assert.match(styles, /@media\s*\(max-width:\s*700px\)[\s\S]*?\.recordMain\s*\{\s*grid-column:\s*1\s*\/\s*-1/, "Mobile titles must use the full first row.");
assert.match(styles, /@media\s*\(max-width:\s*700px\)[\s\S]*?\.recordActions\s*\{[^}]*grid-row:\s*2/, "Mobile actions must sit beside progress rather than squeeze the title.");
assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);

assert.match(browserChecks, /Journey sections must retain a clear reading order/);
assert.match(browserChecks, /Desktop opportunity identity must remain the dominant record column/);
assert.match(browserChecks, /Mobile opportunity identity must use the full first row/);
assert.match(browserChecks, /Mobile progress and actions must not overlap/);
assert.match(browserChecks, /journey-command-tablet\.png/);

console.log("Journey premium-workspace hierarchy checks passed.");
