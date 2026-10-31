import type { AddressInfo } from "node:net";
/* Verify the compiled bundle and worker together, including a real offline reload. */
import { chromium } from "./browser";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

async function main() {
  const root = path.resolve(__dirname, "../public");
  const types: Record<string, string> = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".webmanifest": "application/manifest+json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
  };
  const server = http.createServer(async (request, response) => {
    const relative = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    const filename = path.resolve(root, "." + (relative === "/" ? "/index.html" : relative));
    if (!filename.startsWith(root + path.sep)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const content = await fs.readFile(filename);
      response.writeHead(200, {
        "content-type": types[path.extname(filename)] || "application/octet-stream",
        "cache-control": "no-store",
      });
      response.end(content);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({
      channel: process.env.BROWSER_EXECUTABLE_PATH
        ? undefined
        : process.env.BROWSER_CHANNEL || "chromium",
      executablePath: process.env.BROWSER_EXECUTABLE_PATH,
      headless: true,
    });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(
      `http://127.0.0.1:${(server.address() as AddressInfo).port}/?seed=pwa-check&dev=1`,
    );
    await page.waitForFunction(async () =>
      Boolean((await navigator.serviceWorker.getRegistration())?.active),
    );
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    const cacheFiles = await page.evaluate(async () => {
      const names = await caches.keys();
      const cache = await caches.open(names.find((name) => name.startsWith("emberline-"))!);
      return (await cache.keys()).map((request) => new URL(request.url).pathname);
    });
    assert(cacheFiles.includes("/dist/game.js"), "Compiled game must be precached");
    assert(!cacheFiles.some((file) => file.startsWith("/src/")), "PWA must use compiled output");
    await context.setOffline(true);
    await page.reload();
    await page.waitForFunction(() => window.EmberlineDebug?.app.state.mode === "menu");
    await page.click("#start");
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.mode), "playing");
    await page.locator("#touch-jump").dispatchEvent("pointerdown");
    assert.equal(await page.evaluate(() => EmberlineDebug.app.state.player.jumps), 1);
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS PWA: compiled assets cached, service-worker control, offline reload, touch input and mobile layouts.",
    );
  } finally {
    if (browser) await browser.close();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
