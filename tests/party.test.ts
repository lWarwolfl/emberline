import test from "node:test";
import assert from "node:assert/strict";
import * as Party from "../src/party";
import Config from "../src/config";
import Combat from "../src/combat";
import type { GameState } from "../src/types";

const profile = (name = "Courier") =>
  Party.profile({ name, levels: { dash: 4, jump: 3, damage: 2, triple: 1 } });
function run(count = 4) {
  const r = Party.create("host", profile("Host"), "party-test");
  for (let i = 1; i < count; i++) assert(Party.add(r, `p${i}`, profile(`Courier ${i}`)));
  Party.start(r);
  r.world.next = Infinity;
  return r;
}
function advance(r: Party.PartyRun, seconds: number) {
  for (let t = 0; t < seconds; t += 1 / 60) Party.update(r, 1 / 60);
}
function ground(s: GameState) {
  Object.assign(s.player, { y: Config.floor - Config.playerHeight, vy: 0, jumps: 0 });
}
test("party limits to four, locks join during runs and sanitizes profiles", () => {
  const r = Party.create("host", profile(), 1);
  assert.equal(Party.add(r, "host", profile()), false);
  for (let i = 1; i < 4; i++) assert(Party.add(r, `p${i}`, profile()));
  assert.equal(Party.add(r, "p4", profile()), false);
  Party.start(r);
  assert.equal(Party.add(r, "late", profile()), false);
  assert.equal(Party.profile({ levels: { damage: 900 }, name: "x".repeat(30) }).levels.damage, 10);
  assert.equal(Party.profile({ name: "x".repeat(30) }).name.length, 18);
});
test("each additional player raises speed, growth, density and enemy armor", () => {
  let last = Party.scaling(1);
  for (let n = 2; n <= 4; n++) {
    const next = Party.scaling(n);
    for (const k of ["speed", "growth", "density", "armor"] as const) assert(next[k] > last[k]);
    assert(run(n).world.rules.gap < run(n - 1).world.rules.gap);
    last = next;
  }
  assert.deepEqual(Party.scaling(100), Party.scaling(4));
});
test("formation stays ordered, A holds its step, and D eases back to that slot", () => {
  const r = run();
  assert.deepEqual(r.order, ["host", "p1", "p2", "p3"]);
  const positions = Party.sorted(r).map((m) => m.state.player.x);
  assert(positions.every((x, i) => !i || positions[i - 1] > x));
  const back = r.members[3].state;
  const home = back.player.x;
  assert(Party.action(r, "p3", "strafe-left"));
  advance(r, 0.5);
  const shifted = back.player.x;
  assert(shifted < home - 20);
  assert(Party.action(r, "p3", "strafe-stop"));
  advance(r, 0.4);
  assert.equal(back.player.x, shifted);
  const lead = r.members[0].state;
  const leadHome = lead.player.x;
  assert(Party.action(r, "host", "strafe-right"));
  advance(r, 0.4);
  assert(lead.player.x > leadHome + 20);
  assert(Party.action(r, "host", "strafe-stop"));
  advance(r, 1.6);
  assert(Math.abs(lead.player.x - leadHome) < 1);
  assert.equal(Party.action(r, "intruder", "strafe-left"), false);
});
test("a connected crew counts down from 3 before the world moves", () => {
  const crew = Party.create("host", profile("Host"), "count");
  assert(Party.add(crew, "p1", profile("Ally")));
  Party.start(crew, true);
  assert.equal(crew.world.mode, "countdown");
  assert.equal(crew.countdown, 3);
  const distance = crew.world.distance;
  advance(crew, 0.9);
  assert.equal(crew.world.mode, "countdown");
  assert.equal(crew.world.distance, distance);
  assert.equal(Math.ceil(crew.countdown), 3);
  advance(crew, 2.2);
  assert.equal(crew.countdown, 0);
  assert.equal(crew.world.mode, "playing");
  assert(crew.world.distance > 0);
});
test("a guest adopts the host countdown", () => {
  const crew = Party.create("host", profile("Host"), "count");
  assert(Party.add(crew, "p1", profile("Ally")));
  Party.start(crew, true);
  const guest = Party.create("p1", profile("Ally"), "count");
  Party.adopt(guest, Party.decode(Party.encode(crew)));
  assert.equal(guest.world.mode, "countdown");
  assert.equal(guest.countdown, 3);
});
test("starting alone does not hold for a countdown", () => {
  const solo = Party.create("host", profile(), "solo");
  Party.start(solo, true);
  assert.equal(solo.countdown, 0);
  assert.equal(solo.world.mode, "playing");
});
test("party dash lunges from each formation slot and recenters without changing shared pace", () => {
  const r = run();
  const control = run();
  const positions = r.members.map((m) => m.state.player.x);
  assert(Party.action(r, "host", "dash"));
  assert(Party.action(r, "p3", "dash"));
  advance(r, 0.1);
  advance(control, 0.1);
  for (const i of [0, 3]) {
    assert(r.members[i].state.player.x > positions[i]);
    assert(r.members[i].state.player.x <= positions[i] + r.members[i].state.stats.dashLungeMax);
  }
  assert.equal(r.members[1].state.player.x, positions[1]);
  assert.equal(r.world.distance, control.world.distance);
  assert.deepEqual(
    Party.decode(Party.encode(r)).members.map((m) => m.state.player.x),
    r.members.map((m) => m.state.player.x),
  );
  advance(r, 1);
  assert.deepEqual(
    r.members.map((m) => m.state.player.x),
    positions,
  );
});
test("party recenter does not hit an obstacle already cleared by every courier", () => {
  const r = run(1);
  const s = r.members[0].state;
  s.player.x += 18;
  r.world.speed = 0;
  r.world.objects = [
    { kind: "hazard", variant: "crate", x: 82, y: 182, w: 13, h: 14, passed: true },
  ];
  advance(r, 0.1);
  assert.equal(s.hits, 0);
});
test("frontmost body intercepts one bullet without harming followers", () => {
  const r = run();
  const first = r.members[0].state;
  r.world.hostileProjectiles.push({
    x: first.player.x + 16,
    y: 186,
    previousX: first.player.x + 16,
    previousY: 186,
    vx: -600,
    vy: 0,
    damage: 1,
    color: "red",
    life: 2,
  });
  Party.update(r, 1 / 60);
  assert.equal(first.hits, 1);
  assert.deepEqual(
    r.members.slice(1).map((m) => m.state.hits),
    [0, 0, 0],
  );
  assert.equal(r.world.hostileProjectiles.length, 0);
});
test("crouch ducks a high shot and still meets a ground hazard", () => {
  const r = run(1);
  const courier = r.members[0].state;
  ground(courier);
  assert(Party.action(r, "host", "crouch"));
  r.world.hostileProjectiles.push({
    x: courier.player.x + 4,
    y: courier.player.y + 2,
    previousX: courier.player.x + 4,
    previousY: courier.player.y + 2,
    vx: 0,
    vy: 0,
    damage: 1,
    color: "red",
    life: 2,
  });
  Party.update(r, 1 / 60);
  assert.equal(courier.hits, 0);
  assert.equal(r.world.hostileProjectiles.length, 1);
  r.world.hostileProjectiles = [];
  r.world.objects = [
    { kind: "hazard", variant: "spike", x: courier.player.x + 4, y: 188, w: 12, h: 10 },
  ];
  Party.update(r, 1 / 60);
  assert.equal(courier.hits, 1);
});
test("hazards that pass the leader can still hit a grounded follower", () => {
  const r = run(2);
  const front = r.members[0].state,
    back = r.members[1].state;
  front.player.y = 100;
  front.player.vy = 0;
  r.world.objects = [
    { kind: "hazard", variant: "spike", x: back.player.x + 5, y: 180, w: 12, h: 16 },
  ];
  Party.update(r, 1 / 60);
  assert.equal(front.hits, 0);
  assert.equal(back.hits, 1);
});
test("downed players cannot act, survivors continue and whole party wipes end the run", () => {
  const r = run();
  const down = r.members[1];
  down.state.hits = down.state.health;
  assert.equal(Party.action(r, down.id, "jump"), false);
  Party.update(r, 0.05);
  assert.equal(r.world.mode, "playing");
  for (const m of r.members) m.state.hits = m.state.health;
  Party.update(r, 0.05);
  assert.equal(r.world.mode, "dead");
});
test("beacon requires dash contact, revives connected teammates only, once", () => {
  const r = run();
  const down = r.members[1];
  down.state.hits = down.state.health;
  r.members[2].connected = false;
  r.members[2].state.hits = r.members[2].state.health;
  const front = r.members[0].state;
  r.checkpoint = { x: front.player.x + 2, age: 0, used: false, flash: 0 };
  Party.update(r, 1 / 120);
  assert.equal(down.state.hits, down.state.health);
  assert(Party.action(r, "host", "dash"));
  Party.update(r, 1 / 120);
  assert.equal(down.state.hits, 0);
  assert(down.state.invincible > 1.8);
  assert.equal(r.members[2].state.hits, r.members[2].state.health);
  assert(r.checkpoint?.used);
  down.state.hits = down.state.health;
  Party.update(r, 1 / 120);
  assert.equal(down.state.hits, down.state.health);
});
test("a forward dash reaches a beacon to revive without awarding coins", () => {
  const r = run(2);
  const front = r.members[0].state;
  const down = r.members[1].state;
  down.hits = down.health;
  r.checkpoint = { x: front.player.x + 28, age: 0, used: false, flash: 0 };
  assert(Party.action(r, "host", "dash"));
  Party.update(r, 0.08);
  assert.equal(down.hits, 0);
  assert.equal(r.earned, 0);
  assert.equal(r.world.events.filter((event) => event.type === "revive").length, 1);
});
test("beacons start at 5000m and preserve the route across biome transitions", () => {
  const r = run(2);
  assert.equal(Boolean(r.checkpoint), false);
  const down = r.members[1];
  down.state.hits = down.state.health;
  r.world.time = Config.sectorSeconds - 0.001;
  Party.update(r, 1 / 60);
  assert.equal(r.world.sector, 2);
  assert.equal(Boolean(r.checkpoint), false);
  r.world.distance = 4600;
  r.world.next = Infinity;
  r.world.objects = [
    { kind: "hazard", variant: "spike", x: 80, y: 180, w: 12, h: 16 },
    { kind: "ember", variant: "coin", x: 320, y: 40, w: 8, h: 8 },
  ];
  Party.update(r, 1 / 120);
  assert(r.checkpoint && !r.checkpoint.used && r.checkpoint.x > Config.width);
  assert(Math.abs(r.checkpoint.x + r.world.distance - r.members[0].state.player.x - 5000) < 0.001);
  assert(r.world.objects.some((o) => o.variant === "spike"));
  assert(r.world.objects.some((o) => o.kind === "ember"));
  assert.equal(r.world.next, Infinity);
  assert.equal(down.state.hits, down.state.health);
  r.world.time = Config.sectorSeconds * 2 - 0.001;
  const beacon = r.checkpoint;
  Party.update(r, 1 / 60);
  assert.equal(r.checkpoint, beacon);
  r.world.distance = 5300;
  r.checkpoint.x = -81;
  Party.update(r, 1 / 120);
  assert.equal(Boolean(r.checkpoint), false);
  r.world.next = Infinity;
  r.world.distance = 9600;
  Party.update(r, 1 / 120);
  assert(r.checkpoint);
  assert(Math.abs(r.checkpoint.x + r.world.distance - r.members[0].state.player.x - 10000) < 0.001);
});
test("beacon progress clamps at the current distance target until the next beacon", () => {
  const r = run(2);
  assert.deepEqual(Party.progress(r), { value: 0, remaining: 5000, distance: 5000 });
  r.world.distance = 2500;
  assert.deepEqual(Party.progress(r), { value: 0.5, remaining: 2500, distance: 5000 });
  r.world.distance = 5010;
  assert.deepEqual(Party.progress(r), { value: 1, remaining: 0, distance: 5000 });
  assert.deepEqual(Party.progress(Party.decode(Party.encode(r))), Party.progress(r));
  r.beaconDistance = 10000;
  assert.deepEqual(Party.progress(r), { value: 0.002, remaining: 4990, distance: 10000 });
  Party.start(r);
  assert.deepEqual(Party.progress(r), { value: 0, remaining: 5000, distance: 5000 });
});
test("coins are collected once for the team and custom parties earn no coins", () => {
  const r = run();
  const x = r.members[0].state.player.x;
  r.world.objects = [{ kind: "ember", variant: "ground", x: x + 4, y: 185, w: 5, h: 6 }];
  Party.update(r, 1 / 60);
  assert.equal(r.earned, 2);
  assert.equal(r.world.embers, 2);
  advance(r, 0.1);
  assert.equal(r.earned, 2);
  const practice = Party.create("host", Party.profile({ loadout: { difficulty: "custom" } }), 1);
  Party.start(practice);
  practice.world.next = Infinity;
  practice.world.objects = [{ kind: "ember", variant: "ground", x: 87, y: 185, w: 5, h: 6 }];
  Party.update(practice, 0.05);
  assert.equal(practice.earned, 0);
});
test("snapshots preserve bigint scores, exact order, personal gear and levels", () => {
  const r = run();
  r.world.score = 1234567890123456789012345n;
  assert(Party.action(r, "p3", "strafe-left"));
  assert(Party.action(r, "p3", "crouch"));
  const encoded = Party.encode(r),
    decoded = Party.decode(encoded);
  assert.equal(decoded.world.score, r.world.score);
  assert.deepEqual(decoded.order, r.order);
  assert.equal(decoded.members.find((m) => m.id === "p3")!.state.strafe, -1);
  assert.equal(decoded.members.find((m) => m.id === "p3")!.state.crouching, true);
  assert.deepEqual(
    decoded.members.map((m) => m.state.player),
    r.members.map((m) => m.state.player),
  );
  assert.equal(Party.view(decoded, "p2").stats.levels.damage, 2);
  assert.equal(Party.view(decoded, "p2").stats.maxJumps, 3);
  assert(encoded.length < 20000);
});
test("disconnect reforms the line and restart preserves each player's purchased upgrades", () => {
  const r = run();
  Party.disconnect(r, "host");
  assert.equal(r.members[0].connected, false);
  assert(
    Party.sorted(r)
      .filter(Party.alive)
      .every((m, i, a) => !i || a[i - 1].state.player.x > m.state.player.x),
  );
  Party.start(r);
  assert.equal(r.members[1].state.stats.levels.dash, 4);
  assert.equal(r.members[1].state.stats.maxJumps, 3);
});
test("party pause freezes all world and player state", () => {
  const r = run();
  r.world.mode = "paused";
  const before = Party.encode(r);
  Party.update(r, 0.1);
  assert.equal(Party.encode(r), before);
  assert.equal(Party.action(r, "p1", "dash"), false);
});
test("a portal transports the whole line safely without unearned coins", () => {
  const r = run();
  const first = r.members[0].state;
  r.world.traversals = [{ kind: "portal", x: first.player.x + 3, y: 153, w: 22, h: 43, age: 0 }];
  Party.update(r, 1 / 60);
  assert(r.world.distance >= 650);
  assert.equal(r.earned, 0);
  assert(r.members.every((m) => m.state.invincible > 1));
  assert(Party.sorted(r).every((m, i, a) => !i || a[i - 1].state.player.x > m.state.player.x));
});

