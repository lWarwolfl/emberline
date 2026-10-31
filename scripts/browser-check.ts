import site from "../site.config.json";
/* Optional integration suite. Requires Playwright and an installed Edge/Chrome. */
import { chromium } from "./browser";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function main() {
  const root = path.resolve(__dirname, "..");
  const output = path.join(root, "test-results");
  fs.mkdirSync(output, { recursive: true });
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
      console.error("Browser error:", error.message);
    });
    await page.addInitScript(() => {
      window.audioCount = { tones: 0, noise: 0 };
      const proto = AudioContext.prototype;
      const oscillator = proto.createOscillator;
      const buffer = proto.createBufferSource;
      proto.createOscillator = function (...args) {
        window.audioCount.tones++;
        return oscillator.apply(this, args);
      };
      proto.createBufferSource = function (...args) {
        window.audioCount.noise++;
        return buffer.apply(this, args);
      };
    });
    const url = pathToFileURL(path.join(root, "index.html"));
    url.search = "?seed=browser-check&dev=1";
    await page.goto(url.href);

    assert.equal(await page.title(), site.title);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), site.url);
    const decoded = await page.evaluate(async () => {
      const results = [];
      for (const asset of [
        "assets/favicon.svg",
        "assets/icon-32.png",
        "assets/icon-180.png",
        "assets/icon-maskable-512.png",
        "assets/og-image.png",
        "assets/preview-square.png",
      ]) {
        const image = new Image();
        image.src = asset;
        await image.decode();
        results.push([asset, image.naturalWidth, image.naturalHeight] as const);
      }
      return results;
    });
    assert(decoded.every(([, width, height]) => width > 0 && height > 0));
    await page.screenshot({ path: path.join(output, "menu.png") });
    await page.click("#start");
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.mode), "playing");
    await page.keyboard.press("Space");
    await page.waitForTimeout(80);
    await page.keyboard.press("Space");
    await page.keyboard.press("Shift");
    await page.waitForTimeout(80);
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.player.jumps), 2);
    assert(await page.evaluate(() => EmberlineDebug.app.state.cooldown > 0));
    const audio = await page.evaluate(() => audioCount);
    assert(
      audio.tones >= 7 && audio.noise >= 1,
      "Jump/dash audio nodes must be generated: " + JSON.stringify(audio),
    );
    await page.screenshot({ path: path.join(output, "playing.png") });

    await page.keyboard.press("p");
    const pausedTime = await page.evaluate(() => EmberlineDebug.app.state.time);
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.time), pausedTime);
    assert.equal(await page.locator("#overlay").isVisible(), true);
    await page.keyboard.press("p");
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.mode), "playing");

    await page.click("#fullscreen");
    await page.waitForFunction(() => Boolean(document.fullscreenElement));
    assert(await page.evaluate(() => Boolean(document.fullscreenElement)));
    await page.screenshot({ path: path.join(output, "fullscreen.png") });
    await page.click("#fullscreen");
    await page.waitForFunction(() => !document.fullscreenElement);
    assert.equal(await page.evaluate(() => Boolean(document.fullscreenElement)), false);

    await page.click("#sound");
    assert.equal(await page.locator("#sound").innerText(), "SOUND OFF");
    await page.waitForTimeout(40);
    const mutedCount = await page.evaluate(() => audioCount.tones);
    await page.keyboard.press("Space");
    await page.waitForTimeout(80);
    assert.equal(await page.evaluate(() => audioCount.tones), mutedCount);
    await page.click("#effects");
    assert.equal(await page.evaluate(() => EmberlineDebug.app.particles.enabled), false);
    assert.equal(await page.evaluate(() => EmberlineDebug.app.particles.items.length), 0);

    // Advance the actual simulation to verify sector/pace HUD integration.
    await page.evaluate(() => {
      const { app, engine } = EmberlineDebug;
      app.state.invincible = 1000;
      for (let i = 0; i < 120 * 40; i++) engine.update(app.state, 1 / 120);
    });
    await page.waitForTimeout(100);
    assert.equal(await page.locator("#sector").innerText(), "SECTOR 03");
    assert.notEqual(await page.locator("#velocity").innerText(), "98 PX/S");

    // Deliberately place the last hit to test the death/retry/persistence flow.
    await page.evaluate(() => {
      const state = EmberlineDebug.app.state;
      Object.assign(state, { hits: 2, invincible: 0, dash: 0 });
      Object.assign(state.player, { y: 178, vy: 0, jumps: 0 });
      state.objects = [{ kind: "hazard", variant: "crate", x: 83, y: 182, w: 13, h: 14 }];
    });
    await page.waitForTimeout(80);
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.mode), "dead");
    assert.equal(await page.locator("#start").isVisible(), true);
    const best = await page.locator("#best").innerText();
    assert(BigInt(best) > 0n);
    await page.click("#start");
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.mode), "playing");
    await page.reload();
    assert.equal(await page.locator("#best").innerText(), best);
    assert.equal(await page.locator("#sound").innerText(), "SOUND OFF");
    assert.equal(await page.locator("#effects").isChecked(), false);

    // Render every actual hazard/enemy sprite in every scene, without a mock UI.
    await page.click("#start");
    for (const biome of ["city", "foundry", "forest", "frost", "dunes"]) {
      await page.evaluate((biomeId) => {
        const { app } = EmberlineDebug;
        const { Config, Content } = Emberline;
        const state = app.state;
        Object.assign(state, {
          mode: "paused",
          biome: biomeId,
          previousBiome: biomeId,
          biomeBlend: 1,
        });
        state.objects = Content.obstacles.map((definition, index) => ({
          ...definition,
          kind: "hazard",
          variant: definition.id,
          x: 140 + index * 52,
          y: Config.floor - definition.h,
        }));
        state.objects.push(
          ...Content.enemies.map((definition, index) => ({
            ...definition,
            kind: "enemy" as const,
            variant: definition.id,
            x: 160 + index * 70,
            y: 115,
          })),
        );
        state.objects.push(...Emberline.Generator.coinPath(state, "wave", 130, 290));
        app.draw();
      }, biome);
      await page.waitForTimeout(40);
      await page.screenshot({ path: path.join(output, `biome-${biome}.png`) });
    }

    // Crossfade composition and palette must also render without exceptions.
    await page.evaluate(() => {
      const state = EmberlineDebug.app.state;
      Object.assign(state, { biome: "forest", previousBiome: "foundry", biomeBlend: 0.5 });
      EmberlineDebug.app.draw();
    });
    await page.screenshot({ path: path.join(output, "transition.png") });

    await page.reload();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(output, "mobile.png") });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await page.click("#start");
    await page.locator("#touch-jump").dispatchEvent("pointerdown");
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.player.jumps), 1);
    await page.locator("#touch-dash").dispatchEvent("pointerdown");
    assert(await page.evaluate(() => EmberlineDebug.app.state.cooldown > 0));
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.mode), "paused");
    assert.deepEqual(errors, [], "Browser console must have no JavaScript exceptions");
    console.log(
      "PASS browser: controls, pause, fullscreen/windowed, audio, particles, speed/sector HUD, death/retry, saves, all scene/sprite variants, crossfade, touch and mobile layout.",
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
