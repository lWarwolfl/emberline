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
    await page.addInitScript(() => {
      if (!localStorage.getItem("test.shop-funded")) {
        localStorage.setItem("emberline.coins", "235");
        localStorage.setItem("test.shop-funded", "yes");
      }
    });
    page.on("pageerror", (error) => {
      errors.push(error.message);
      console.error(error.message);
    });
    const url = pathToFileURL(path.join(root, "index.html"));
    url.search = "?dev=1&seed=shop-check";
    await page.goto(url.href);
    const balance = () => page.evaluate(() => EmberlineDebug.app.coins.toString());
    const coin = async () => {
      await page.evaluate(() => {
        const state = EmberlineDebug.app.state;
        state.next = Infinity;
        Object.assign(state.player, { x: 82, y: 178, vy: 0, jumps: 0 });
        state.objects = [{ kind: "ember", variant: "", x: 85, y: 181, w: 5, h: 6 }];
      });
      await page.waitForTimeout(70);
    };
    await page.click("#menu-setup");
    await page.click("#tab-character");
    await page.check('input[name="loadout-character"][value="bot"]');
    assert.equal(await page.locator("#profile-status").innerText(), "PREVIEW / NOT OWNED");
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.loadout.character), "fox");
    assert(await page.locator("#shop-buy").isDisabled());
    assert((await page.locator("#shop-buy").innerText()).includes("265"));
    await page.screenshot({ path: path.join(root, "test-results/v4-shop-locked.png") });

    // Earn purchase funds through actual hard-mode pickup events, not a wallet hook.
    await page.click("#tab-difficulty");
    await page.check('input[value="hard"]');
    await page.click("#setup-ready");
    await page.click("#start");
    for (let i = 0; i < 5; i++) await coin();
    assert.equal(await balance(), "250");
    await page.click("#setup");
    await page.click("#tab-cape");
    await page.check('input[name="loadout-cape"][value="signal"]');
    assert(await page.locator("#shop-buy").isEnabled());
    await page.screenshot({ path: path.join(root, "test-results/v4-shop-affordable.png") });
    await page.click("#shop-buy");
    assert.equal(await balance(), "0");
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.loadout.cape), "signal");
    assert(await page.evaluate(() => EmberlineDebug.app.economy.owns("cape", "signal")));
    assert.equal(await page.locator("#shop-buy").isVisible(), false);
    await page.check('input[name="loadout-cape"][value="ember"]');
    await page.check('input[name="loadout-cape"][value="signal"]');
    assert.equal(await balance(), "0");
    await page.screenshot({ path: path.join(root, "test-results/v4-shop-owned.png") });
    await page.reload();
    assert.equal(await balance(), "0");
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.loadout.cape), "signal");

    for (const [difficulty, reward] of [
      ["easy", 1n],
      ["standard", 2n],
      ["hard", 3n],
      ["custom", 0n],
    ] as const) {
      await page.reload();
      await page.click("#menu-setup");
      await page.click("#tab-difficulty");
      await page.check(`input[value="${difficulty}"]`);
      await page.click("#setup-ready");
      await page.click("#start");
      const before = BigInt(await balance());
      await coin();
      assert.equal(BigInt(await balance()), before + reward);
      assert.equal(await page.evaluate(() => EmberlineDebug.app.state.embers), Number(reward));
      if (difficulty === "custom") {
        assert(
          await page.evaluate(() =>
            EmberlineDebug.app.popups.items.some((item) => item.detail === "NO COINS"),
          ),
        );
        assert(await page.evaluate(() => EmberlineDebug.app.state.score >= 55n));
        // Pending setup changes never change the current custom run's reward rules.
        await page.click("#setup");
        await page.click("#tab-difficulty");
        await page.check('input[value="hard"]');
        await page.click("#setup-ready");
        await page.click("#pause");
        await coin();
        assert.equal(BigInt(await balance()), before);
      }
    }
    await page.click("#setup");
    await page.click("#tab-weapon");
    await page.check('input[name="loadout-weapon"][value="scatter"]');
    await page.setViewportSize({ width: 390, height: 844 });
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      const pinned = await page.evaluate(() => {
        const panel = document.getElementById("loadout-panel")!;
        panel.scrollTop = 0;
        const preview = document.getElementById("loadout-preview")!;
        const before = preview.getBoundingClientRect().top;
        panel.scrollTop = panel.scrollHeight;
        const footer = document
          .querySelector("#setup-dialog .setup-footer")!
          .getBoundingClientRect();
        const buy = document.getElementById("shop-buy")!.getBoundingClientRect();
        return {
          before,
          after: preview.getBoundingClientRect().top,
          scrolled: panel.scrollTop,
          footerTop: footer.top,
          buyTop: buy.top,
          buyBottom: buy.bottom,
          dialogBottom: document.getElementById("setup-dialog")!.getBoundingClientRect().bottom,
        };
      });
      assert(pinned.scrolled > 0);
      assert.equal(pinned.before, pinned.after);
      assert(pinned.buyTop >= pinned.footerTop && pinned.buyBottom <= pinned.dialogBottom);
    }
    await page.screenshot({ path: path.join(root, "test-results/v4-shop-mobile.png") });
    assert.equal(
      await page.evaluate(
        () =>
          document.getElementById("setup-dialog")!.scrollWidth >
          document.getElementById("setup-dialog")!.clientWidth,
      ),
      false,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS shop browser: locked previews, insufficient funds, real earned-coin purchase, debit once, free re-equip, ownership/reload, x1/x2/x3/custom-zero earnings, active-run reward isolation and mobile shop.",
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
