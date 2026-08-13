import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, webkit, type BrowserType } from "playwright";

const path = join(tmpdir(), `unlocked-lifecycle-${process.pid}.html`);
await writeFile(path, `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width"><style>
:root{color-scheme:light dark;--bg:#fbf8f1;--surface:#fff;--text:#29211c;--green:#145c41;--border:#d9d2c7}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px system-ui;padding:32px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;max-width:960px;margin:auto}.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px}.badge{display:inline-block;border:1px solid currentColor;padding:5px 8px;color:var(--green);font-size:12px;font-weight:700}.action{display:flex;min-height:44px;align-items:center;justify-content:center;margin-top:18px;background:var(--green);color:white;text-decoration:none}.secondary{background:transparent;color:var(--green);border:1px solid var(--green)}@media(max-width:640px){body{padding:16px}.grid{grid-template-columns:1fr}.card{padding:18px}}@media(prefers-color-scheme:dark){:root{--bg:#171a17;--surface:#20251f;--text:#f7f1e7;--green:#8bc6a4;--border:#495048}.action{color:#10281d}}
</style></head><body><main><h1>Opportunity lifecycle</h1><div class="grid">
<article class="card" data-state="open"><span class="badge" aria-label="Applications open; confirmed">Applications open</span><h2>Open program</h2><dl><div><dt>Deadline</dt><dd>Sep 21, 2026</dd></div><div class="trust"><dt>Source</dt><dd>Verified from NASA · Aug 8</dd></div></dl><section data-recent-updates><h3>Recent updates</h3><time datetime="2027-05-15T12:00:00.000Z">May 15, 2027</time><strong>Deadline extended</strong><p>Jun 15, 2027 → Jul 1, 2027</p></section><a class="action" href="https://example.edu/apply">View official application</a></article>
<article class="card" data-state="upcoming"><span class="badge" aria-label="Opening soon; strong evidence">Opening soon</span><h2>Upcoming program</h2><dl><div><dt>Deadline</dt><dd>Deadline not confirmed</dd></div><div class="trust"><dt>Eligibility</dt><dd>Eligibility not fully confirmed</dd></div></dl><section data-empty-updates hidden><h3>Recent updates</h3></section><a class="action secondary" href="https://example.edu">Check provider source</a></article>
<article class="card" data-state="closed"><span class="badge" aria-label="Current cycle closed; confirmed">Current cycle closed</span><h2>Recurring program</h2><a class="action secondary" href="https://example.edu">View official source</a></article>
</div></main></body></html>`);

async function validate(name: string, browserType: BrowserType) {
  const browser = await browserType.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: "dark", reducedMotion: "reduce" });
    await page.goto(`file://${path}`);
    assert.equal(await page.locator(".card").count(), 3);
    assert.equal(await page.locator('[data-state="open"] .action').textContent(), "View official application");
    assert.equal(await page.locator('[data-state="closed"] .action').textContent(), "View official source");
    assert.ok((await page.locator('[data-state="open"] .action').boundingBox())!.height >= 44);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
    assert.match(await page.locator('[data-state="upcoming"] .badge').getAttribute("aria-label") ?? "", /Opening soon/);
    assert.match(await page.locator('[data-state="open"] .trust').textContent() ?? "", /Verified from NASA/);
    assert.match(await page.locator('[data-state="upcoming"]').textContent() ?? "", /Deadline not confirmed/);
    assert.match(await page.locator('[data-state="upcoming"]').textContent() ?? "", /Eligibility not fully confirmed/);
    assert.equal(await page.locator("[data-recent-updates]").isVisible(), true);
    assert.equal(await page.locator("[data-empty-updates]").isVisible(), false);
    await page.locator('[data-state="open"] .action').focus();
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), "View official application");
    console.log(`✓ ${name}: mobile, dark theme, reduced motion, labels, actions, and keyboard access`);
  } finally {
    await browser.close();
  }
}

await validate("Chromium", chromium);
await validate("WebKit", webkit);
