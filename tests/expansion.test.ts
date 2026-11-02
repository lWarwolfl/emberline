import { test } from "node:test";
import assert from "node:assert/strict";
import Content from "../src/content";
import Config from "../src/config";
import Generator from "../src/generator";
import Engine from "../src/engine";
import Combat from "../src/combat";
import EnemyFire from "../src/enemy-fire";
import Upgrades from "../src/upgrades";
import Loadout from "../src/loadout";
import Economy from "../src/economy";
import type { GameState, WorldObject, HostileProjectile } from "../src/types";
import { run, advance } from "./helpers";

function sentry(): WorldObject {
  return {
    kind: "enemy",
    variant: "sentry",
    x: 420,
    y: 177,
    w: 21,
    h: 19,
    baseY: 177,
    amplitude: 0,
    frequency: 0,
    phase: 0,
    age: 0,
    shotCooldown: 0,
  };
}
function bolt(): HostileProjectile {
  return {
    x: 120,
    y: 186,
    previousX: 120,
    previousY: 186,
    vx: -6000,
    vy: 0,
    life: 2,
    damage: 1,
    color: "#ff7b73",
  };
}
function encounter(state: GameState, id: string) {
  state.patternPool = Content.patterns
    .filter((p) => p.unlock <= state.sector)
    .map((p) => p.id)
    .join(",");
  state.patternBag = [id];
  return Generator.spawn(state);
}

test("all thirteen coin trails are deterministic, distinct and within the double-jump band", () => {
  const shapes = new Set<string>();
  assert.equal(Content.coinPatterns.length, 13);
  for (const pattern of Content.coinPatterns) {
    const coins = Generator.coinPath(run(99), pattern, 510, 180);
    assert.deepEqual(coins, Generator.coinPath(run(99), pattern, 510, 180));
    for (const coin of coins) assert(coin.y >= Config.floor - 70 && coin.y <= Config.floor - 10);
    shapes.add(JSON.stringify(coins.map(({ x, y }) => [x, y])));
  }
  assert.equal(shapes.size, 13);
});

test("enemy groups grow to four and later encounters contain more enemies", () => {
  const early = run(123),
    late = run(123);
  late.sector = 12;
  let first = 0,
    later = 0;
  for (let i = 0; i < 500; i++) {
    Generator.spawn(early);
    Generator.spawn(late);
    first += early.objects.filter((o) => o.kind === "enemy").length;
    later += late.objects.filter((o) => o.kind === "enemy").length;
    early.objects = [];
    late.objects = [];
  }
  assert(later > first * 1.5);
  for (const [sector, size] of [
    [5, 2],
    [8, 3],
    [14, 4],
    [100, 4],
  ]) {
    const state = run(1);
    state.sector = sector;
    encounter(state, "squad");
    assert.equal(state.objects.filter((o) => o.kind === "enemy").length, size);
    const enemies = state.objects.filter((o) => o.kind === "enemy");
    for (let i = 1; i < enemies.length; i++) assert(enemies[i].x - enemies[i - 1].x >= 155);
  }
});

test("shooters visibly charge with locked aim before firing, and dead enemies stop firing", () => {
  const state = run(),
    gunner = sentry();
  state.objects = [gunner];
  EnemyFire.update(state, 0.001);
  assert.equal(gunner.charge, Config.enemyFire.warningSeconds);
  assert(state.events.some((event) => event.type === "charge"));
  const aim = gunner.aimY;
  state.player.y -= 50;
  EnemyFire.update(state, 0.6);
  assert.equal(state.hostileProjectiles.length, 0);
  assert.equal(gunner.aimY, aim);
  EnemyFire.update(state, 0.06);
  assert.equal(state.hostileProjectiles.length, 1);
  assert(state.hostileProjectiles[0].vx < 0);
  assert(
    Math.abs(state.hostileProjectiles[0].vy) < 2,
    "Shot keeps the ground-level aim locked during its warning",
  );
  state.hostileProjectiles = [];
  gunner.dead = true;
  for (let i = 0; i < 100; i++) EnemyFire.update(state, 0.1);
  assert.equal(state.hostileProjectiles.length, 0);
});

test("offscreen/nearby shooters do not fire and simultaneous warnings are bounded", () => {
  const state = run();
  state.objects = Array.from({ length: 8 }, (_, i) => ({ ...sentry(), x: 350 + i * 5 }));
  EnemyFire.update(state, 0.001);
  assert.equal(state.objects.filter((o) => (o.charge ?? 0) > 0).length, 2);
  state.objects = [
    { ...sentry(), x: 600 },
    { ...sentry(), x: 120 },
  ];
  state.hostileProjectiles = [];
  for (let i = 0; i < 100; i++) EnemyFire.update(state, 0.1);
  assert.equal(state.hostileProjectiles.length, 0);
});

test("hostile bullets use swept collisions, damage grace and dash deflection", () => {
  const state = run();
  state.hostileProjectiles = [bolt(), bolt()];
  Engine.update(state, 1 / 120);
  assert.equal(state.hits, 1);
  assert.equal(state.hostileProjectiles.length, 0);
  const shielded = run();
  Engine.dash(shielded);
  shielded.hostileProjectiles = [bolt()];
  Engine.update(shielded, 1 / 120);
  assert.equal(shielded.hits, 0);
  assert(shielded.events.some((e) => e.type === "deflect" && e.points === 25));
  assert(shielded.score >= 25n);
  state.mode = "paused";
  state.hostileProjectiles = [bolt()];
  const before = structuredClone(state.hostileProjectiles);
  Engine.update(state, 0.1);
  assert.deepEqual(state.hostileProjectiles, before);
});