test("each courier's weapon damage and dash impacts keep independent attack IDs", () => {
  const r = run(2);
  const a = r.members[0].state,
    b = r.members[1].state;
  assert.notEqual(a.attackId, b.attackId);
  assert.notEqual(a.dashId, b.dashId);
  b.loadout.weapon = "repeater";
  assert(Party.action(r, "p1", "attack"));
  assert.equal(r.world.projectiles.length, 1);
  assert.equal(r.world.projectiles[0].damage, 0.6 * b.stats.damageMultiplier);
  const oldX = r.world.projectiles[0].x;
  const vx = r.world.projectiles[0].vx;
  Party.update(r, 1 / 120);
  assert(
    Math.abs(r.world.projectiles[0].x - oldX - vx / 120) < 0.001,
    "bullets move once per tick, not once per teammate",
  );
});
test("party dash deflects once and enemy durability scales when the encounter spawns", () => {
  const r = run();
  const first = r.members[0].state;
  Party.action(r, "host", "dash");
  r.world.hostileProjectiles.push({
    x: first.player.x + 16,
    y: 186,
    previousX: first.player.x + 16,
    previousY: 186,
    vx: -600,
    vy: 0,
    damage: 1,
    color: "red",
    life: 2,
  });
  Party.update(r, 1 / 60);
  assert.equal(first.hits, 0);
  assert.equal(r.world.hostileProjectiles.length, 0);
  assert(r.world.score >= 25n);
  r.world.sector = 3;
  r.world.time = 36;
  r.world.patternBag = ["patrol"];
  r.world.patternPool = "";
  r.world.next = 0;
  for (let i = 0; i < 12 && !r.world.objects.some((o) => o.kind === "enemy"); i++) {
    r.world.next = 0;
    Party.update(r, 1 / 120);
  }
  const enemies = r.world.objects.filter((o) => o.kind === "enemy");
  assert(enemies.length > 0);
  for (const enemy of enemies)
    assert.equal(enemy.hp, Combat.durability(enemy) * Party.scaling(4).armor);
});
