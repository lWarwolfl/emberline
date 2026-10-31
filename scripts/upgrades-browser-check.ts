import { chromium } from "./browser";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

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
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
      console.error(error.message);
    });
    const url = pathToFileURL(path.join(root, "index.html"));
    url.search = "?dev=1&seed=upgrade-check";
    await page.goto(url.href);
    // Seed once in the loaded origin; a navigation hook can overwrite a migrated save.
    await page.evaluate(() => {
      localStorage.setItem(
        "emberline.economy",
        JSON.stringify({ version: 1, balance: "20000", owned: ["character:hare", "weapon:pulse"] }),
      );
      localStorage.setItem(
        "emberline.loadout",
        JSON.stringify({ character: "hare", weapon: "pulse" }),
      );
    });
    await page.reload();
    assert.equal(await page.evaluate(() => EmberlineDebug.app.coins.toString()), "20000");
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.loadout.weapon), "pulse");
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.stats.levels.jump), 0);
    await page.click("#start");
    await page.evaluate(() => {
      EmberlineDebug.app.state.objects = [];
      EmberlineDebug.app.state.next = Infinity;
    });
    await page.click("#setup");
    await page.click("#tab-upgrades");
    assert.equal(await page.locator(".profile-preview").isVisible(), false);
    assert.equal(await page.locator(".upgrade-product").count(), 4);
    assert.equal(
      await page
        .locator("#upgrade-row-jump details")
        .evaluate((node) => (node as HTMLDetailsElement).open),
      false,
    );
    assert.equal(await page.locator("#upgrade-row-jump details p").first().isVisible(), false);
    await page.locator("#upgrade-row-jump summary").click();
    assert.equal(await page.locator("#upgrade-row-jump details p").first().isVisible(), true);
    await page.locator("#upgrade-row-jump summary").click();
    assert((await page.locator("#upgrade-dash").innerText()).includes("100 COINS"));
    assert.equal(await page.locator("#upgrade-triple").getAttribute("data-cost"), "5000");
    await page.screenshot({ path: path.join(root, "test-results/v5-upgrades-basic.png") });

    let expected = 20000n;
    for (const track of ["dash", "jump", "damage"]) {
      for (let level = 0; level < 5; level++) {
        assert(
          (await page.locator("#upgrade-" + track).innerText()).includes(
            (level + 1) * 100 + " COINS",
          ),
        );
        await page.click("#upgrade-" + track);
        expected -= BigInt((level + 1) * 100);
        assert.equal(
          await page.evaluate(() => EmberlineDebug.app.coins.toString()),
          expected.toString(),
        );
      }
      assert(await page.locator("#upgrade-" + track).isDisabled());
      assert((await page.locator("#upgrade-" + track).innerText()).includes("MAX LEVEL"));
    }
    await page.click("#upgrade-triple");
    expected -= 5000n;
    assert(await page.locator("#upgrade-triple").isDisabled());
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.stats.maxJumps), 2);
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.stats.damageMultiplier), 1);
    assert.equal(
      await page.evaluate(() => EmberlineDebug.app.state.stats.dashWorldMultiplier),
      1.18,
    );
    await page.screenshot({ path: path.join(root, "test-results/v5-upgrades-maxed.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(root, "test-results/v5-upgrades-mobile.png") });
    assert.equal(
      await page.evaluate(
        () =>
          document.getElementById("setup-dialog")!.scrollWidth >
          document.getElementById("setup-dialog")!.clientWidth,
      ),
      false,
    );
    await page.click("#setup-ready");
    await page.click("#pause");
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.stats.maxJumps), 2);
    const persisted = await page.evaluate(
      () => JSON.parse(localStorage.getItem("emberline.economy")!) as { balance: string },
    );
    assert.equal(persisted.balance, expected.toString());
    await page.reload();
    const reloaded = await page.evaluate(() => ({
      balance: EmberlineDebug.app.coins.toString(),
      saved: JSON.parse(localStorage.getItem("emberline.economy")!),
    }));
    assert.equal(reloaded.balance, expected.toString(), JSON.stringify(reloaded));
    assert.equal(
      await page.evaluate(() => EmberlineDebug.app.coins.toString()),
      expected.toString(),
    );
    assert.deepEqual(await page.evaluate(() => EmberlineDebug.app.economy.levels), {
      dash: 5,
      jump: 5,
      damage: 5,
      triple: 1,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.click("#start");
    await page.evaluate(() => {
      EmberlineDebug.app.state.objects = [];
      EmberlineDebug.app.state.next = Infinity;
    });
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.stats.maxJumps), 3);
    assert.equal(await page.locator("#jump-count").innerText(), "×3");
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("Space");
      await page.waitForTimeout(50);
    }
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.player.jumps), 3);
    await page.keyboard.press("Space");
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.player.jumps), 3);
    await page.screenshot({ path: path.join(root, "test-results/v5-triple-jump.png") });
    await page.waitForTimeout(1500);
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.player.jumps), 0);
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.stats.damageMultiplier), 2);
    await page.evaluate(() => {
      const state = EmberlineDebug.app.state;
      state.objects = [
        {
          kind: "enemy",
          variant: "drone",
          x: state.player.x + 95,
          y: 145,
          baseY: 145,
          w: 19,
          h: 12,
          age: 0,
          amplitude: 0,
          frequency: 0,
          phase: 0,
        },
      ];
    });
    await page.keyboard.press("x");
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.objects.length), 0);
    assert.deepEqual(errors, []);
    console.log(
      "PASS upgrade browser: legacy ownership migration, 100..500 prices, L5 limits, 5000-coin one-time triple jump, exact wallet debits, persistence, next-run stats, three actual jumps, max damage combat and mobile upgrade layout.",
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
