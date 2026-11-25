import test from "node:test";
import assert from "node:assert/strict";
import Bosses from "../src/bosses";
import Config from "../src/config";
import Engine from "../src/engine";
import { run } from "./helpers";
import * as Party from "../src/party";

test("boss identities are seeded, varied, and never repeat consecutively", () => {
  const s = run("boss-sequence"),
    other = run("boss-sequence"),
    ids = new Set();
  let previous = "";
  for (let i = 0; i < 30; i++) {
    s.sector = other.sector = 6 + i * 5;
    const boss = Bosses.spawn(s),
      copy = Bosses.spawn(other);
    assert.deepEqual(boss, copy);
    assert.notEqual(boss.bossId, previous);
    previous = boss.bossId!;
    ids.add(previous);
    assert(boss.hp === boss.maxHp && boss.maxHp! > 0);
  }
  assert.equal(ids.size, 4);
});
test("all boss attacks telegraph, freeze aim, respect projectile caps and stop on death", () => {
  for (const id of Object.keys(Bosses.catalog) as (keyof typeof Bosses.catalog)[]) {
    const s = run(),
      boss = Bosses.spawn(s);
    boss.bossId = id;
    boss.shotCooldown = 0;
    s.objects = [boss];
    Bosses.update(s, 0.01);
    assert(boss.charge! >= 0.7);
    assert.equal(s.hostileProjectiles.length, 0);
    const locked = boss.aimY;
    s.player.y = 40;
    Bosses.update(s, 0.1);
    assert.equal(boss.aimY, locked);
    Bosses.update(s, 2);
    assert(s.hostileProjectiles.length >= 2);
    assert(boss.shotCooldown! >= 2);
    s.hostileProjectiles.length = 0;
    boss.dead = true;
    boss.charge = 0.01;
    Bosses.update(s, 1);
    assert.equal(s.hostileProjectiles.length, 0);
    boss.dead = false;
    boss.charge = 0.01;
    while (s.hostileProjectiles.length < Config.enemyFire.maxProjectiles)
      s.hostileProjectiles.push({
        x: 0,
        y: 0,
        previousX: 0,
        previousY: 0,
        vx: 0,
        vy: 0,
        life: 1,
        damage: 1,
        color: "red",
      });
    Bosses.update(s, 1);
    assert.equal(s.hostileProjectiles.length, Config.enemyFire.maxProjectiles);
  }
});
test("boss patterns differ and health metadata survives party snapshots", () => {
  const patterns = new Set();
  for (const id of Object.keys(Bosses.catalog) as (keyof typeof Bosses.catalog)[]) {
    const s = run(),
      boss = Bosses.spawn(s);
    boss.bossId = id;
    boss.charge = 0.01;
    boss.aimX = 82;
    boss.aimY = 187;
    s.objects = [boss];
    Bosses.update(s, 0.02);
    patterns.add(JSON.stringify(s.hostileProjectiles.map((p) => [p.y, p.vx, p.vy])));
  }
  assert.equal(patterns.size, 4);
  const r = Party.create("a", Party.profile({}), 42);
  Party.start(r);
  const boss = Bosses.spawn(r.world);
  r.world.objects = [boss];
  assert.deepEqual(Party.clone(r).world.objects[0], boss);
});

test("each boss volley has a damage-free response with base jump or crouch", () => {
  for (const id of Object.keys(Bosses.catalog) as (keyof typeof Bosses.catalog)[])
    for (const phase of [0, 1]) {
      let safe = false;
      for (const crouch of [false, true])
        for (const jumpAt of [-1, 0.2, 0.5, 0.8, 1.1, 1.4, 1.7, 2, 2.3, 2.6]) {
          const s = run();
          const boss = Bosses.spawn(s);
          boss.bossId = id;
          boss.bossPhase = phase;
          boss.x = 300;
          boss.shotCooldown = 0;
          s.objects = [boss];
          s.bossActive = true;
          s.crouching = crouch;
          for (let frame = 0; frame < 150; frame++) {
            if (jumpAt >= 0 && Math.abs(frame * 0.02 - jumpAt) < 0.01) Engine.jump(s);
            Engine.update(s, 0.02);
            if ((boss.bossPhase ?? phase) > phase) boss.shotCooldown = 100;
          }
          if (s.hits === 0) safe = true;
        }
      assert(safe, `${id} phase ${phase} needs a reachable base dodge`);
    }
});
