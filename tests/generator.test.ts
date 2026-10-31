import type { Seed, WorldObject } from "../src/types";
import { test } from "node:test";
import assert from "node:assert/strict";
import Content from "../src/content";
import Config from "../src/config";
import Generator from "../src/generator";
import Engine from "../src/engine";
import Random from "../src/random";
import { run } from "./helpers";

test("same seed reproduces the route; different seeds produce different routes", () => {
  function route(seed: Seed) {
    const state = run(seed);
    state.sector = 10;
    return Array.from({ length: 30 }, () => {
      Generator.spawn(state);
      const result = JSON.stringify(state.objects);
      state.objects = [];
      return result;
    });
  }
  assert.deepEqual(route("test-route"), route("test-route"));
  assert.notDeepEqual(route("test-route"), route("other-route"));
});

test("shuffle bag covers all items and avoids immediate repeats across refills", () => {
  const rng = Random.create(8),
    bag: string[] = [],
    items = ["a", "b", "c", "d"];
  let previous: string | undefined;
  for (let cycle = 0; cycle < 30; cycle++) {
    const seen = new Set();
    for (let i = 0; i < items.length; i++) {
      const current = Random.drawBag(rng, bag, items, previous);
      assert.notEqual(current, previous);
      seen.add(current);
      previous = current;
    }
    assert.equal(seen.size, items.length);
  }
});

test("all obstacle, enemy, encounter and coin variants occur", () => {
  const state = run(948);
  state.sector = 10;
  const variants = new Set(),
    patterns = new Set(),
    coins = new Set();
  let previousPattern, previousCoins;
  for (let i = 0; i < 350; i++) {
    const encounter = Generator.spawn(state);
    assert.notEqual(encounter.pattern, previousPattern);
    assert.notEqual(encounter.coinPattern, previousCoins);
    previousPattern = encounter.pattern;
    previousCoins = encounter.coinPattern;
    patterns.add(encounter.pattern);
    coins.add(encounter.coinPattern);
    for (const object of state.objects) if (object.kind !== "ember") variants.add(object.variant);
    state.objects = [];
  }
  for (const item of [...Content.obstacles, ...Content.enemies])
    assert(variants.has(item.id), item.id);
  assert.equal(patterns.size, Content.patterns.length);
  assert.equal(coins.size, Content.coinPatterns.length);
});

test("10,000 generated chunks respect bounds, rewards, clearance and spacing", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const state = run(seed);
    for (let i = 0; i < 100; i++) {
      state.sector = 1 + i;
      state.time = i * Config.sectorSeconds;
      state.speed = 98 + i * 3;
      const encounter = Generator.spawn(state);
      const dangers = state.objects.filter((object) => object.kind !== "ember");
      const coins = state.objects.filter((object) => object.kind === "ember");
      assert(coins.length >= 2);
      for (const coin of coins) {
        assert(Number.isFinite(coin.x) && Number.isFinite(coin.y));
        assert(coin.y >= Config.floor - 76 && coin.y + coin.h <= Config.floor);
        assert(!dangers.some((danger) => Generator.overlapsDanger(coin, danger)));
      }
      assert(encounter.gap >= Config.generation.minimumGapSeconds);
      assert(state.next > state.distance + encounter.width + state.speed * encounter.gap);
      for (let j = 1; j < dangers.length; j++) assert(dangers[j].x - dangers[j - 1].x >= 155);
      state.objects = [];
    }
  }
});

test("early runs do not spawn locked content", () => {
  const state = run();
  for (let i = 0; i < 100; i++) {
    Generator.spawn(state);
    for (const object of state.objects.filter((item) => item.kind !== "ember")) {
      const definition = [...Content.obstacles, ...Content.enemies].find(
        (item) => item.id === object.variant,
      );
      assert(definition);
      assert(definition.unlock <= state.sector);
    }
    state.objects = [];
  }
});

test("enemies have distinct, bounded movement behaviors", () => {
  const positions = [];
  for (const definition of Content.enemies) {
    const object: WorldObject = {
      ...definition,
      variant: definition.id,
      kind: "enemy",
      x: 400,
      y: 150,
      baseY: 150,
      age: 0,
      phase: 0,
    };
    for (let i = 0; i < 100; i++) {
      Generator.move(object, 100, 0.01);
      assert(Math.abs(object.y - object.baseY!) <= definition.amplitude + 0.001);
    }
    positions.push(object.x);
  }
  assert(new Set(positions).size >= 3);
});

test("offscreen entities are eventually removed", () => {
  const state = run();
  state.next = 0;
  for (let i = 0; i < 120 * 120; i++) {
    state.invincible = 1;
    Engine.update(state, 1 / 120);
    state.events.length = 0;
    assert(state.objects.length < 100);
  }
});
