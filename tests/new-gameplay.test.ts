import assert from "node:assert/strict";
import test from "node:test";
import Engine from "../src/engine";
import Combat from "../src/combat";
import { run } from "./helpers";
test("shots require elevation and travel horizontally", () => {
  const s = run();
  s.loadout.weapon = "pulse";
  s.objects.push({ kind: "enemy", variant: "drone", x: 160, y: 130, w: 19, h: 12 });
  Combat.attack(s);
  assert.ok(s.projectiles.length);
  assert.ok(s.projectiles.every((b) => b.vy === 0));
});

import Powerups from "../src/powerups";
import Generator from "../src/generator";
import Party = require("../src/party");
import Config from "../src/config";
test("heart rarity heals without awarding coins; queue is capped and FIFO", () => {
  const s = run();
  s.hits = 2;
  Powerups.collect(s, { kind: "heart", variant: "heart", rarity: "rare", x: 0, y: 0, w: 9, h: 9 });
  assert.equal(s.hits, 0);
  assert.equal(s.embers, 0);
  for (const variant of ["titan", "flight", "blast", "blast"])
    Powerups.collect(s, { kind: "powerup", variant, x: 0, y: 0, w: 12, h: 12 });
  assert.deepEqual(s.powerups, ["titan", "flight", "blast"]);
  assert(Engine.powerup(s));
  assert.equal(s.activePowerup?.id, "titan");
  assert(!Engine.powerup(s));
  s.activePowerup!.remaining = 0.001;
  Engine.update(s, 0.01);
  assert.equal(s.activePowerup, null);
  assert(Engine.powerup(s));
  assert.deepEqual(s.activePowerup, { id: "flight", remaining: 12 });
});
test("blast clears visible enemies but preserves hazards and distant enemies", () => {
  const s = run();
  s.powerups = ["blast"];
  s.objects = [
    { kind: "enemy", variant: "drone", x: 200, y: 140, w: 19, h: 12 },
    { kind: "enemy", variant: "drone", x: 600, y: 140, w: 19, h: 12 },
    { kind: "hazard", variant: "pipe", x: 250, y: 170, w: 20, h: 20 },
  ];
  Engine.powerup(s);
  assert(s.objects[0].dead);
  assert(!s.objects[1].dead);
  assert(!s.objects[2].dead);
});
test("one-way platforms catch descending feet and allow rising through", () => {
  const s = run();
  s.objects = [{ kind: "platform", variant: "ledge", x: 60, y: 160, w: 130, h: 6 }];
  s.player.y = 141;
  s.player.vy = 120;
  Engine.update(s, 0.02);
  assert.equal(s.player.y, 142);
  assert.equal(s.player.jumps, 0);
  s.player.y = 155;
  s.player.vy = -100;
  Engine.update(s, 0.02);
  assert(s.player.y > 142);
  assert(s.player.vy < 0);
  assert.equal(s.hits, 0);
});
test("enemy groups spawn early and evolve in later run time", () => {
  const s = run();
  let grouped = false;
  for (let i = 0; i < 20; i++) {
    s.objects = [];
    Generator.spawn(s);
    if (s.objects.filter((o) => o.kind === "enemy").length >= 2) grouped = true;
  }
  assert(grouped);
  s.time = 160;
  const e = Generator.enemy(s, 500);
  assert.equal(e.evolution, 4);
  assert(e.hp! > Combat.durability(e));
});
test("siegebreaker breaches armored obstacles ordinary bullets cannot break", () => {
  for (const weapon of ["pulse", "siegebreaker"]) {
    const s = run();
    s.loadout.weapon = weapon;
    const o = {
      kind: "hazard" as const,
      variant: "pipe",
      x: 125,
      y: 174,
      w: 22,
      h: 22,
      dead: false,
    };
    s.objects = [o];
    Engine.attack(s);
    for (let i = 0; i < 10; i++) Engine.update(s, 0.01);
    assert.equal(o.dead, weapon === "siegebreaker");
  }
});
test("siegebreaker can pierce two armored obstacles in one shot", () => {
  const s = run();
  s.loadout.weapon = "siegebreaker";
  s.objects = [125, 170, 215].map((x) => ({
    kind: "hazard",
    variant: "pipe",
    x,
    y: 174,
    w: 22,
    h: 22,
  }));
  assert(Engine.attack(s));
  for (let i = 0; i < 15; i++) Engine.update(s, 0.01);
  assert.equal(s.events.filter((event) => event.label === "BREACH").length, 2);
  assert.equal(s.objects.filter((o) => o.kind === "hazard" && !o.dead).length, 1);
});
test("party activates personal powers and preserves queue in snapshots", () => {
  const p = Party.profile({});
  const r = Party.create("host", p, 45);
  Party.start(r);
  r.members[0].state.powerups = ["titan", "flight"];
  assert(Party.action(r, "host", "powerup"));
  const copy = Party.decode(Party.encode(r));
  assert.equal(Party.view(copy, "host").activePowerup?.id, "titan");
  assert.deepEqual(Party.view(copy, "host").powerups, ["flight"]);
  assert.equal(Config.floor, 196);
});
for (const titanIndex of [0, 1]) {
  test(`shared party shots retain shooter damage with Titan in ${titanIndex === 0 ? "leader" : "follower"}`, () => {
    const p = Party.profile({});
    const r = Party.create("leader", p, 45);
    Party.add(r, "follower", p);
    Party.start(r);
    r.world.next = Infinity;
    r.members[titanIndex].state.activePowerup = { id: "titan", remaining: 10 };
    const targets = r.members.map((member, i) => {
      member.state.loadout.weapon = "pulse";
      member.state.player.y = 70 + i * 50;
      return {
        kind: "hazard" as const,
        variant: "crate",
        x: member.state.player.x + 35,
        y: member.state.player.y + 9,
        w: 12,
        h: 12,
        hp: 10,
      };
    });
    r.world.objects = targets;
    for (const member of r.members) assert(Party.action(r, member.id, "attack"));
    assert.equal(r.world.projectiles.length, 2);
    Party.update(r, 0.1);
    for (const [i, target] of targets.entries())
      assert.equal(target.hp, i === titanIndex ? 7.5 : 9);
  });
}
test("generated platform tiers have short traversable gaps and changing heights", () => {
  const s = run(17);
  let found = false;
  for (let i = 0; i < 100; i++) {
    s.objects = [];
    Generator.spawn(s);
    const platforms = s.objects.filter((o) => o.kind === "platform");
    for (let j = 1; j < platforms.length; j++) {
      found = true;
      const gap = platforms[j].x - platforms[j - 1].x - platforms[j - 1].w;
      assert(gap >= 16 && gap <= 32);
      assert(Math.abs(platforms[j].y - platforms[j - 1].y) <= 26);
    }
  }
  assert(found);
});
test("wide platforms remain while still beneath the player", () => {
  const s = run();
  s.objects = [{ kind: "platform", variant: "ledge", x: -42, y: 160, w: 130, h: 6 }];
  s.player.y = 142;
  Engine.update(s, 0.01);
  assert.equal(s.objects.length, 1);
  assert.equal(s.player.y, 142);
});
test("blast refuses downed players and preserves vertically offscreen enemies", () => {
  const s = run();
  s.powerups = ["blast"];
  s.hits = s.health;
  assert(!Engine.powerup(s));
  assert.equal(s.powerups.length, 1);
  s.hits = 0;
  const o = { kind: "enemy" as const, variant: "drone", x: 200, y: -30, w: 19, h: 12 };
  s.objects = [o];
  assert(Engine.powerup(s));
  assert(!s.objects[0].dead);
});
test("full party queue lets a following eligible courier collect a power", () => {
  const p = Party.profile({});
  const r = Party.create("a", p, 11);
  Party.add(r, "b", p);
  Party.start(r);
  r.world.next = Infinity;
  const front = r.members[0].state;
  const back = r.members[1].state;
  front.powerups = ["blast", "blast", "blast"];
  front.player.x = back.player.x + 2;
  r.world.objects = [
    {
      kind: "powerup",
      variant: "flight",
      x: back.player.x + 8,
      y: back.player.y + 5,
      w: 12,
      h: 12,
    },
  ];
  Party.update(r, 0.001);
  assert.deepEqual(front.powerups, ["blast", "blast", "blast"]);
  assert.deepEqual(back.powerups, ["flight"]);
});
