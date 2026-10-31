const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function main() {
  const root = path.resolve(__dirname, "..");
  const browser = await chromium.launch({
    channel: process.env.BROWSER_EXECUTABLE_PATH
      ? undefined
      : process.env.BROWSER_CHANNEL || "chromium",
    executablePath: process.env.BROWSER_EXECUTABLE_PATH,
    headless: true,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      if (localStorage.getItem("test.reset-fixture")) return;
      localStorage.setItem("test.reset-fixture", "keep");
      localStorage.setItem(
        "emberline.economy",
        JSON.stringify({
          version: 2,
          balance: "999",
          owned: ["character:hare", "weapon:pulse"],
          upgrades: { dash: 5, jump: 5, damage: 5, triple: 1 },
        }),
      );
      localStorage.setItem("emberline.coins", "777");
      localStorage.setItem("emberline.best", "1200");
      localStorage.setItem(
        "emberline.loadout",
        JSON.stringify({ character: "hare", weapon: "pulse", difficulty: "hard" }),
      );
      localStorage.setItem("emberline.muted", "true");
      localStorage.setItem("emberline.effects", "false");
    });
    const url = pathToFileURL(path.join(root, "index.html"));
    url.search = "?dev=1";
    await page.goto(url.href);
    await page.click("#start");
    await page.click("#setup");
    await page.click("#tab-settings");
    await page.click("#reset-progress");
    assert(await page.locator("#reset-confirmation").isVisible());
    assert.equal(await page.evaluate(() => EmberlineDebug.app.coins.toString()), "999");
    await page.click("#reset-cancel");
    assert.equal(await page.locator("#reset-confirmation").isVisible(), false);
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.loadout.character), "hare");
    await page.click("#reset-progress");
    await page.keyboard.press("Escape");
    await page.click("#setup");
    assert.equal(await page.locator("#reset-confirmation").isVisible(), false);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.click("#reset-progress");
    await page.screenshot({ path: path.join(root, "test-results/reset-confirmation-mobile.png") });
    assert.equal(
      await page.evaluate(
        () =>
          document.getElementById("setup-dialog").scrollWidth >
          document.getElementById("setup-dialog").clientWidth,
      ),
      false,
    );
    await Promise.all([page.waitForEvent("domcontentloaded"), page.click("#reset-confirm")]);
    await page.waitForFunction(() => window.EmberlineDebug?.app.coins === 0n);
    assert.equal(await page.evaluate(() => EmberlineDebug.app.coins.toString()), "0");
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.mode), "menu");
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.loadout.character), "fox");
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.loadout.weapon), "punch");
    assert.equal(
      await page.evaluate(() => EmberlineDebug.app.state.loadout.difficulty),
      "standard",
    );
    assert.deepEqual(await page.evaluate(() => EmberlineDebug.app.economy.levels), {
      dash: 0,
      jump: 0,
      damage: 0,
      triple: 0,
    });
    assert.equal(await page.locator("#best").innerText(), "000000");
    assert.equal(await page.locator("#sound").innerText(), "SOUND OFF");
    assert.equal(await page.locator("#effects").isChecked(), false);
    assert.equal(await page.evaluate(() => localStorage.getItem("test.reset-fixture")), "keep");
    assert.equal(await page.evaluate(() => localStorage.getItem("emberline.coins")), null);
    await page.reload();
    assert.equal(await page.evaluate(() => EmberlineDebug.app.coins.toString()), "0");
    assert.equal(
      await page.evaluate(() => EmberlineDebug.app.economy.owns("character", "hare")),
      false,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS reset browser: Settings, confirmation/cancel/Escape, mobile layout, confirmed restart, all progress erased, preferences/unrelated data preserved and no legacy-save resurrection.",
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
