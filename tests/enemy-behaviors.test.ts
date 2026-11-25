import test from "node:test";
import assert from "node:assert/strict";
import Behaviors from "../src/enemy-behaviors";
import Combat from "../src/combat";
import Generator from "../src/generator";
import Config from "../src/config";
import { run } from "./helpers";

function fixture(variant: string) {
  const s = run();
  s.sector = 8;
  s.runSpeed = 100;
  const enemy = Generator.enemy(s, variant === "bomber" ? s.player.x + 110 : 360, variant);
  enemy.shotCooldown = 0;
  s.objects = [enemy];
  return { s, enemy };
}
test("prism fan locks its aim and has three separated dodgeable lanes", () => {
  const { s, enemy } = fixture("prism");
  Behaviors.update(s, 0.01);
  assert.equal(enemy.charge, 0.8);
  const aim = enemy.aimY;
  s.player.y = 20;
  Behaviors.update(s, 0.8);
  assert.equal(enemy.aimY, aim);
  assert.equal(s.hostileProjectiles.length, 3);
  assert(s.hostileProjectiles[0].vy !== s.hostileProjectiles[2].vy);
  assert(s.hostileProjectiles.every((b) => b.vx < 0));
});
test("scuttler alternates high/low shots and locks lane during warning", () => {
  const lanes = [];
  for (const age of [0, 4]) {
    const { s, enemy } = fixture("scuttler");
    enemy.age = age;
    Behaviors.update(s, 0.01);
    const lane = enemy.aimY;
    enemy.age = 10;
    Behaviors.update(s, 0.8);
    assert.equal(s.hostileProjectiles[0].y, lane);
    lanes.push(lane);
  }
  assert.deepEqual(lanes, [Config.floor - 37, Config.floor - 7]);
});
test("bomber warns near approach, explodes once, and killed/offscreen bombers never explode", () => {
  const { s, enemy } = fixture("bomber");
  enemy.x = 400;
  Behaviors.update(s, 0.01);
  assert(!enemy.charge);
  enemy.x = s.player.x + 110;
  Behaviors.update(s, 0.01);
  assert.equal(enemy.charge, 0.85);
  Behaviors.update(s, 0.85);
  assert(enemy.dead);
  assert.equal(s.hostileProjectiles.length, 8);
  Behaviors.update(s, 1);
  assert.equal(s.events.filter((e) => e.type === "bomber-burst").length, 1);
  assert(
    s.hostileProjectiles.every(
      (b) => Math.hypot(b.vx, b.vy) * b.life <= Behaviors.bomberRadius + 0.001,
    ),
  );
  const killed = fixture("bomber");
  Behaviors.update(killed.s, 0.01);
  Combat.damage(killed.s, killed.enemy, 100, "shot");
  Behaviors.update(killed.s, 1);
  assert.equal(killed.s.hostileProjectiles.length, 0);
  const offscreen = fixture("bomber");
  offscreen.enemy.charge = 0.01;
  offscreen.enemy.x = -20;
  Behaviors.update(offscreen.s, 1);
  assert.equal(offscreen.s.hostileProjectiles.length, 0);
});
test("enemy behavior obeys shared projectile cap and paused state", () => {
  const { s, enemy } = fixture("prism");
  enemy.charge = 0.001;
  s.hostileProjectiles = Array.from({ length: Config.enemyFire.maxProjectiles }, () => ({
    x: 0,
    y: 0,
    previousX: 0,
    previousY: 0,
    vx: 0,
    vy: 0,
    damage: 1,
    life: 1,
    color: "white",
  }));
  Behaviors.update(s, 0.01);
  assert.equal(s.hostileProjectiles.length, Config.enemyFire.maxProjectiles);
  s.mode = "paused";
  const before = structuredClone(s);
  Behaviors.update(s, 1);
  assert.deepEqual(s, before);
});
