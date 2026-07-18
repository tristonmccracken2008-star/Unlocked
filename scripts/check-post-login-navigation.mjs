import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const header = read("components/header.tsx");
const callback = read("app/api/auth/callback/google/route.ts");
const sessionRoute = read("app/api/auth/session/route.ts");
const advisorRoute = read("app/advisor/page.tsx");
const proxy = read("proxy.ts");

assert.equal(existsSync("app/advisor/loading.tsx"), true, "For You must have an immediate route loading boundary.");
assert.match(header, /return <a[\s\S]*href=\{href\}/, "Product navigation must use a native semantic link.");
assert.match(header, /isServerProtectedProductPath\(pathname\)/, "Protected product routes must render navigation without waiting for client session hydration.");
assert.doesNotMatch(header, /preventDefault\(\)/, "Product navigation must never intercept or defer a normal link click.");
assert.doesNotMatch(header, /pointer-events-none|disabled=\{[^}]*pendingHref/, "Pending navigation must remain clickable and keyboard accessible.");
assert.doesNotMatch(header, /from "next\/link"|setPendingHref/, "Navigation must not wait for a client router transition.");
assert.match(advisorRoute, /requireCompletedOnboarding\(\)/, "The destination route must authenticate from the incoming cookie.");
assert.match(advisorRoute, /await requireCompletedOnboarding\(\)/, "The destination must complete server authorization before rendering.");
assert.match(advisorRoute, /<AdvisorPage initialState=\{initialState\} serverAuthenticated \/>/, "The route must render a server-authorized state without waiting for client session hydration.");
assert.match(advisorRoute, /allowGeneration: false/, "Cold recommendation generation must not block the destination document response.");
assert.match(advisorRoute, /await import\("@\/lib\/for-you-snapshot"\)/, "Free first-login navigation must not initialize the Pro recommendation stack.");

const persistSession = callback.indexOf("await createSession(user)");
const createRedirect = callback.indexOf("NextResponse.redirect", persistSession);
const setCookie = callback.indexOf("response.cookies.set(sessionCookieName", createRedirect);
const returnResponse = callback.indexOf("return response", setCookie);
assert.ok(persistSession >= 0 && createRedirect > persistSession, "OAuth must await server-backed session persistence before redirect creation.");
assert.ok(setCookie > createRedirect && returnResponse > setCookie, "OAuth must commit the cookie before returning the redirect.");
assert.match(callback, /New session persistence complete/, "OAuth must expose a safe session-persistence timing checkpoint.");
assert.match(callback, /Session cookie committed/, "OAuth must expose a safe cookie-commit checkpoint.");
assert.match(sessionRoute, /Session lookup complete/, "The first session request must have a safe lookup timing checkpoint.");
assert.match(proxy, /signedSessionIsValid/, "The edge guard must validate the signed cookie without warming the remote session store.");
assert.match(proxy, /private, no-store, max-age=0/, "Protected route responses must not remain visible through browser history cache after logout.");

console.log("Post-login navigation regression checks passed.");
