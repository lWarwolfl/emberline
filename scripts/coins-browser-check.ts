import { chromium } from "./browser";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Page } from "playwright";

async function collect(page: Page, count: number, expectedBalance: bigint) {
  await page.evaluate((count) => {
    const state = EmberlineDebug.app.state;
    state.next = Infinity;
    Object.assign(state.player, { x: 82, y: 178, vy: 0, jumps: 0 });
    // Real collision events feed App's wallet handling, without changing the wallet directly.
    state.objects = Array.from({ length: count }, () => ({
      kind: "ember" as const,
      variant: "ground",
      x: 85,
      y: 181,
      w: 5,
      h: 6,
    }));
  }, count);
  await page.waitForFunction(
    (balance) => EmberlineDebug.app.coins.toString() === balance,
    expectedBalance.toString(),
  );
}

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
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 390, height: 844 },
    ]) {
      const page = await browser.newPage({ viewport });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const url = pathToFileURL(path.resolve(__dirname, "../index.html"));
      url.search = "?dev=1&seed=earned-coins-check";
      await page.goto(url.href);
      await page.click("#menu-setup");
      assert.equal(await page.locator(".upgrade-wallet strong").innerText(), "0");
      assert(await page.locator("#upgrade-dash").isDisabled());
      await page.click("#setup-ready");
      await page.click("#start");
      await collect(page, 50, 100n);
      await page.click("#setup");
      assert.equal(await page.locator(".upgrade-wallet strong").innerText(), "100");
      assert(await page.locator("#upgrade-dash").isEnabled());
      await page.click("#upgrade-dash");
      assert.equal(await page.locator(".upgrade-wallet strong").innerText(), "0");
      assert.equal(await page.evaluate(() => EmberlineDebug.app.economy.levels.dash), 1);
      assert(await page.locator("#upgrade-jump").isDisabled());
      await page.click("#setup-ready");
      await page.click("#pause");
      await collect(page, 100, 200n);
      await page.click("#setup");
      assert.equal(await page.locator(".upgrade-wallet strong").innerText(), "200");
      assert.equal(await page.locator("#upgrade-dash").getAttribute("data-cost"), "200");
      assert(await page.locator("#upgrade-dash").isEnabled());
      await page.click("#upgrade-dash");
      assert.equal(await page.evaluate(() => EmberlineDebug.app.economy.levels.dash), 2);
      assert.equal(await page.evaluate(() => EmberlineDebug.app.coins), 0n);
      // A previously unaffordable gear preview must become purchasable on reopen too.
      await page.click("#tab-cape");
      await page.check('input[name="loadout-cape"][value="signal"]');
      assert(await page.locator("#shop-buy").isDisabled());
      await page.click("#setup-ready");
      await page.click("#pause");
      await collect(page, 125, 250n);
      await page.click("#setup");
      assert.equal(await page.locator("#shop-balance").innerText(), "250");
      assert(await page.locator("#shop-buy").isEnabled());
      const insets = await page.locator("#setup-dialog .setup-footer").evaluate((node) => {
        const footer = node.getBoundingClientRect();
        const button = node.querySelector("button")!.getBoundingClientRect();
        return { left: button.left - footer.left, right: footer.right - button.right };
      });
      assert(insets.left >= 16 && insets.right >= 16, JSON.stringify(insets));
      await page.screenshot({
        path: path.join(root, `test-results/earned-coins-shop-${viewport.width}.png`),
      });
      await page.click("#shop-buy");
      assert.equal(await page.evaluate(() => EmberlineDebug.app.coins), 0n);
      assert.equal(await page.evaluate(() => EmberlineDebug.app.state.loadout.cape), "signal");
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log(
      "PASS earned coins: upgrade wallet, affordability, repeat purchases and locked gear refresh immediately without reloading on desktop/mobile.",
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