test("hostile projectiles expire and cannot grow without bounds", () => {
  const state = run();
  state.objects = Array.from({ length: 30 }, () => sentry());
  for (let i = 0; i < 600; i++) {
    EnemyFire.update(state, 0.1);
    assert(state.hostileProjectiles.length <= Config.enemyFire.maxProjectiles);
  }
  state.objects = [];
  for (let i = 0; i < 50; i++) EnemyFire.update(state, 0.1);
  assert.equal(state.hostileProjectiles.length, 0);
});

test("portals and pads share a seeded 5% encounter chance and both appear", () => {
  const state = run("device-frequency");
  state.sector = 10;
  let portals = 0,
    pads = 0;
  for (let i = 0; i < 20000; i++) {
    Generator.spawn(state);
    for (const device of state.traversals) {
      if (device.kind === "portal") portals++;
      else pads++;
      assert(
        device.x >
          Math.max(...state.objects.filter((o) => o.kind !== "ember").map((o) => o.x + o.w), 0),
      );
    }
    state.objects = [];
    state.traversals = [];
  }
  assert((portals + pads) / 20000 > 0.04 && (portals + pads) / 20000 < 0.06);
  assert(portals > 250 && pads > 250);
});

test("portals skip once, keep the route, open an exit, and never credit skipped coins", () => {
  const state = run();
  state.objects = [{ kind: "ember", variant: "ground", x: 400, y: 181, w: 5, h: 6 }];
  state.hostileProjectiles = [bolt()];
  state.traversals = [{ kind: "portal", x: 84, y: 153, w: 22, h: 43, age: 0 }];
  Engine.update(state, 0.001);
  assert(state.distance >= 650 && state.distance < 651);
  assert(state.distance - state.parallax < 2);
  assert.equal(state.embers, 0);
  assert.equal(state.objects.length, 1);
  assert.equal(state.hostileProjectiles.length, 1);
  assert.equal(state.traversals.filter((device) => device.role === "exit").length, 1);
  assert.equal(state.traversalEffect?.kind, "portal");
  const skipped = state.distance;
  advance(state, 0.2);
  assert(state.distance - skipped < 40);
  assert.equal(state.embers, 0);
  advance(state, 0.7);
  assert.equal(state.traversalEffect, null);
});

test("jump pads launch, skip distance, boost travel, and leave a safe landing", () => {
  const state = run();
  state.objects = [{ kind: "hazard", variant: "crate", x: 450, y: 180, w: 13, h: 14 }];
  state.traversals = [{ kind: "pad", x: 84, y: 191, w: 26, h: 5, age: 0 }];
  Engine.update(state, 0.001);
  assert(state.distance >= 350 && state.distance < 351);
  assert(state.distance - state.parallax < 2);
  assert(state.objects.some((object) => object.variant === "crate"));
  assert(state.player.vy < -250);
  assert.equal(state.player.jumps, 1);
  Engine.update(state, 0.01);
  assert(state.runSpeed > state.speed * 1.7);
  advance(state, 1.6);
  assert.equal(state.traversalEffect, null);
  assert.equal(state.player.y, Config.floor - Config.playerHeight);
  assert.equal(state.hits, 0);
});

test("new weapons have distinct fire rates, spreads and three-target rail penetration", () => {
  for (const [weapon, count, cooldown] of [
    ["repeater", 1, 0.2],
    ["rail", 1, 1.05],
    ["nova", 5, 1.1],
  ] as const) {
    const state = run();
    state.loadout.weapon = weapon;
    assert(Engine.attack(state));
    assert.equal(state.projectiles.length, count);
    assert.equal(state.attackCooldown, cooldown);
    assert(!Engine.attack(state));
  }
  const rail = run();
  rail.loadout.weapon = "rail";
  const targets: WorldObject[] = [120, 140, 160, 180].map((x) => ({
    kind: "hazard",
    variant: "crate",
    x,
    y: 182,
    w: 13,
    h: 14,
  }));
  rail.objects = targets;
  Engine.attack(rail);
  advance(rail, 0.15);
  assert(targets.slice(0, 3).every((o) => o.dead));
  assert(!targets[3].dead);
  const armored = run();
  armored.loadout.weapon = "rail";
  const beetle: WorldObject = {
    kind: "enemy",
    variant: "beetle",
    x: 115,
    y: 180,
    w: 24,
    h: 15,
    baseY: 180,
    amplitude: 0,
    frequency: 0,
    phase: 0,
  };
  armored.objects = [beetle];
  Engine.attack(armored);
  advance(armored, 0.05);
  assert.equal(beetle.hp, 0.8, "A piercing bolt damages a target only once");
  assert.equal(Combat.durability(beetle), 3.2);
});

test("new gear validates and old level-five saves extend to ten without changing old stats", () => {
  for (const character of ["lynx", "moth", "diver", "specter"]) {
    assert.equal(Loadout.sanitize({ character }).character, character);
    assert(Economy.price("character", character)! > 0);
  }
  for (const weapon of ["repeater", "rail", "nova"])
    assert.equal(Loadout.sanitize({ weapon }).weapon, weapon);
  assert.deepEqual(Upgrades.sanitize({ dash: 5, jump: 5, damage: 5, triple: 1 }), {
    dash: 5,
    jump: 5,
    damage: 5,
    triple: 1,
  });
  assert.equal(Upgrades.stats({ damage: 5 }).damageMultiplier, 2);
  const levels = { dash: 10, jump: 10, damage: 10 };
  const stats = Upgrades.stats(levels);
  assert.equal(stats.damageMultiplier, 2.6);
  assert(stats.dashCooldown > 1 && stats.dashWorldMultiplier < 1.8);
  assert.equal(Upgrades.cost("damage", { damage: 5 }), 750);
  assert.equal(Upgrades.cost("damage", levels), null);
  assert.equal(Upgrades.cost("triple", { triple: 1 }), null);
});
