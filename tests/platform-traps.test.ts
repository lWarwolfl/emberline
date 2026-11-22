import test from "node:test";
import assert from "node:assert/strict";
import Generator from "../src/generator";
import Engine from "../src/engine";
import * as Party from "../src/party";
import { run } from "./helpers";
import type { WorldObject } from "../src/types";

function supportedTrap(objects: WorldObject[]) {
  return objects.filter(
    (o) =>
      o.kind === "hazard" &&
      objects.some(
        (p) => p.kind === "platform" && o.y + o.h === p.y && o.x >= p.x && o.x + o.w <= p.x + p.w,
      ),
  );
}

test("seeded platform traps are occasional, have clear ends, and keep coins out of danger", () => {
  let trapped = 0,
    safe = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const s = run(seed);
    s.sector = 5;
    Generator.spawn(s);
    const platforms = s.objects.filter((o) => o.kind === "platform");
    if (!platforms.length) continue;
    const traps = supportedTrap(s.objects);
    if (!traps.length) {
      safe++;
      continue;
    }
    trapped++;
    assert.equal(traps.length, 1);
    const trap = traps[0];
    assert.equal(trap.variant, "spikes");
    const platform = platforms.find((p) => p.y === trap.y + trap.h)!;
    assert(trap.x - platform.x >= 32);
    assert(platform.x + platform.w - trap.x - trap.w >= 32);
    for (const coin of s.objects.filter((o) => o.kind === "ember"))
      assert(!Generator.overlapsDanger(coin, trap));
    const copy = run(seed);
    copy.sector = 5;
    Generator.spawn(copy);
    assert.deepEqual(copy.objects, s.objects);
    const offset = platform.x - trap.x;
    Generator.move(platform, 280, 0.1);
    Generator.move(trap, 280, 0.1);
    assert.equal(platform.x - trap.x, offset);
  }
  assert(trapped > 15);
  assert(safe > trapped);
});

function fixture(x: number): WorldObject[] {
  return [
    { kind: "platform", variant: "bridge", x: x - 48, y: 155, w: 118, h: 8 },
    { kind: "hazard", variant: "spikes", x, y: 144, w: 23, h: 11 },
  ];
}

test("platform spikes hurt in solo and co-op, while a base jump clears them", () => {
  const s = run();
  s.objects = fixture(s.player.x);
  s.player.y = 137;
  Engine.update(s, 0.01);
  assert.equal(s.hits, 1);
  const jumper = run();
  jumper.player.y = 137;
  jumper.objects = fixture(jumper.player.x + 32);
  assert(Engine.jump(jumper));
  for (let i = 0; i < 11; i++) Engine.update(jumper, 0.1);
  assert.equal(jumper.hits, 0);
  const p = Party.profile({});
  const r = Party.create("a", p, 42);
  Party.start(r);
  r.world.next = Infinity;
  const courier = r.members[0].state;
  courier.player.y = 137;
  r.world.objects = fixture(courier.player.x);
  Party.update(r, 0.01);
  assert.equal(courier.hits, 1);
});
