import assert from "node:assert/strict";
import { once } from "node:events";
import path from "node:path";
import { chromium } from "./browser";
import { createLanServer } from "./lan-server";

async function main() {
  const app = createLanServer();
  app.server.listen(0, "127.0.0.1");
  await once(app.server, "listening");
  const address = app.server.address();
  assert(address && typeof address !== "string");
  const browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || "chromium",
    headless: true,
  });
  const errors: string[] = [];
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    const url = `http://127.0.0.1:${address.port}/?dev=1`;
    await page.goto(url);
    await page.click("#party");
    await page.focus("#party-room");
    const spacing = await page.evaluate(() => {
      const input = document.getElementById("party-room")!;
      const button = document.getElementById("party-lan-join")!;
      return {
        gap: button.getBoundingClientRect().top - input.getBoundingClientRect().bottom,
        outline: parseFloat(getComputedStyle(input).outlineWidth),
        offset: parseFloat(getComputedStyle(input).outlineOffset),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    assert(spacing.gap >= 12, `Join input/button gap: ${spacing.gap}`);
    assert(spacing.outline >= 2 && spacing.offset >= 2);
    assert.equal(spacing.overflow, false);
    await page.screenshot({ path: path.resolve("test-results/party-input-mobile.png") });
    let releaseInfo!: () => void;
    const infoGate = new Promise<void>((resolve) => {
      releaseInfo = resolve;
    });
    await page.route("**/host-info", async (route) => {
      await infoGate;
      await route.fulfill({ json: { hosting: true, addresses: [] } });
    });
    await page.click("#party-lan-host");
    assert.equal(await page.locator("#party-lan-host").getAttribute("aria-busy"), "true");
    assert.equal(await page.locator("#party-lan-host").isDisabled(), true);
    assert.match(await page.locator("#party-lan-host").innerText(), /OPENING/);
    assert.equal(await page.locator("#party-lan-join").isDisabled(), true);
    await page.screenshot({ path: path.resolve("test-results/party-loading-mobile.png") });
    await page.click("#party-leave");
    releaseInfo();
    const idle = () =>
      page.waitForFunction(
        () =>
          document.getElementById("party-lan-host")!.getAttribute("aria-busy") === "false" &&
          document.getElementById("party-lan-join")!.getAttribute("aria-busy") === "false",
      );
    await idle();
    assert.equal(await page.evaluate(() => EmberlineDebug.app.session.active), false);
    assert.equal(await page.locator("#party-room").isEnabled(), true);
    await page.fill("#party-room", "not-a-room");
    await page.click("#party-lan-join");
    await idle();
    assert.match(await page.locator("#party-message").innerText(), /six-character/);
    assert.equal(await page.locator("#party-lan-join").isEnabled(), true);
    await page.unroute("**/host-info");
    await page.route("**/host-info", (route) => route.fulfill({ status: 404 }));
    await page.route("**/api/party/ice", (route) => route.fulfill({ status: 503 }));
    await page.fill("#party-room", "ABC123");
    await page.click("#party-lan-join");
    await idle();
    assert.match(await page.locator("#party-message").innerText(), /relay is unavailable/);
    assert.equal(await page.locator("#party-lan-join").isEnabled(), true);
    await page.unroute("**/host-info");
    await page.unroute("**/api/party/ice");
    await page.click("#party-lan-host");
    await page.waitForFunction(() => EmberlineDebug.app.session.active);
    await idle();
    const room = await page.inputValue("#party-room");
    const guestContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const guest = await guestContext.newPage();
    guest.on("pageerror", (error) => errors.push(error.message));
    await guest.goto(url);
    await guest.click("#party");
    await guest.fill("#party-room", room);
    await guest.click("#party-lan-join");
    await guest.waitForFunction(() => EmberlineDebug.app.session.run?.members.length === 2);
    assert.equal(await guest.locator("#party-lan-join").getAttribute("aria-busy"), "false");
    assert.equal(await guest.locator("#party-lan-join").innerText(), "JOIN");
    await guest.click("#party-leave");
    assert.equal(await guest.locator("#party-lan-join").isEnabled(), true);
    assert.deepEqual(errors, []);
    console.log(
      "PASS party connection UI: loading, duplicate prevention, cancellation, validation/relay errors, retry, two real LAN clients, mobile spacing and visible focus outline.",
    );
  } finally {
    await browser.close();
    app.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
