import { test } from "node:test";
import assert from "node:assert/strict";
import Engine from "../src/engine";
import Config from "../src/config";
import { run, advance } from "./helpers";

test("double jump is limited, and landing resets it", () => {
  const state = run();
  assert(Engine.jump(state));
  Engine.update(state, 0.016);
  assert(Engine.jump(state));
  assert(!Engine.jump(state));
  advance(state, 2);
  assert.equal(state.player.jumps, 0);
  assert.equal(state.player.y, Config.floor - Config.playerHeight);
  assert(Engine.jump(state));
});

test("input events survive updates until the app consumes them", () => {
  const state = run();
  Engine.jump(state);
  Engine.dash(state);
  Engine.update(state, 0.016);
  assert.deepEqual(
    state.events.map((event) => event.type),
    ["jump", "dash"],
  );
});

test("dash recharges and cannot be spammed", () => {
  const state = run();
  assert(Engine.dash(state));
  assert(!Engine.dash(state));
  advance(state, state.stats.dashCooldown + 0.1);
  assert(Engine.dash(state));
});

test("three separated hits end the run; grace period absorbs simultaneous damage", () => {
  const state = run();
  const hit = () => {
    state.objects = [{ kind: "hazard", variant: "crate", x: 83, y: 182, w: 13, h: 14 }];
    Engine.update(state, 0.001);
  };
  hit();
  hit();
  assert.equal(state.hits, 1);
  advance(state, 1.7);
  hit();
  assert.equal(state.hits, 2);
  advance(state, 1.7);
  hit();
  assert.equal(state.mode, "dead");
});

test("a dash impacts enemies once; only weak enemies break at base damage", () => {
  for (const variant of ["drone", "crawler", "jelly", "bat"]) {
    const state = run();
    Engine.dash(state);
    state.objects = [
      {
        kind: "enemy",
        variant,
        x: 83,
        y: 180,
        baseY: 180,
        w: 19,
        h: 12,
        age: 0,
        amplitude: 0,
        frequency: 0,
        phase: 0,
      },
    ];
    Engine.update(state, 0.001);
    assert.equal(state.hits, 0);
    if (variant === "bat") assert(state.events.some((event) => event.type === "smash"));
    else assert(!state.events.some((event) => event.type === "smash"));
  }
  const state = run();
  Engine.dash(state);
  state.objects = [{ kind: "hazard", variant: "", x: 83, y: 182, w: 13, h: 14 }];
  Engine.update(state, 0.001);
  assert.equal(state.hits, 1);
});

test("coins reward score and shorten dash recharge", () => {
  const state = run();
  Engine.dash(state);
  state.objects = [{ kind: "ember", variant: "", x: 84, y: 181, w: 5, h: 6 }];
  Engine.update(state, 0.001);
  assert.equal(state.embers, 2);
  assert.equal(state.pickups, 1);
  assert(state.score >= 55n);
  assert(state.cooldown < state.stats.dashCooldown - 0.05);
});

test("paused and dead states do not advance", () => {
  for (const mode of ["paused", "dead", "menu"] as const) {
    const state = run();
    state.mode = mode;
    Engine.update(state, 0.1);
    assert.equal(state.time, 0);
    assert.equal(state.score, 0n);
  }
});

test("score stays exact past Number.MAX_SAFE_INTEGER", () => {
  const state = run();
  state.score = 9007199254740993n;
  state.scoreRemainder = 0.999;
  Engine.update(state, 0.001);
  assert.equal(state.score, 9007199254740994n);
});

test("swept collisions catch objects crossing the courier at extreme speed", () => {
  const state = run();
  state.speed = 20000;
  state.objects = [{ kind: "hazard", variant: "", x: 130, y: 182, w: 13, h: 14 }];
  Engine.update(state, 1 / 120);
  assert.equal(state.hits, 1);
});

test("simulation is stable at 30, 60 and 120Hz", () => {
  const results = [30, 60, 120].map((rate) => {
    const state = run();
    for (let i = 0; i < rate * 10; i++) {
      Engine.update(state, 1 / rate);
      state.events.length = 0;
    }
    return state;
  });
  for (const state of results) {
    assert(Math.abs(state.distance - results[0].distance) < 0.001);
    assert.equal(state.score, results[0].score);
  }
});
