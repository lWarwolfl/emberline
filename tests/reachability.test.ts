import type { GameState } from "../src/types";
import { test } from "node:test";
import assert from "node:assert/strict";
import Engine from "../src/engine";
import Generator from "../src/generator";
import Content from "../src/content";
import Config from "../src/config";
import { run } from "./helpers";

// Explore a bounded set of jump/dash timings. This catches representative
// impossible combinations without pretending to prove every procedural run.
function hasSafeRoute(initial: GameState) {
  let frontier = [initial];
  for (let frame = 0; frame < 180; frame++) {
    const candidates = new Map<string, GameState>();
    for (const previous of frontier) {
      const actions = ["wait"];
      if (previous.player.jumps < previous.stats.maxJumps) actions.push("jump");
      if (previous.cooldown <= 0) actions.push("dash");
      for (const action of actions) {
        const state = structuredClone(previous);
        if (action === "jump") Engine.jump(state);
        if (action === "dash") Engine.dash(state);
        Engine.update(state, 0.08);
        state.events = [];
        if (state.hits > 0) continue;
        const dangers = state.objects.filter((object) => object.kind !== "ember");
        if (dangers.every((object) => object.x + object.w < Config.playerX)) return true;
        const key = [
          Math.round(state.player.y / 3),
          Math.round(state.player.vy / 20),
          state.player.jumps,
          Math.ceil(state.cooldown * 5),
          Math.ceil(state.dash * 20),
          dangers.map((object) => object.variant).join(","),
        ].join("/");
        candidates.set(key, state);
      }
    }
    const all = [...candidates.values()];
    if (!all.length) return false;
    // Keep diverse trajectories instead of biasing toward early jumps.
    frontier =
      all.length <= 100
        ? all
        : Array.from({ length: 100 }, (_, i) => all[Math.floor((i * all.length) / 100)]);
  }
  return false;
}

test("representative mixed encounters have a damage-free route at three speeds", () => {
  for (const speed of [100, 180, 280]) {
    for (const pattern of Content.patterns) {
      const state = run(pattern.id + speed);
      Object.assign(state, { sector: 10, time: 162, speed, nextPaceTime: Infinity });
      state.patternPool = Content.patterns.map((item) => item.id).join(",");
      state.patternBag = [pattern.id];
      Generator.spawn(state);
      state.next = Infinity;
      for (const object of state.objects) object.x -= 310;
      assert(
        hasSafeRoute(state),
        `${pattern.id} at ${speed}px/s has no safe route in the timing search`,
      );
    }
  }
});
