import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const header = read("components/header.tsx");
const styles = read("app/globals.css");
const pkg = read("package.json");

for (const label of ["Discover", "For You", "Journey"]) {
  assert.ok(header.includes(`${label}: [`) || header.includes(`"${label}": [`), `${label} must have contextual navigation backed by real product states.`);
}
for (const href of [
  "/opportunities?type=Scholarship",
  "/opportunities?type=Career&category=Internships",
  "/opportunities?type=Research",
  "/opportunities?type=Benefit",
  "/advisor#more-matches-title",
  "/profile#interests",
  "/?stage=applied#active-opportunities",
  "/?stage=history#journey-history",
  "/#journey-cards",
]) assert.ok(header.includes(href), `Premium navigation must preserve real destination ${href}.`);

for (const token of ["data-context-destination", "data-context-trigger", "data-context-panel", "aria-expanded", "aria-controls", "onMouseEnter", "onMouseLeave", "onFocusCapture", "onBlurCapture", 'event.key !== "Escape"', "140"]) {
  assert.ok(header.includes(token), `Premium contextual navigation must include ${token}.`);
}
assert.doesNotMatch(header, /onClick=|preventDefault\(\)|from "next\/link"/, "Premium panels must not intercept or delay native product navigation.");
assert.doesNotMatch(header, /framer-motion|gsap|motion\//, "Premium navigation must not add a heavy animation runtime.");
assert.match(header, /hidden w-\[21rem\][\s\S]*lg:grid/, "Contextual panels must remain desktop-only.");
assert.match(header, /data-product-header[\s\S]*data-scrolled/, "The sticky product header must expose a restrained scrolled state.");

for (const token of ["[data-product-header]", '[data-product-header][data-scrolled="true"]', "[data-context-destination]::after", "[data-context-panel]", '[data-context-destination][data-open="true"] [data-context-panel]', '[data-navigation-item][data-active="true"]::after']) {
  assert.ok(styles.includes(token), `Shared navigation styles must include ${token}.`);
}
assert.match(styles, /prefers-reduced-motion:\s*reduce/, "Premium navigation must inherit the product reduced-motion contract.");
assert.doesNotMatch(styles, /transition:\s*all\b/, "Premium navigation must animate only narrowly scoped properties.");
assert.ok(pkg.includes("check:premium-navigation"), "Package scripts must expose the premium navigation regression check.");

console.log("Premium navigation and product-feel checks passed.");
