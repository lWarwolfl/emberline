const { test } = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("../src/engine.js");
const Combat = require("../src/combat.js");
const Config = require("../src/config.js");
const Loadout = require("../src/loadout.js");
const Cloth = require("../src/cloth.js");
const Difficulty = require("../src/difficulty.js");
const Storage = require("../src/storage.js");
const Popups = require("../src/popups.js");
const { run, advance } = require("./helpers.cjs");

function target(variant = "crate", x = 115) {
  return { kind: "hazard", variant, x, y: 182, w: 13, h: 14 };
}

test("dash lunges forward and covers more distance than ordinary running", () => {
  const ordinary = run(5),
    dashed = run(5);
  Engine.dash(dashed);
  advance(ordinary, 0.12);
  advance(dashed, 0.12);
  assert(dashed.distance > ordinary.distance * 1.08);
  assert(dashed.player.x >= Config.playerX + 10);
  advance(dashed, 1.2);
  assert.equal(dashed.player.x, Config.playerX);
});

test("punch breaks a nearby crate once and awards its local score event", () => {
  const state = run();
  state.objects = [target()];
  assert(Engine.attack(state));
  assert(!Engine.attack(state));
  Engine.update(state, 0.05);
  assert.equal(state.objects.length, 0);
  assert(state.score >= 100n);
  const event = state.events.find((event) => event.type === "smash");
  assert.equal(event.points, 100);
  assert.equal(event.label, "BREAK");
});

test("punch cannot reach distant targets or destroy armored hazards", () => {
  for (const object of [
    target("crate", 230),
    target("pipe", 115),
    target("spikes", 115),
    target("reactor", 115),
  ]) {
    const state = run();
    state.objects = [object];
    Engine.attack(state);
    Engine.update(state, 0.02);
    assert.equal(state.objects.length, 1);
    assert(!state.events.some((event) => event.type === "smash"));
  }
});

test("pulse shots travel, collide, and destroy a breakable target", () => {
  const state = run();
  state.loadout.weapon = "pulse";
  state.objects = [target("crate", 220)];
  Engine.attack(state);
  assert.equal(state.projectiles.length, 1);
  Engine.update(state, 0.02);
  assert(state.objects.length > 0);
  advance(state, 0.5);
  assert.equal(state.objects.length, 0);
  assert(state.score >= 100n);
});

test("scatter fires three bolts and projectile lifetime remains bounded", () => {
  const state = run();
  state.loadout.weapon = "scatter";
  Engine.attack(state);
  assert.equal(state.projectiles.length, 3);
  advance(state, 2);
  assert.equal(state.projectiles.length, 0);
});

test("armored obstacles intercept bullets without being destroyed", () => {
  const state = run();
  state.loadout.weapon = "pulse";
  state.objects = [target("pipe", 160), target("crate", 190)];
  Engine.attack(state);
  advance(state, 0.22);
  assert.equal(state.projectiles.length, 0);
  assert.equal(state.objects.length, 2);
});

test("a stacked crate resists two basic hits and breaks on the third", () => {
  const state = run();
  const object = target("stack");
  assert(!Combat.damage(state, object, 1, "shot"));
  assert.equal(object.hp, 1.6);
  assert(!object.dead);
  assert(!Combat.damage(state, object, 1, "shot"));
  assert(Combat.damage(state, object, 1, "shot"));
  assert.equal(state.score, 100n);
  assert(!Combat.damage(state, object, 2, "punch"));
  assert.equal(state.score, 100n);
});

test("coin events contain the actual combo award and difficulty reward", () => {
  const state = run();
  state.objects = [{ kind: "ember", x: 84, y: 181, w: 5, h: 6 }];
  Engine.update(state, 0.001);
  const event = state.events.find((event) => event.type === "pickup");
  assert.equal(event.coins, 2);
  assert.equal(event.points, 55);
  Engine.update(state, 0.001);
  assert.equal(state.events.filter((event) => event.type === "pickup").length, 1);
});

