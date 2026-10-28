const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");

async function main() {
  const root = path.resolve(__dirname, "..");
  const output = path.join(root, "test-results");
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || "msedge",
    headless: true,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    await page.addInitScript(() => {
      if (!localStorage.getItem("test.gear-funded")) {
        localStorage.setItem("emberline.coins", "20000");
        localStorage.setItem("test.gear-funded", "yes");
      }
    });
    page.on("pageerror", (error) => {
      errors.push(error.message);
      console.error(error.message);
    });
    const url = pathToFileURL(path.join(root, "index.html"));
    url.search = "?seed=gear-check&dev=1";
    await page.goto(url.href);
    await page.screenshot({ path: path.join(output, "v3-menu.png") });
    await page.click("#menu-setup");
    assert(await page.locator("#setup-dialog").isVisible());
    await page.keyboard.press("x");
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.mode), "menu");
    await page.click("#tab-character");
    await page.locator("#tab-character").focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.locator("#tab-cape").getAttribute("aria-selected"), "true");
    for (const [tab, value] of [
      ["character", "hare"],
      ["cape", "storm"],
      ["jetpack", "twin"],
      ["weapon", "pulse"],
    ]) {
      await page.click("#tab-" + tab);
      await page.check(`input[name="loadout-${tab}"][value="${value}"]`);
      if (await page.locator("#shop-buy").isVisible()) await page.click("#shop-buy");
    }
    await page.screenshot({ path: path.join(output, "v3-loadout.png") });
    await page.click("#tab-difficulty");
    await page.check('input[name="loadout-difficulty"][value="hard"]');
    await page.screenshot({ path: path.join(output, "v3-difficulty.png") });
    await page.locator("#tune-health").focus();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowRight");
    assert(await page.locator('input[value="custom"]').isChecked());
    await page.check('input[name="loadout-difficulty"][value="standard"]');
    await page.click("#setup-ready");
    await page.click("#start");
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.health), 3);
    const loadout = await page.evaluate(() => EmberlineDebug.app.state.loadout);
    assert.equal(loadout.character, "hare");
    assert.equal(loadout.cape, "storm");
    assert.equal(loadout.jetpack, "twin");
    assert.equal(loadout.weapon, "pulse");
    await page.click("#fullscreen");
    await page.click("#setup");
    assert(await page.evaluate(() => Boolean(document.fullscreenElement)));
    assert(await page.locator("#setup-dialog").isVisible());
    await page.click("#setup-ready");
    await page.click("#fullscreen");
    await page.click("#pause");
    await page.evaluate(() => {
      EmberlineDebug.app.state.next = Infinity;
      EmberlineDebug.app.state.objects = [];
    });

    const beforeCoins = await page.evaluate(() => EmberlineDebug.app.coins.toString());
    await page.evaluate(() => {
      const state = EmberlineDebug.app.state;
      Object.assign(state.player, { y: 178, vy: 0, jumps: 0 });
      state.objects = [{ kind: "ember", x: state.player.x + 3, y: 181, w: 5, h: 6 }];
    });
    await page.waitForTimeout(90);
    const bank = await page.evaluate(() => EmberlineDebug.app.coins.toString());
    assert.equal(BigInt(bank), BigInt(beforeCoins) + 2n);
    assert(
      await page.evaluate(() =>
        EmberlineDebug.app.popups.items.some(
          (item) => item.text === "+55" && item.detail === "+2 COINS",
        ),
      ),
    );
    await page.screenshot({ path: path.join(output, "v3-pickup.png") });

    await page.evaluate(() => {
      const state = EmberlineDebug.app.state;
      state.objects = [
        { kind: "hazard", variant: "crate", x: state.player.x + 95, y: 182, w: 13, h: 14 },
      ];
    });
    await page.keyboard.press("x");
    await page.waitForTimeout(280);
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.objects.length), 0);
    assert(
      await page.evaluate(() =>
        EmberlineDebug.app.popups.items.some((item) => item.text === "+100"),
      ),
    );
    await page.screenshot({ path: path.join(output, "v3-combat.png") });

    const beforeDistance = await page.evaluate(() => EmberlineDebug.app.state.distance);
    await page.keyboard.press("Shift");
    await page.waitForTimeout(180);
    assert(await page.evaluate(() => EmberlineDebug.app.state.player.x > 90));
    assert((await page.evaluate(() => EmberlineDebug.app.state.distance)) - beforeDistance > 17);
    await page.screenshot({ path: path.join(output, "v3-dash.png") });

    // Changing difficulty in the paused setup does not rewrite a live run's rules.
    await page.click("#setup");
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.mode), "paused");
    await page.click("#tab-difficulty");
    await page.check('input[value="easy"]');
    await page.click("#setup-ready");
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.health), 3);
    await page.reload();
    assert.equal(await page.evaluate(() => EmberlineDebug.app.coins.toString()), bank);
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.loadout.weapon), "pulse");
    await page.click("#start");
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.health), 5);

    // Every character/gear/weapon variant is selectable and previewable.
    await page.click("#setup");
    for (const tab of ["character", "cape", "jetpack", "weapon"]) {
      await page.click("#tab-" + tab);
      const radios = page.locator(`input[name="loadout-${tab}"]`);
      for (let i = 0; i < (await radios.count()); i++) {
        await radios.nth(i).check();
        if (await page.locator("#shop-buy").isVisible()) await page.click("#shop-buy");
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.click("#tab-difficulty");
    await page.screenshot({ path: path.join(output, "v3-mobile-setup.png") });
    assert.equal(
      await page.evaluate(
        () =>
          document.getElementById("setup-dialog").scrollWidth >
          document.getElementById("setup-dialog").clientWidth,
      ),
      false,
    );
    await page.click("#setup-ready");
    assert.equal(await page.locator("#setup-dialog").isVisible(), false);
    await page.reload();
    await page.screenshot({ path: path.join(output, "v3-mobile.png") });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS gear browser: all equipment variants, animated preview, presets/custom sliders, live-run difficulty isolation, persistent loadout/coins, local score popups, projectile combat, physical dash and mobile setup.",
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
