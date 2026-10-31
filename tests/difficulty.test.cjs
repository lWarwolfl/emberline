const { test } = require("node:test");
const assert = require("node:assert/strict");
const Content = require("../.build/content.js");
const Config = require("../.build/config.js");
const Difficulty = require("../.build/difficulty.js");
const Engine = require("../.build/engine.js");
const { run, advance } = require("./helpers.cjs");

test("base difficulty rises indefinitely and speed phases include recovery", () => {
  assert(Difficulty.baseSpeed(360) > Difficulty.baseSpeed(180));
  assert(Difficulty.baseSpeed(3600) > Difficulty.baseSpeed(360));
  const state = run(182);
  const paces = new Set();
  let previousSpeed = state.speed,
    accelerated = false,
    decelerated = false;
  for (let i = 0; i < 120 * 100; i++) {
    Engine.update(state, 1 / 120);
    state.events.length = 0;
    paces.add(state.pace);
    const change = state.speed - previousSpeed;
    if (change > 0) accelerated = true;
    if (change < 0) decelerated = true;
    assert(
      Math.abs(change) <=
        Math.max(Config.speed.acceleration, Config.speed.deceleration) / 120 + 0.00001,
    );
    previousSpeed = state.speed;
  }
  assert(accelerated && decelerated);
  assert.equal(paces.size, Content.paces.length);
});

test("background shuffle visits all five biomes without immediate repeats", () => {
  const state = run("biome-check");
  const seen = new Set();
  let previous = state.biome;
  for (let sector = 2; sector <= 6; sector++) {
    state.time = (sector - 1) * Config.sectorSeconds + 0.01;
    Difficulty.update(state, 1 / 120);
    assert.notEqual(state.biome, previous);
    seen.add(state.biome);
    previous = state.biome;
    assert.equal(state.previousBiome === state.biome, false);
    assert(state.biomeBlend < 0.01);
  }
  assert.equal(seen.size, Content.biomes.length);
});

test("sector and pace events are emitted at transitions", () => {
  const state = run();
  advance(state, 17.99);
  state.events = [];
  Engine.update(state, 0.05);
  assert.equal(state.sector, 2);
  assert(state.events.some((event) => event.type === "sector"));
});

test("background and pace RNG cannot change the seeded encounter stream", () => {
  const first = run(44),
    second = run(44);
  for (let i = 0; i < 50; i++) require("../.build/random.js").next(first.sceneryRng);
  require("../.build/generator.js").spawn(first);
  require("../.build/generator.js").spawn(second);
  assert.deepEqual(first.objects, second.objects);
});
