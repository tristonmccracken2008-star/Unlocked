import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function handleAuthQuery(currentUrl, authenticated) {
  const url = new URL(currentUrl);
  const auth = url.searchParams.get("auth");
  let message = "";
  if (auth) {
    if (!authenticated && auth === "failed") message = "Sign-in could not be completed. Please try again.";
    if (!authenticated && auth === "unavailable") message = "Google sign-in is temporarily unavailable. Please try again in a moment.";
    url.searchParams.delete("auth");
  }
  return {
    message,
    nextPath: `${url.pathname}${url.search}${url.hash}`,
  };
}

const signedInFailed = handleAuthQuery("https://unlockededu.com/?auth=failed", true);
assert.equal(signedInFailed.message, "", "Signed-in users must not see stale auth failure messages.");
assert.equal(signedInFailed.nextPath, "/", "Signed-in users visiting /?auth=failed should have auth removed without reload.");

const signedOutFailed = handleAuthQuery("https://unlockededu.com/?auth=failed", false);
assert.equal(signedOutFailed.message, "Sign-in could not be completed. Please try again.");
assert.equal(signedOutFailed.nextPath, "/", "Signed-out auth failures should be one-time messages.");

const successfulGoogleLogin = handleAuthQuery("https://unlockededu.com/?auth=signed-in", true);
assert.equal(successfulGoogleLogin.message, "", "Successful Google login should not show an auth error.");
assert.equal(successfulGoogleLogin.nextPath, "/", "Successful Google login should remove auth=signed-in.");

const cancelledGoogleLogin = handleAuthQuery("https://unlockededu.com/?auth=failed", false);
assert.equal(cancelledGoogleLogin.message, "Sign-in could not be completed. Please try again.", "Cancelled Google login should use a generic browser-safe message.");
assert.equal(cancelledGoogleLogin.nextPath, "/");

const signOutAndInAgain = handleAuthQuery("https://unlockededu.com/?auth=failed&utm_source=test#top", true);
assert.equal(signOutAndInAgain.message, "");
assert.equal(signOutAndInAgain.nextPath, "/?utm_source=test#top", "Auth cleanup should preserve unrelated query params and hash.");

const home = readFileSync("components/personalized-home.tsx", "utf8");
assert.match(home, /window\.history\.replaceState/, "Homepage must clean stale auth query params client-side without reloading.");
assert.match(home, /!session\.authenticated && auth === "failed"/, "Auth failure message must only be shown to signed-out users.");
assert.doesNotMatch(home, /error_description|providerError|stackTrace|access_token|id_token|refresh_token/i, "Homepage must not expose provider errors, stack traces, or OAuth tokens.");

const callback = readFileSync("app/api/auth/callback/google/route.ts", "utf8");
assert.match(callback, /console\.warn\("\[UnlockED auth\] OAuth callback rejected/, "OAuth callback should preserve server-side failure logging.");
assert.match(callback, /providerErrorDescription/, "OAuth callback should log provider cancellation/failure detail server-side.");
assert.match(callback, /\/\?auth=failed/, "OAuth callback should redirect with only a generic auth failure marker.");
assert.doesNotMatch(callback, /auth=\$\{|error_description\}/, "OAuth callback must not reflect provider error details into redirect URLs.");

console.log("Auth query handling checks passed.");
