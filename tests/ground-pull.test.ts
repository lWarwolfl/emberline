import test from "node:test";
import assert from "node:assert/strict";
import Engine from "../src/engine";
import Config from "../src/config";
import * as Party from "../src/party";
import { run } from "./helpers";

test("ground pull descends through platforms and resets jumps only at the floor", () => {
  const state = run();
  state.player.y = 60;
  state.player.vy = -100;
  state.player.jumps = 2;
  state.objects = [{ kind: "platform", variant: "ledge", x: 40, y: 120, w: 240, h: 6 }];
  assert(Engine.ground(state));
  assert.equal(state.player.y, 60);
  assert.equal(state.player.jumps, 2);
  assert(!Engine.ground(state));
  for (let i = 0; i < 5; i++) Engine.update(state, 0.1);
  assert.equal(state.player.y, Config.floor - Config.playerHeight);
  assert.equal(state.player.jumps, 0);
  assert.equal(state.grounding, false);
  assert.equal(state.events.filter((e) => e.type === "ground-land").length, 1);
  assert.equal(state.invincible, 0);
  assert.equal(state.embers, 0);
});

test("ground pull rejects paused, dead, downed and already grounded couriers", () => {
  const state = run();
  assert(!Engine.ground(state));
  state.player.y = 80;
  state.mode = "paused";
  assert(!Engine.ground(state));
  state.mode = "dead";
  assert(!Engine.ground(state));
  state.mode = "playing";
  state.hits = state.health;
  assert(!Engine.ground(state));
});

test("ground pull cancels flight without consuming stored powers and still takes hazard damage", () => {
  const state = run();
  state.player.y = 90;
  state.activePowerup = { id: "flight", remaining: 8 };
  state.powerups = ["titan"];
  assert(Engine.ground(state));
  assert.equal(state.activePowerup, null);
  assert.deepEqual(state.powerups, ["titan"]);
  state.powerups = ["flight"];
  assert(!Engine.powerup(state));
  assert.deepEqual(state.powerups, ["flight"]);
  state.objects = [{ kind: "hazard", variant: "pipe", x: state.player.x, y: 170, w: 30, h: 26 }];
  for (let i = 0; i < 3; i++) Engine.update(state, 0.1);
  assert.equal(state.hits, 1);
});

test("co-op ground pull preserves personal state in snapshots and lands authoritatively", () => {
  const party = Party.create("host", Party.profile({}), 19);
  Party.start(party);
  party.world.next = Infinity;
  const state = party.members[0].state;
  state.player.y = 70;
  state.player.jumps = 2;
  assert(Party.action(party, "host", "ground"));
  assert.equal(Party.view(Party.decode(Party.encode(party)), "host").grounding, true);
  for (let i = 0; i < 5; i++) Party.update(party, 0.1);
  assert.equal(state.player.y, Config.floor - Config.playerHeight);
  assert.equal(state.grounding, false);
  assert.equal(party.world.events.filter((e) => e.type === "ground-land").length, 1);
});
