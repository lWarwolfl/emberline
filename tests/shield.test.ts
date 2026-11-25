import test from "node:test";
import assert from "node:assert/strict";
import Engine from "../src/engine";
import Shield from "../src/shield";
import Upgrades from "../src/upgrades";
import Economy from "../src/economy";
import Storage from "../src/storage";
import * as Party from "../src/party";
import { run } from "./helpers";

test("held shield blocks contact, drains without rewards, breaks and requires release to recharge", () => {
  const s = run();
  s.shield.held = true;
  const hazard = { kind: "hazard" as const, variant: "spikes", x: 82, y: 185, w: 23, h: 11 };
  Engine.hit(s, hazard);
  assert.equal(s.hits, 0);
  assert.equal(s.shield.charge, 75);
  assert.equal(s.score, 0n);
  assert.equal(s.embers, 0);
  for (let i = 0; i < 60; i++) Engine.update(s, 0.1);
  assert(s.shield.broken);
  assert.equal(s.shield.charge, 0);
  assert(!Shield.active(s));
  Engine.hit(s, hazard);
  assert.equal(s.hits, 1);
  s.shield.held = false;
  for (let i = 0; i < 30; i++) Engine.update(s, 0.1);
  assert(s.shield.charge > 20);
  assert(!s.shield.broken);
  s.shield.held = true;
  assert(Shield.active(s));
});
test("paused shield charge freezes and temporary pickup never consumes rechargeable energy", () => {
  const s = run();
  s.shield.held = true;
  s.activePowerups.shield = 4;
  Engine.hit(s, { kind: "hazard", variant: "spikes", x: 82, y: 185, w: 23, h: 11 });
  assert.equal(s.shield.charge, 100);
  s.mode = "paused";
  const prior = structuredClone(s.shield);
  Engine.update(s, 0.1);
  assert.deepEqual(s.shield, prior);
});
test("shield upgrades and cosmetic styles preserve old-save defaults and ownership", () => {
  const shop = Economy.create(Storage.create(null));
  assert.equal(shop.levels.shield, 0);
  assert(shop.owns("shield", "aegis"));
  assert.equal(shop.enforce({}).shield, "aegis");
  assert(!shop.owns("shield", "prism"));
  shop.credit(10000);
  assert(shop.buy("shield", "prism").ok);
  assert(shop.upgrade("shield", 0).ok);
  assert.equal(shop.enforce({ shield: "prism" }).shield, "prism");
  assert(Upgrades.stats({ shield: 10 }).shieldCapacity > Upgrades.stats({}).shieldCapacity);
});
test("co-op keeps shield charge personal and serializes held input", () => {
  const p = Party.profile({}),
    r = Party.create("a", p, 42);
  Party.add(r, "b", p);
  Party.start(r);
  assert(Party.action(r, "a", "shield-on"));
  Party.update(r, 0.1);
  const a = r.members[0].state,
    b = r.members[1].state;
  assert(a.shield.charge < b.shield.charge);
  assert(a.shield.held);
  assert(!b.shield.held);
  const copy = Party.clone(r);
  assert.deepEqual(copy.members[0].state.shield, a.shield);
  assert(Party.action(r, "a", "shield-off"));
  assert(!a.shield.held);
});
