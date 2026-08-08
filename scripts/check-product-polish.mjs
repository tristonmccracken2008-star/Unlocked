import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const read = (path) => readFileSync(path, "utf8");
const collectSourceFiles = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);

  if (entry.isDirectory()) {
    return collectSourceFiles(path);
  }

  return /\.(?:tsx|css)$/.test(entry.name) ? [path] : [];
});
const sourceFiles = [...collectSourceFiles("app"), ...collectSourceFiles("components")];
const productSource = sourceFiles.map((path) => read(path)).join("\n");
const styles = read("app/globals.css");
const notifications = read("components/notification-center.tsx");
const notificationStyles = read("components/notification-center.module.css");
const badges = read("components/status-badge.tsx");
const auth = read("components/account-auth.tsx");
const discover = read("components/opportunity-filter.tsx");
const adminReview = read("components/admin-review.tsx");
const pkg = read("package.json");

assert.doesNotMatch(productSource, /tracking-\[-[^\]]+\]/, "Editorial typography must not use inconsistent negative letter spacing.");
assert.doesNotMatch(productSource, /animate-spin|className=["'`][^"'`]*\bspinner\b/i, "Generic spinner UI must not return.");
assert.doesNotMatch(productSource, /href=["']#["']|href=["']javascript:/i, "Visible navigation must not use placeholder destinations.");
assert.doesNotMatch(notifications, /window\.location\.reload/, "Notification recovery must preserve page context.");
assert.match(notifications, /retryInitialLoad[\s\S]*setRetryVersion/, "Notification recovery must retry only its failed section.");
assert.match(notifications, /!loading && !error && !items\.length/, "A failed notification load must not also claim that the inbox is empty.");

for (const token of ["--unlocked-error-text", "--unlocked-error-border", "--unlocked-error-surface", '[data-inline-feedback][data-state="error"]', "overflow-wrap: anywhere", "var(--journey-gold,", "var(--journey-focus,"]) {
  assert.ok(styles.includes(token), `Shared polish styles must include ${token}.`);
}
for (const token of ["var(--unlocked-error-text)", "var(--unlocked-error-border)", "var(--unlocked-error-surface)"]) {
  assert.ok(notificationStyles.includes(token), `Notification errors must use theme-safe semantic color ${token}.`);
}

assert.doesNotMatch(badges, /text-\[(?:9|10)px\]/, "Trust and lifecycle labels must remain readable.");
assert.doesNotMatch(auth, /role="alert" className="[^"]*text-\[10px\]/, "Account errors must remain readable.");
assert.doesNotMatch(discover, /min-h-9[^\n]*(?:Clear all|Remove \$\{filter\.label\})/, "Discover filter actions must retain 44px targets.");
assert.doesNotMatch(adminReview, /min-h-10/, "Admin review controls must retain 44px targets.");
assert.ok(pkg.includes("check:product-polish"), "Package scripts must expose the final polish regression check.");

console.log(`Product-wide polish checks passed across ${sourceFiles.length} UI source files.`);
