import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const globalStyles = read("app/globals.css");
const header = read("components/header.tsx");
const discover = read("components/opportunity-filter.tsx");
const opportunityCard = read("components/opportunity-card.tsx");
const journey = read("components/journey-editorial.module.css");
const advisor = read("components/advisor-page.module.css");
const resume = read("components/resume-lab.module.css");
const search = read("components/universal-command-center.module.css");
const packageJson = read("package.json");

for (const token of [
  "--unlocked-surface-subtle",
  "--unlocked-surface-elevated",
  "--unlocked-glass-subtle",
  "--unlocked-glass-strong",
  "--unlocked-border-highlight",
  "--unlocked-accent-glow",
  "--shadow-elevated",
  "--radius-panel",
  "--blur-elevated",
]) assert.match(globalStyles, new RegExp(token), `Missing visual-language token ${token}.`);

assert.match(globalStyles, /radial-gradient/, "The global shell needs static ambient depth.");
assert.doesNotMatch(globalStyles, /@keyframes[^}]*gradient/i, "Authenticated ambient gradients must remain static.");
assert.match(globalStyles, /@supports not \(\(backdrop-filter:/, "Glass needs a non-blur fallback.");
assert.match(globalStyles, /prefers-reduced-transparency/, "Glass needs a reduced-transparency fallback.");
assert.match(globalStyles, /@media print[\s\S]*background:\s*white/, "Print must remove application materials.");
assert.match(header, /data-product-header/, "Public and product navigation must use the shared material shell.");
assert.match(discover, /data-discover-search-shell/, "Discover search must use the bounded glass search surface.");
assert.match(opportunityCard, /background:\s*"var\(--unlocked-surface-subtle\)"/, "Dense Discover cards must remain quiet rather than glassy.");
assert.match(journey, /\.focusLayout[\s\S]*var\(--unlocked-surface-subtle\)/, "Journey needs one consolidated focus layer.");
assert.match(advisor, /\.recommendationFeatured[\s\S]*var\(--unlocked-glass-strong\)/, "For You may elevate only its lead recommendation.");
assert.match(resume, /\.paper[\s\S]*background:\s*#fff/, "The resume preview must remain solid paper.");
assert.match(search, /-webkit-backdrop-filter/, "Universal Search must support WebKit glass.");
assert.doesNotMatch(packageJson, /framer-motion|three|lottie|gsap/, "The visual rebuild must not add a visual runtime dependency.");

console.log("Premium visual-language checks passed.");
