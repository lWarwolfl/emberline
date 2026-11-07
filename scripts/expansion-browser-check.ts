import { chromium } from "./browser";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function main() {
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
    page.on("pageerror", (error) => errors.push(error.message));
    const root = path.resolve(__dirname, "..");
    const url = pathToFileURL(path.join(root, "index.html"));
    url.search = "?dev=1&seed=expansion-check";
    await page.goto(url.href);
    await page.evaluate(() =>
      localStorage.setItem(
        "emberline.economy",
        JSON.stringify({ version: 2, balance: "75000", owned: [], upgrades: {} }),
      ),
    );
    await page.reload();
    let balance = 75000n;
    for (const [id, price] of [
      ["lynx", 2000n],
      ["moth", 2800n],
      ["diver", 3500n],
      ["specter", 4200n],
    ] as const) {
      await page.click("#menu-setup");
      await page.click("#tab-character");
      await page.check(`input[name="loadout-character"][value="${id}"]`);
      assert.equal(await page.locator("#profile-status").innerText(), "PREVIEW / NOT OWNED");
      await page.click("#shop-buy");
      balance -= price;
      assert.equal(await page.evaluate(() => EmberlineDebug.app.state.loadout.character), id);
      assert.equal(await page.evaluate(() => EmberlineDebug.app.coins), balance);
      await page.screenshot({ path: path.join(root, `test-results/new-skin-${id}.png`) });
      await page.click("#setup-ready");
    }
    await page.click("#start");
    for (const [id, price, count] of [
      ["repeater", 3600n, 1],
      ["rail", 5200n, 1],
      ["siegebreaker", 25000n, 1],
      ["nova", 4400n, 5],
    ] as const) {
      await page.click("#setup");
      await page.click("#tab-weapon");
      await page.check(`input[name="loadout-weapon"][value="${id}"]`);
      await page.click("#shop-buy");
      balance -= price;
      assert.equal(await page.evaluate(() => EmberlineDebug.app.state.loadout.weapon), id);
      assert.equal(await page.evaluate(() => EmberlineDebug.app.coins), balance);
      await page.click("#setup-ready");
      await page.click("#pause");
      await page.evaluate(() => {
        const s = EmberlineDebug.app.state;
        s.objects = [];
        s.projectiles = [];
        s.traversals = [];
        s.hostileProjectiles = [];
        s.next = Infinity;
        s.invincible = 1000;
        s.attackCooldown = 0;
      });
      await page.keyboard.press("x");
      await page.waitForFunction(
        (count) => EmberlineDebug.app.state.projectiles.length === count,
        count,
      );
      assert(
        await page.evaluate((weapon) => {
          const bolts = EmberlineDebug.app.state.projectiles;
          if (weapon === "nova") {
            const vys = bolts.map((bolt) => bolt.vy);
            return (
              bolts.every((bolt) => bolt.homing && Number.isFinite(bolt.vx)) &&
              vys.some((vy) => vy < -40) &&
              vys.some((vy) => vy > 40)
            );
          }
          return bolts.every((bolt) => Number.isFinite(bolt.vx) && bolt.vy === 0);
        }, id),
      );
      await page.screenshot({ path: path.join(root, `test-results/new-gun-${id}.png`) });
    }
    await page.evaluate(() => {
      const s = EmberlineDebug.app.state;
      s.mode = "paused";
      s.sector = 10;
      s.projectiles = [];
      s.objects = ["sentry", "beetle", "wasp", "wisp"].map((id, i) => {
        const o = Emberline.Generator.enemy(s, 190 + i * 70, id);
        return { ...o, charge: id === "sentry" || id === "wasp" ? 0.5 : 0, aimX: 89, aimY: 187 };
      });
      s.traversals = [
        { kind: "portal", x: 140, y: 153, w: 22, h: 43, age: 1 },
        { kind: "pad", x: 445, y: 191, w: 26, h: 5, age: 1 },
      ];
    });
    await page.screenshot({ path: path.join(root, "test-results/expansion-encounter.png") });
    await page.evaluate(() => {
      const s = EmberlineDebug.app.state;
      s.mode = "playing";
      s.traversals = [];
      s.hostileProjectiles = [];
      s.next = Infinity;
      s.objects = [{ ...Emberline.Generator.enemy(s, 440, "sentry"), shotCooldown: 0 }];
    });
    await page.waitForFunction(() =>
      EmberlineDebug.app.state.objects.some((o) => (o.charge ?? 0) > 0.3),
    );
    await page.screenshot({ path: path.join(root, "test-results/expansion-warning.png") });
    await page.waitForFunction(() => EmberlineDebug.app.state.hostileProjectiles.length > 0);
    await page.screenshot({ path: path.join(root, "test-results/expansion-enemy-shot.png") });
    const beforePad = await page.evaluate(() => EmberlineDebug.app.state.distance);
    await page.evaluate(() => {
      const s = EmberlineDebug.app.state;
      s.objects = [];
      s.hostileProjectiles = [];
      s.projectiles = [];
      s.next = Infinity;
      Object.assign(s.player, { x: 82, y: 178, vy: 0, jumps: 0 });
      s.traversals = [{ kind: "pad", x: 85, y: 191, w: 26, h: 5, age: 0 }];
    });
    await page.waitForFunction(() => EmberlineDebug.app.state.traversalEffect?.kind === "pad");
    assert(
      await page.evaluate((before) => EmberlineDebug.app.state.distance >= before + 350, beforePad),
    );
    assert(await page.evaluate(() => EmberlineDebug.app.state.player.vy < 0));
    await page.screenshot({ path: path.join(root, "test-results/expansion-jump-pad.png") });
    await page.waitForFunction(() => EmberlineDebug.app.state.traversalEffect === null);
    await page.click("#controls");
    await page.click("#effects");
    await page.click("#controls-close");
    await page.click("#pause");
    const beforePortal = await page.evaluate(() => EmberlineDebug.app.state.distance);
    await page.evaluate(() => {
      const s = EmberlineDebug.app.state;
      Object.assign(s.player, { x: 82, y: 178, vy: 0, jumps: 0 });
      s.objects = [];
      s.traversals = [{ kind: "portal", x: 85, y: 153, w: 22, h: 43, age: 0 }];
    });
    await page.waitForFunction(() => EmberlineDebug.app.state.traversalEffect?.kind === "portal");
    assert(
      await page.evaluate(
        (before) => EmberlineDebug.app.state.distance >= before + 650,
        beforePortal,
      ),
    );
    assert.equal(await page.evaluate(() => EmberlineDebug.app.coins), balance);
    assert.equal(await page.evaluate(() => EmberlineDebug.app.particles.items.length), 0);
    await page.screenshot({ path: path.join(root, "test-results/expansion-portal.png") });
    await page.reload();
    assert.equal(await page.evaluate(() => EmberlineDebug.app.coins), balance);
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.loadout.weapon), "nova");
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.loadout.character), "specter");
    await page.click("#menu-setup");
    await page.click("#tab-upgrades");
    assert.equal(await page.locator("#upgrade-row-dash .level-meter i").count(), 10);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.evaluate(
        () =>
          document.getElementById("setup-dialog")!.scrollWidth >
          document.getElementById("setup-dialog")!.clientWidth,
      ),
      false,
    );
    await page.screenshot({ path: path.join(root, "test-results/expansion-mobile-upgrades.png") });
    const reduced = await browser.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    reduced.on("pageerror", (error) => errors.push(error.message));
    await reduced.goto(url.href);
    await reduced.click("#start");
    await reduced.evaluate(() => {
      const s = EmberlineDebug.app.state;
      s.next = Infinity;
      s.objects = [];
      s.traversals = [{ kind: "portal", x: 85, y: 153, w: 22, h: 43, age: 0 }];
    });
    await reduced.waitForFunction(
      () => EmberlineDebug.app.state.traversalEffect?.kind === "portal",
    );
    await reduced.screenshot({
      path: path.join(root, "test-results/expansion-reduced-motion.png"),
    });
    assert.deepEqual(errors, []);
    console.log(
      "PASS expansion: new skins/guns purchased, fired and persisted; enemy warnings/shots render; pads and portals skip safely with effects; mobile level-10 UI and reduced motion.",
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
