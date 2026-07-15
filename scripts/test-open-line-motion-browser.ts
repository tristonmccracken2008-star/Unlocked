import assert from "node:assert/strict";
import { chromium, webkit, type BrowserType } from "playwright";

const previewUrl = new URL("../docs/open-line-motion-laboratory.html", import.meta.url).href;

async function run(browserType: BrowserType, name: string) {
  const browser = await browserType.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(previewUrl);
    assert.equal(await page.locator("#scenario option").count(), 16, `${name} must load every laboratory scenario.`);
    await page.selectOption("#scenario", "submitted_to_validated");
    await page.click("#replay");
    await page.waitForTimeout(60);
    assert.equal(await page.locator("#transition").textContent(), "validation_received");
    assert.ok(await page.evaluate(() => document.getAnimations().length > 0), `${name} must run the selected bounded animation.`);
    await page.click("#skip");
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0, `${name} skip must cancel active animations.`);

    await page.selectOption("#scenario", "reduced_motion");
    assert.equal(await page.locator("#preference").textContent(), "reduced");
    await page.click("#replay");
    await page.waitForTimeout(260);
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0, `${name} reduced motion must settle quickly.`);

    await page.selectOption("#scenario", "no_motion");
    assert.equal(await page.locator("#preference").textContent(), "none");
    await page.click("#replay");
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0, `${name} no-motion mode must remain static.`);

    await page.selectOption("#scenario", "branch_rejoin");
    await page.click("#replay");
    await page.click("#interrupt");
    assert.equal(await page.locator("#scenario").inputValue(), "waypoint_change", `${name} interruption must advance to the newer canonical scenario.`);
    assert.equal(await page.locator("[data-motion-layer=\"current\"] svg").count(), 1);
  } finally {
    await browser.close();
  }
}

await run(chromium, "Chromium");
await run(webkit, "WebKit");
console.log("Open Line motion browser checks passed in Chromium and WebKit.");
