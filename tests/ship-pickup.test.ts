import test from "node:test";
import assert from "node:assert/strict";
import Ships from "../src/ships";
import Engine from "../src/engine";
import Config from "../src/config";
import * as Party from "../src/party";
import { run } from "./helpers";

test("ship offers vary by seed and sector, repeat deterministically, and preserve encounter RNG", () => {
  const offers = new Set<string>();
  for (let seed = 1; seed <= 30; seed++) {
    const s = run(seed);
    const offer = Ships.opportunity(seed, 2);
    offers.add(JSON.stringify(offer));
    assert.deepEqual(offer, Ships.opportunity(seed, 2));
    s.sector = 2;
    s.time = Config.sectorSeconds + offer.delay;
    const rng = s.rng.seed;
    Ships.update(s, 2, 0.01);
    assert.equal(s.rng.seed, rng);
    assert.equal(Boolean(s.ship), false);
    assert.equal(s.objects.filter((o) => o.kind === "ship").length, offer.available ? 1 : 0);
    Ships.update(s, 2, 0);
    assert(s.objects.filter((o) => o.kind === "ship").length <= 1);
  }
  assert(offers.size > 25);
});

test("a ship can be missed without damage, then a later ship can be boarded once", () => {
  const s = run();
  s.next = Infinity;
  s.objects = [{ kind: "ship", variant: "lancer", x: s.player.x + 12, y: 90, w: 36, h: 18 }];
  for (let i = 0; i < 10; i++) Engine.update(s, 0.1);
  assert.equal(Boolean(s.ship), false);
  assert.equal(s.hits, 0);
  s.objects = [
    { kind: "ship", variant: "mule", x: s.player.x + 2, y: s.player.y, w: 36, h: 18 },
    { kind: "hazard", variant: "crate", x: s.player.x + 3, y: s.player.y, w: 20, h: 18 },
  ];
  Engine.update(s, 0.01);
  assert.equal(s.ship?.id, "mule");
  assert.equal(s.hits, 0, "boarding clears hazards before remaining collisions");
  assert.equal(s.events.filter((e) => e.type === "ship-launch").length, 1);
});

test("a following co-op courier can board and the shared hull survives snapshots", () => {
  const p = Party.profile({});
  const r = Party.create("a", p, "pickup");
  Party.add(r, "b", p);
  Party.start(r);
  const follower = r.members[1].state;
  r.world.objects = [
    { kind: "ship", variant: "lancer", x: follower.player.x, y: follower.player.y, w: 16, h: 18 },
  ];
  Party.update(r, 0.01);
  assert.equal(r.world.ship?.id, "lancer");
  assert(r.members.every((m) => m.state.ship?.id === "lancer"));
  assert.equal(Party.clone(r).world.ship?.id, "lancer");
});
