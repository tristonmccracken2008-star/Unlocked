import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const header = read("components/header.tsx");
const loading = read("app/advisor/loading.tsx");
const loadingSystem = read("components/loading-system.tsx");
const advisorPage = read("app/advisor/page.tsx");
const callback = read("app/api/auth/callback/google/route.ts");
const proxy = read("proxy.ts");

assert.equal(existsSync("app/advisor/loading.tsx"), true, "For You needs an App Router loading boundary for cold navigation.");
assert.match(header, /return\s*\(?\s*<a[\s\S]*?href=\{href\}/, "For You navigation must use a native semantic link with immediate document navigation.");
assert.match(header, /\["For You", "\/advisor"\]/, "Desktop and mobile destinations must include For You.");
assert.doesNotMatch(header, /from "next\/link"/, "Authenticated header navigation must not wait for an App Router RSC transition.");
assert.doesNotMatch(header, /<a[\s\S]{0,500}onClick=\{[^}]*preventDefault/, "Header links must not intercept browser navigation.");
assert.match(header, /const openSearch = [\s\S]*event\.preventDefault\(\)/, "The explicit command shortcut must replace the browser's default Command-K behavior.");
assert.doesNotMatch(header, /disabled=|pointer-events-none/, "For You links must never be silently disabled.");
assert.match(header, /aria-label="Primary navigation"/, "Desktop navigation must remain keyboard accessible.");
assert.match(header, /aria-label="Mobile navigation"/, "Mobile navigation must use the same semantic links.");
assert.match(header, /active:scale-\[\.98\]/, "Header links must provide immediate pressed feedback without blocking navigation.");

assert.match(loading, /AdvisorRecommendationLoading/, "Cold route loading must use the shared recommendation skeleton.");
assert.match(loadingSystem, /aria-busy="true"/, "Cold route loading must be announced to assistive technology.");
assert.match(loadingSystem, /Loading For You/, "Cold starts need a calm, specific loading status.");
assert.match(advisorPage, /requireCompletedOnboarding\(\)/, "The destination must remain server-authenticated.");
assert.match(advisorPage, /<AdvisorPage initialState=\{initialState\} serverAuthenticated \/>/, "The destination must reuse safe server state immediately after authentication.");
assert.match(advisorPage, /allowGeneration: false/, "The route document must not wait for recommendation generation.");

const cookieSet = callback.indexOf("response.cookies.set(sessionCookieName");
const callbackReturn = callback.indexOf("return response", cookieSet);
assert.ok(cookieSet >= 0 && callbackReturn > cookieSet, "OAuth must attach the session cookie before redirecting to For You.");
assert.match(callback, /!accountHasCompletedOnboarding\(accountData\)[\s\S]*\? "\/onboarding"/, "New users must still enter onboarding.");
assert.match(callback, /accountHasCompletedFirstLaunch\(accountData\) \? "\/advisor" : "\/welcome"/, "Returning users must bypass first launch while newly onboarded users enter it.");
assert.match(proxy, /"\/advisor"/, "The edge proxy must protect For You immediately after login.");
assert.match(proxy, /signedSessionIsValid/, "The proxy must validate the signed cookie without waiting for the remote session store.");

console.log(JSON.stringify({
  desktopSemanticLink: true,
  mobileSemanticLink: true,
  keyboardNavigation: true,
  immediatePressedFeedback: true,
  coldStartBoundary: true,
  slowSessionStoreBoundary: true,
  oauthCookieBeforeRedirect: true,
  repeatedClicksNotDisabled: true,
  nativeDocumentNavigation: true,
}, null, 2));
