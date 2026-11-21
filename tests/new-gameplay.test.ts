import type { WorldObject } from "../src/types";
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
const power = (variant: string): WorldObject => ({
  kind: "powerup" as const,
  variant,
  x: 0,
  y: 0,
  w: 12,
  h: 12,
});

test("hearts award no coins and timed pickups take effect instantly and overlap", () => {
  const s = Engine.create(5, undefined, { power: 5 });
  s.mode = "playing";
  s.hits = 2;
  Powerups.collect(s, { kind: "heart", variant: "heart", rarity: "rare", x: 0, y: 0, w: 9, h: 9 });
  assert.equal(s.hits, 0);
  assert.equal(s.embers, 0);
  const titan = power("titan");
  assert(Powerups.collect(s, titan));
  assert(titan.dead);
  assert(!Powerups.collect(s, titan));
  assert(Powerups.collect(s, power("flight")));
  assert.equal(s.activePowerups.titan, 14);
  assert.equal(s.activePowerups.flight, 12 * s.stats.powerDuration);
  s.activePowerups.titan = 0.001;
  Engine.update(s, 0.01);
  assert(!s.activePowerups.titan);
  assert(s.activePowerups.flight);
});

test("blast instantly clears visible enemies and brittle obstacles", () => {
  const s = run();
  s.objects = [
    { kind: "enemy", variant: "drone", x: 200, y: 140, w: 19, h: 12 },
    { kind: "enemy", variant: "drone", x: 600, y: 140, w: 19, h: 12 },
    { kind: "hazard", variant: "pipe", x: 250, y: 170, w: 20, h: 20 },
    { kind: "hazard", variant: "crate", x: 250, y: 170, w: 20, h: 20 },
  ];
  assert(Powerups.collect(s, power("blast")));
  assert(s.objects[0].dead);
  assert(!s.objects[1].dead);
  assert(!s.objects[2].dead);
  assert(s.objects[3].dead);
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
test("co-op snapshots retain instantly activated personal effects", () => {
  const p = Party.profile({});
  const r = Party.create("host", p, 45);
  Party.start(r);
  Powerups.collect(r.members[0].state, power("titan"));
  Powerups.collect(r.members[0].state, power("flight"));
  const copy = Party.decode(Party.encode(r));
  assert.deepEqual(Party.view(copy, "host").activePowerups, { titan: 10, flight: 12 });
});
for (const titanIndex of [0, 1]) {
  test(`shared party shots retain shooter damage with Titan in ${titanIndex === 0 ? "leader" : "follower"}`, () => {
    const p = Party.profile({});
    const r = Party.create("leader", p, 45);
    Party.add(r, "follower", p);
    Party.start(r);
    r.world.next = Infinity;
    r.members[titanIndex].state.activePowerups.titan = 10;
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
  const widths = new Set<number>();
  const shapes = new Set<string>();
  for (let i = 0; i < 100; i++) {
    s.objects = [];
    Generator.spawn(s);
    const platforms = s.objects.filter((o) => o.kind === "platform");
    if (platforms.length) assert(Config.floor - platforms[0].y <= 27);
    for (const platform of platforms) {
      widths.add(platform.w);
      shapes.add(platform.variant);
    }
    for (let j = 1; j < platforms.length; j++) {
      const gap = platforms[j].x - platforms[j - 1].x - platforms[j - 1].w;
      assert(gap >= 25 && gap <= 50);
      assert(Math.abs(platforms[j].y - platforms[j - 1].y) <= 26);
    }
  }
  assert(widths.size >= 8);
  assert.equal(shapes.size, 3);
});

test("hearts are scarce while power-up odds remain unchanged", () => {
  const s = run("scarce-hearts");
  let hearts = 0,
    rareHearts = 0,
    powers = 0;
  for (let i = 0; i < 10000; i++) {
    s.objects = [];
    Generator.spawn(s);
    for (const object of s.objects) {
      if (object.kind === "heart") {
        hearts++;
        if (object.rarity === "rare") rareHearts++;
      } else if (object.kind === "powerup") powers++;
    }
  }
  assert(hearts > 300 && hearts < 700, String(hearts));
  assert(rareHearts > 50 && rareHearts < 150, String(rareHearts));
  assert(powers > 900 && powers < 1500, String(powers));
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
  s.hits = s.health;
  const blast = power("blast");
  assert(!Powerups.collect(s, blast));
  assert(!blast.dead);
  s.hits = 0;
  s.objects = [{ kind: "enemy", variant: "drone", x: 200, y: -30, w: 19, h: 12 }];
  assert(Powerups.collect(s, blast));
  assert(!s.objects[0].dead);
});

test("co-op routes a pickup to one courier even when that courier has another power", () => {
  const p = Party.profile({});
  const r = Party.create("a", p, 11);
  Party.add(r, "b", p);
  Party.start(r);
  r.world.next = Infinity;
  const front = r.members[0].state;
  const back = r.members[1].state;
  front.activePowerups.overclock = 6;
  front.player.x = back.player.x + 2;
  r.world.objects = [
    {
      ...power("flight"),
      x: back.player.x + 8,
      y: back.player.y + 5,
    },
  ];
  Party.update(r, 0.001);
  assert(front.activePowerups.overclock);
  assert.equal(front.activePowerups.flight, 12);
  assert(!back.activePowerups.flight);
  assert.equal(r.world.objects.length, 0);
});

test("shield, magnet, and overclock apply their effects on contact", () => {
  const s = run();
  Powerups.collect(s, power("shield"));
  const obstacle = {
    kind: "hazard" as const,
    variant: "crate",
    x: s.player.x,
    y: 180,
    w: 12,
    h: 14,
  };
  Engine.hit(s, obstacle);
  assert.equal(s.hits, 0);
  Powerups.collect(s, power("magnet"));
  s.objects = [{ kind: "ember", variant: "ground", x: s.player.x + 40, y: 180, w: 5, h: 6 }];
  Engine.update(s, 0.001);
  assert.equal(s.pickups, 1);
  assert(Engine.attack(s));
  const standard = s.attackCooldown;
  s.attackCooldown = 0;
  Powerups.collect(s, power("overclock"));
  assert(Engine.attack(s));
  assert(s.attackCooldown < standard);
});

test("the aerial biome launches safely, spawns waves, and crash-lands into ground play", () => {
  const s = run();
  Object.assign(s, { sector: 2, biomeIndex: 1, time: Config.sectorSeconds * 2 - 0.01 });
  Engine.update(s, 0.02);
  assert.equal(s.ship?.phase, "launch");
  assert.equal(s.objects.length, 0);
  assert(Engine.attack(s));
  assert(s.projectiles[0].damage >= 5);
  for (let i = 0; i < 13; i++) Engine.update(s, 0.1);
  assert.equal(s.ship?.phase, "flight");
  assert.equal(s.objects.length, 0);
  const initialY = s.player.y;
  s.climb = true;
  Engine.update(s, 0.1);
  assert(s.player.y < initialY);
  s.climb = false;
  s.crouching = true;
  Engine.update(s, 0.1);
  assert.equal(s.player.y, initialY);
  for (let i = 0; i < 15; i++) Engine.update(s, 0.1);
  assert(s.objects.some((object) => object.kind === "enemy"));
  s.time = Config.sectorSeconds * 3 - 0.01;
  Engine.update(s, 0.02);
  assert.equal(s.ship?.phase, "crash");
  assert(!Engine.attack(s));
  for (let i = 0; i < 13; i++) Engine.update(s, 0.1);
  assert.equal(s.ship, null);
  assert.equal(s.player.y, Config.floor - Config.playerHeight);
  assert(s.events.some((event) => event.type === "ship-crash"));
});

test("salvaged hulls have distinct rapid, piercing, and spread weapons", () => {
  for (const [id, count, pierce] of [
    ["sparrow", 1, 1],
    ["lancer", 1, 3],
    ["mule", 3, 0],
  ] as const) {
    const state = run();
    state.ship = { id, phase: "flight", age: 0, nextWave: 1.45, wave: 0 };
    assert(Engine.attack(state));
    assert.equal(state.projectiles.length, count);
    assert(state.projectiles.every((bolt) => bolt.pierce === pierce && bolt.damage >= 5));
  }
});

test("co-op couriers steer their own ships through the same flight", () => {
  const profile = Party.profile({});
  const r = Party.create("leader", profile, "flight");
  Party.add(r, "wing", profile);
  Party.start(r);
  Object.assign(r.world, { sector: 2, biomeIndex: 1, time: Config.sectorSeconds * 2 - 0.01 });
  for (let i = 0; i < 14; i++) Party.update(r, 0.1);
  assert.equal(r.world.ship?.phase, "flight");
  assert(Party.action(r, "leader", "climb"));
  assert(Party.action(r, "wing", "crouch"));
  assert(Party.action(r, "wing", "attack"));
  Party.update(r, 0.1);
  const copy = Party.clone(r);
  const leader = Party.view(copy, "leader");
  const wing = Party.view(copy, "wing");
  assert.equal(leader.ship?.id, wing.ship?.id);
  assert(leader.player.y < wing.player.y);
  assert(r.world.projectiles.length > 0);
});
