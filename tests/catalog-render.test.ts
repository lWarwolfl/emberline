import assert from "node:assert/strict";
import { test } from "node:test";
import Loadout from "../src/loadout";
import Economy from "../src/economy";

test("hearts keep a red silhouette at both rarities", () => {
  const colors: string[] = [];
  const ctx = {
    fillStyle: "",
    fillRect(this: { fillStyle: string }, _x: number, _y: number, w: number, h: number) {
      if (w === 3 && h === 3) colors.push(String(this.fillStyle));
    },
  } as unknown as CanvasRenderingContext2D;
  const sprites = Sprites.create(ctx, true);
  for (const rarity of ["uncommon", "rare"] as const)
    sprites.object({ kind: "heart", variant: "heart", rarity, x: 200, y: 100, w: 9, h: 9 }, 0);
  assert.equal(colors.length, 4);
  for (const color of colors) {
    const red = parseInt(color.slice(1, 3), 16);
    assert(red > parseInt(color.slice(3, 5), 16) + 40);
    assert(red > parseInt(color.slice(5, 7), 16) + 40);
  }
});

test("expanded skins have unique identities and purchasable prices", () => {
  assert.ok(Loadout.capes.length >= 7);
  assert.ok(Loadout.jetpacks.length >= 7);
  for (const [group, catalog] of [
    ["cape", Loadout.capes],
    ["jetpack", Loadout.jetpacks],
  ] as const) {
    assert.equal(new Set(catalog.map((item) => item.id)).size, catalog.length);
    for (const item of catalog) assert.notEqual(Economy.price(group, item.id), null);
  }
});
test("siegebreaker is a costly armor weapon with a deliberate recharge", () => {
  const weapon = Loadout.weapons.find((item) => item.id === "siegebreaker");
  assert.ok(weapon);
  assert.ok(Economy.price("weapon", weapon.id)! >= 25000);
  assert.ok(weapon.cooldown >= 1.3);
});

import Sprites from "../src/sprites";
import Engine from "../src/engine";

test("all equipment sprites and new pickups render without mutating the run", () => {
  const commands: unknown[][] = [];
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get(_target, key) {
      return (...args: unknown[]) => commands.push([key, ...args]);
    },
    set() {
      return true;
    },
  });
  const sprites = Sprites.create(ctx, true);
  const state = Engine.create(37);
  for (const cape of Loadout.capes) {
    for (const jetpack of Loadout.jetpacks) {
      state.loadout.cape = cape.id;
      state.loadout.jetpack = jetpack.id;
      const before = JSON.stringify(state, (_key, value: unknown) =>
        typeof value === "bigint" ? value.toString() : value,
      );
      sprites.courier(100, 100, 1, true, state);
      assert.equal(
        JSON.stringify(state, (_key, value: unknown) =>
          typeof value === "bigint" ? value.toString() : value,
        ),
        before,
      );
    }
  }
  for (const kind of ["heart", "powerup", "platform"] as const)
    sprites.object({ kind, variant: "blast", rarity: "legendary", x: 200, y: 100, w: 12, h: 8 }, 0);
  assert.ok(commands.length > 100);
  assert.equal(
    commands.filter((command) => command[0] === "save").length,
    commands.filter((command) => command[0] === "restore").length,
  );
});