test("cape motion changes shape over time while keeping its shoulder anchored", () => {
  for (const cape of Loadout.capes.filter((item) => item.length)) {
    const first = Cloth.sample(cape, 0),
      second = Cloth.sample(cape, 0.17);
    assert.equal(first[0].x, 0);
    assert.equal(first[0].y, 0);
    assert.equal(second[0].y, 0);
    assert.notDeepEqual(first, second);
    assert.equal(first.length, cape.length);
    assert(first.every((column) => Number.isFinite(column.y) && column.width >= 2));
  }
});

test("difficulty presets affect opening speed, escalation, spacing and integrity", () => {
  const easy = Engine.create(1, { difficulty: "easy" });
  const hard = Engine.create(1, { difficulty: "hard" });
  assert(easy.speed < hard.speed);
  assert(easy.health > hard.health);
  assert(Difficulty.baseSpeed(90, easy.rules) < Difficulty.baseSpeed(90, hard.rules));
  assert(Difficulty.gapSeconds(1, easy.rules) > Difficulty.gapSeconds(1, hard.rules));
  assert(Difficulty.baseSpeed(60) > 98 + 23 * Math.log2(1 + 60 / 18));
});

test("invalid saved equipment and custom difficulty values are sanitized", () => {
  const loadout = Loadout.sanitize({
    character: "bogus",
    weapon: "bad",
    difficulty: "custom",
    custom: { speed: 999, growth: -9, density: "bad", health: 500 },
  });
  assert.equal(loadout.character, "fox");
  assert.equal(loadout.weapon, "punch");
  assert.equal(loadout.custom.speed, 1.4);
  assert.equal(loadout.custom.growth, 0.6);
  assert.equal(loadout.custom.density, 1);
  assert.equal(loadout.custom.health, 5);
});

test("lifetime coins and loadout round trip even past safe integer limits", () => {
  const values = new Map();
  const saves = Storage.create({
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  });
  saves.write("coins", 9007199254740993n);
  saves.write("loadout", JSON.stringify({ character: "hare", weapon: "scatter" }));
  assert.equal(saves.coins(), 9007199254740993n);
  assert.equal(saves.loadout().weapon, "scatter");
  assert.equal(Storage.create(null).coins(), 0n);
  assert.deepEqual(Storage.create(null).loadout(), {});
});

test("action popups preserve award amounts, expire, and have a bounded count", () => {
  const popups = Popups.create();
  popups.add({ x: 90, y: 100, points: 55, coins: 1, label: "COIN" });
  assert.equal(popups.items[0].text, "+55");
  assert.equal(popups.items[0].detail, "+1 COIN");
  for (let i = 0; i < 100; i++) popups.add({ x: i, y: 100, points: 100, label: "BREAK" });
  assert.equal(popups.items.length, 32);
  popups.update(1, 100);
  assert.equal(popups.items.length, 0);
});

test("the camera recenter cannot damage the player with an already cleared obstacle", () => {
  const state = Engine.create(7, { difficulty: "easy" });
  state.mode = "playing";
  state.next = Infinity;
  state.speed = 60;
  state.player.x = 130;
  state.objects = [{ ...target("crate", 115), passed: true }];
  advance(state, 0.3);
  assert.equal(state.hits, 0);
});

test("pulse fire damages an airborne drone which survives one basic hit", () => {
  const state = run();
  state.loadout.weapon = "pulse";
  state.objects = [
    {
      kind: "enemy",
      variant: "drone",
      x: 172,
      y: 145,
      baseY: 145,
      w: 19,
      h: 12,
      age: 0,
      amplitude: 0,
      frequency: 0,
      phase: 0,
    },
  ];
  Engine.attack(state);
  advance(state, 0.75);
  assert.equal(state.objects.length, 1);
  assert.equal(state.hits, 0);
  assert.equal(state.objects[0].hp, 0.2);
});

test("paused menus cannot fire weapons or advance projectiles", () => {
  const state = run();
  state.loadout.weapon = "pulse";
  Engine.attack(state);
  state.mode = "paused";
  const before = structuredClone(state.projectiles);
  assert(!Engine.attack(state));
  Engine.update(state, 0.1);
  assert.deepEqual(state.projectiles, before);
});
