import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const header = read("components/header.tsx");
const loading = read("app/advisor/loading.tsx");
const advisorPage = read("app/advisor/page.tsx");
const callback = read("app/api/auth/callback/google/route.ts");
const proxy = read("proxy.ts");

assert.equal(existsSync("app/advisor/loading.tsx"), true, "For You needs an App Router loading boundary for cold navigation.");
assert.match(header, /import Link from "next\/link"/, "For You navigation must use a semantic Next.js link.");
assert.match(header, /\["For You", "\/advisor"\]/, "Desktop and mobile destinations must include For You.");
assert.match(header, /prefetch=\{href === "\/advisor" \? false/, "For You must not prefetch expensive recommendation generation on hover.");
assert.match(header, /onClick=\{\(\) => \{[\s\S]*setPendingHref\(href\)/, "Clicks must provide immediate visible pending feedback.");
assert.match(header, /aria-busy=\{pending \|\| undefined\}/, "Pending navigation must be exposed to assistive technology.");
assert.doesNotMatch(header, /disabled=|pointer-events-none/, "For You links must never be silently disabled.");
assert.match(header, /aria-label="Primary navigation"/, "Desktop navigation must remain keyboard accessible.");
assert.match(header, /aria-label="Mobile navigation"/, "Mobile navigation must use the same semantic links.");
assert.match(header, /setPendingHref\(""\)[\s\S]*\[pathname\]/, "Completed navigation must clear pending state, including repeated clicks and account switches.");

assert.match(loading, /aria-busy="true"/, "Cold route loading must be announced immediately.");
assert.match(loading, /Preparing your recommendations/, "Cold starts and slow session stores need a bounded preparing state.");
assert.match(advisorPage, /requireCompletedOnboarding\(\)/, "The destination must remain server-authenticated.");
assert.match(advisorPage, /resolveForYouState\(session\.user, session\.data\)/, "The route must render server-first without waiting for client session warming.");

const cookieSet = callback.indexOf("response.cookies.set(sessionCookieName");
const callbackReturn = callback.indexOf("return response", cookieSet);
assert.ok(cookieSet >= 0 && callbackReturn > cookieSet, "OAuth must attach the session cookie before redirecting to For You.");
assert.match(callback, /accountHasCompletedOnboarding\(accountData\) \? "\/advisor" : "\/onboarding"/, "Returning users must still redirect directly to For You.");
assert.match(proxy, /"\/advisor"/, "The edge proxy must protect For You immediately after login.");
assert.match(proxy, /signedSessionIsValid/, "The proxy must validate the signed cookie without waiting for the remote session store.");

console.log(JSON.stringify({
  desktopSemanticLink: true,
  mobileSemanticLink: true,
  keyboardNavigation: true,
  immediatePendingFeedback: true,
  coldStartBoundary: true,
  slowSessionStoreBoundary: true,
  oauthCookieBeforeRedirect: true,
  repeatedClicksNotDisabled: true,
  accountSwitchPendingReset: true,
}, null, 2));
