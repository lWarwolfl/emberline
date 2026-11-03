import assert from "node:assert/strict";
import { once } from "node:events";
import path from "node:path";
import { chromium } from "./browser";
import { createLanServer } from "./lan-server";
import type { Page } from "playwright";

async function main() {
  const server = createLanServer();
  server.server.listen(0, "127.0.0.1");
  await once(server.server, "listening");
  const address = server.server.address();
  assert(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/?dev=1`;
  const browser = await chromium.launch({
    executablePath: process.env.BROWSER_EXECUTABLE_PATH,
    channel: process.env.BROWSER_EXECUTABLE_PATH
      ? undefined
      : process.env.BROWSER_CHANNEL || "chromium",
    headless: true,
    args: [
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
    ],
  });
  const errors: string[] = [];
  async function courier(name: string, mobile = false) {
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
      reducedMotion: mobile ? "reduce" : "no-preference",
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(url);
    await page.click("#party");
    await page.fill("#party-name", name);
    return page;
  }
  async function waitCount(pages: Page[], count: number) {
    await Promise.all(
      pages.map((p) =>
        p.waitForFunction((n) => EmberlineDebug.app.session.run?.members.length === n, count),
      ),
    );
  }
  try {
    const host = await courier("Host");
    await host.click("#party-lan-host");
    await host.waitForFunction(() => EmberlineDebug.app.session.active);
    const room = await host.inputValue("#party-room");
    assert.match(room, /^[A-F0-9]{6}$/);
    await host.waitForSelector("#party-lan-share:not([hidden])");
    const joinLink = (await host.locator("#party-lan-link").textContent()) ?? "";
    assert.match(joinLink, new RegExp(`[?&]room=${room}(?:&|$)`));
    assert.ok(
      (await host.evaluate(
        () => (document.getElementById("party-lan-qr") as HTMLCanvasElement).width,
      )) > 20,
    );
    const linked = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const joiner = await linked.newPage();
    joiner.on("pageerror", (error) => errors.push(error.message));
    const deepLink = new URL(url);
    deepLink.searchParams.set("room", room);
    await joiner.goto(deepLink.toString());
    await joiner.waitForSelector("#party-dialog[open]");
    assert.equal(await joiner.inputValue("#party-room"), room);
    assert.match((await joiner.locator("#party-message").textContent()) ?? "", new RegExp(room));
    await linked.close();
    const pages = [host];
    for (let i = 1; i <= 3; i++) {
      const page = await courier(`Player ${i}`, i === 3);
      await page.fill("#party-room", room);
      await page.click("#party-lan-join");
      pages.push(page);
    }
    await waitCount(pages, 4);
    const extra = await courier("Fifth");
    await extra.fill("#party-room", room);
    await extra.click("#party-lan-join");
    await extra.waitForFunction(() =>
      document.getElementById("party-message")!.textContent!.includes("full"),
    );
    await extra.context().close();
    await host.click("#party-start");
    await Promise.all(pages.slice(1).map((p) => p.click("#party-close")));
    await Promise.all(
      pages.map((p) => p.waitForFunction(() => EmberlineDebug.app.state.mode === "playing")),
    );
    await host.evaluate(() => {
      const r = EmberlineDebug.app.session.run!;
      r.world.next = Infinity;
      r.world.objects = [];
      r.world.traversals = [];
      r.checkpoint = null;
    });
    const ids = await host.evaluate(() => EmberlineDebug.app.session.run!.order);
    assert.equal(new Set(ids).size, 4);
    for (const p of pages)
      assert.deepEqual(await p.evaluate(() => EmberlineDebug.app.session.run!.order), ids);
    await pages[3].click("#touch-front");
    const protector = await pages[3].evaluate(() => EmberlineDebug.app.session.localId);
    await Promise.all(
      pages.map((p) =>
        p.waitForFunction((id) => EmberlineDebug.app.session.run!.order[0] === id, protector),
      ),
    );
    await host.evaluate(() => {
      const r = EmberlineDebug.app.session.run!;
      for (const m of r.members) Object.assign(m.state.player, { y: 178, vy: 0, jumps: 0 });
      const first = Emberline.Party.sorted(r).find(Emberline.Party.alive)!.state;
      r.world.hostileProjectiles.push({
        x: first.player.x + 16,
        y: 186,
        previousX: first.player.x + 16,
        previousY: 186,
        vx: -600,
        vy: 0,
        life: 1,
        damage: 1,
        color: "#ff8e88",
      });
    });
    await Promise.all(
      pages.map((p) =>
        p.waitForFunction(
          (id) =>
            EmberlineDebug.app.session.run!.members.find((m) => m.id === id)!.state.hits === 1,
          protector,
        ),
      ),
    );
    const hits = await host.evaluate(() =>
      EmberlineDebug.app.session.run!.members.map((m) => m.state.hits),
    );
    assert.equal(
      hits.reduce((a, b) => a + b, 0),
      1,
    );
    await host.evaluate(() => {
      const r = EmberlineDebug.app.session.run!;
      r.members[1].state.hits = r.members[1].state.health;
    });
    await pages[1].waitForFunction(() =>
      document.getElementById("party-hud")!.textContent!.includes("DOWN"),
    );
    const beforeJump = await host.evaluate(
      () => EmberlineDebug.app.session.run!.members[1].state.player.jumps,
    );
    await pages[1].keyboard.press("Space");
    assert.equal(
      await host.evaluate(() => EmberlineDebug.app.session.run!.members[1].state.player.jumps),
      beforeJump,
    );
    // A regular touch does not revive; the protector must dash into the beacon.
    await host.evaluate(() => {
      const r = EmberlineDebug.app.session.run!;
      const m = r.members.find((m) => m.id === r.order[0])!;
      r.checkpoint = { x: m.state.player.x + 8, age: 0, used: false, flash: 0 };
    });
    await pages[3].keyboard.press("Shift");
    await Promise.all(
      pages.map((p) =>
        p.waitForFunction(() => EmberlineDebug.app.session.run!.members[1].state.hits === 0),
      ),
    );
    await host.evaluate(() => {
      const r = EmberlineDebug.app.session.run!;
      const m = Emberline.Party.sorted(r).find(Emberline.Party.alive)!;
      r.world.objects = [
        {
          kind: "ember",
          variant: "ground",
          x: m.state.player.x + 4,
          y: m.state.player.y + 8,
          w: 5,
          h: 6,
        },
      ];
    });
    await Promise.all(pages.map((p) => p.waitForFunction(() => EmberlineDebug.app.coins === 2n)));
    await pages[3].screenshot({ path: path.resolve("test-results/party-mobile-running.png") });
    await host.click("#pause");
    await Promise.all(
      pages.map((p) => p.waitForFunction(() => EmberlineDebug.app.state.mode === "paused")),
    );
    for (const p of pages) assert.equal(await p.locator("#party-hud .party-member").count(), 4);
    await pages[3].screenshot({ path: path.resolve("test-results/party-mobile.png") });
    assert.equal(
      await pages[3].evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await host.screenshot({ path: path.resolve("test-results/party-four-players.png") });
    await host.click("#pause");
    await pages[2].context().close();
    await host.waitForFunction(
      () => EmberlineDebug.app.session.run!.members.filter((m) => m.connected).length === 3,
    );
    await host.evaluate(() => {
      const r = EmberlineDebug.app.session.run!;
      r.checkpoint = null;
      r.world.distance = r.beaconDistance - 280;
    });
    await host.waitForFunction(() => !!EmberlineDebug.app.session.run!.checkpoint);
    await host.waitForFunction(
      () =>
        !!EmberlineDebug.app.session.run!.checkpoint &&
        EmberlineDebug.app.session.run!.checkpoint!.x < 390,
    );
    await host.screenshot({ path: path.resolve("test-results/party-biome-beacon.png") });
    await host.context().close();
    await pages[1].waitForFunction(() => !EmberlineDebug.app.session.active);
    assert.equal(await pages[1].evaluate(() => EmberlineDebug.app.coins), 2n);
    await pages[1].context().close();
    await pages[3].context().close();

    if (process.env.EMBERLINE_SKIP_DIRECT) {
      console.log(
        "SKIP direct WebRTC: this environment cannot enumerate network interfaces. CI runs the real data-channel checks.",
      );
    } else {
      // Real WebRTC data channels on the deployed-style static frontend, no LAN relay.
      const directHost = await courier("Direct host");
      await directHost
        .locator(".party-path > summary")
        .filter({ hasText: "DIRECT INVITES" })
        .click();
      await directHost.click("#party-host");
      const direct = [directHost];
      for (let i = 1; i <= 3; i++) {
        await directHost.click("#party-invite");
        await directHost.waitForFunction(() =>
          (document.getElementById("party-output") as HTMLTextAreaElement).value.startsWith(
            "EMBER7.",
          ),
        );
        if (direct.length === 1) {
          assert.equal(await directHost.locator("#party-code-note").isVisible(), true);
        }
        const invite = await directHost.inputValue("#party-output");
        const guest = await courier(`Direct ${i}`);
        await guest.locator(".party-path > summary").filter({ hasText: "DIRECT INVITES" }).click();
        await guest.click("#party-role-join");
        await guest.fill("#party-input", invite);
        await guest.click("#party-answer");
        await guest.waitForFunction(() =>
          (document.getElementById("party-output") as HTMLTextAreaElement).value.startsWith(
            "EMBER7.",
          ),
        );
        const answer = await guest.inputValue("#party-output");
        await directHost.fill("#party-input", answer);
        await directHost.click("#party-accept");
        direct.push(guest);
        await waitCount(direct, i + 1);
        // Clear the last code so the next invite cannot accidentally read stale output.
        await directHost.evaluate(() => {
          (document.getElementById("party-output") as HTMLTextAreaElement).value = "";
        });
      }
      await directHost.click("#party-start");
      await Promise.all(direct.slice(1).map((p) => p.click("#party-close")));
      await Promise.all(
        direct.map((p) => p.waitForFunction(() => EmberlineDebug.app.state.mode === "playing")),
      );
      await direct[2].keyboard.press("KeyT");
      const newFront = await direct[2].evaluate(() => EmberlineDebug.app.session.localId);
      await Promise.all(
        direct.map((p) =>
          p.waitForFunction((id) => EmberlineDebug.app.session.run!.order[0] === id, newFront),
        ),
      );
      await directHost.screenshot({ path: path.resolve("test-results/party-direct-invites.png") });
      await directHost.context().close();
      await direct[1].waitForFunction(() => !EmberlineDebug.app.session.active);
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS party: four real LAN clients (plus direct WebRTC unless explicitly skipped); limits, shared formation/take-point, damage interception, down/spectate, dash revival, coins once, biome beacon, pause, disconnect, mobile HUD and reduced motion.",
    );
  } catch (error) {
    for (const context of browser.contexts())
      for (const page of context.pages()) {
        console.error(
          await page
            .evaluate(() => ({
              status: document.getElementById("party-message")?.textContent,
              run: EmberlineDebug.app.session.run && {
                mode: EmberlineDebug.app.session.run.world.mode,
                checkpoint: EmberlineDebug.app.session.run.checkpoint,
                order: EmberlineDebug.app.session.run.order,
                members: EmberlineDebug.app.session.run.members.map((m) => ({
                  name: m.name,
                  hits: m.state.hits,
                  x: m.state.player.x,
                  y: m.state.player.y,
                  dash: m.state.dash,
                  cooldown: m.state.cooldown,
                })),
              },
            }))
            .catch(() => "Page closed"),
        );
      }
    throw error;
  } finally {
    await browser.close();
    server.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
