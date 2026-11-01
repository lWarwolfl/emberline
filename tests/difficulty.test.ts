import Random from "../src/random";
import Generator from "../src/generator";
import { test } from "node:test";
import assert from "node:assert/strict";
import Content from "../src/content";
import Config from "../src/config";
import Difficulty from "../src/difficulty";
import Engine from "../src/engine";
import { run, advance } from "./helpers";

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

test("each biome group has five biomes and ends in one boss", () => {
  assert.equal(Content.groups.length, 5);
  assert(Content.groups.every((group) => group.biomes.length === 5));
  assert.equal(new Set(Content.biomes.map((biome) => biome.id)).size, 25);
  const state = run("biome-check");
  const first = Content.groups[0].biomes.map((biome) => biome.id);
  assert.equal(state.biome, first[0]);
  for (let index = 1; index < 5; index++) {
    state.time = index * Config.sectorSeconds + 0.01;
    Difficulty.update(state, 1 / 120);
    assert.equal(state.biome, first[index]);
    assert.equal(state.bossActive, false);
    assert(state.biomeBlend < 0.01);
  }
  state.time = 5 * Config.sectorSeconds + 0.01;
  Difficulty.update(state, 1 / 120);
  assert.equal(state.bossActive, true);
  assert.equal(state.biome, first[4]);
  assert(state.objects.some((object) => object.variant === "boss" && !object.dead));
  state.time = 8 * Config.sectorSeconds;
  Difficulty.update(state, 1 / 120);
  assert.equal(state.biome, first[4]);
  state.objects = state.objects.filter((object) => object.variant !== "boss");
  Difficulty.update(state, 1 / 120);
  assert.equal(state.bossActive, false);
  assert.equal(state.groupIndex, 1);
  assert.equal(state.biome, Content.groups[1].biomes[0].id);
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
  for (let i = 0; i < 50; i++) Random.next(first.sceneryRng);
  Generator.spawn(first);
  Generator.spawn(second);
  assert.deepEqual(first.objects, second.objects);
});
