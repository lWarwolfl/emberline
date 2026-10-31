const { test } = require("node:test");
const assert = require("node:assert/strict");
const Upgrades = require("../.build/upgrades.js");
const Economy = require("../.build/economy.js");
const Storage = require("../.build/storage.js");
const Engine = require("../.build/engine.js");
const Combat = require("../.build/combat.js");

function fixture(coins = 20000n, prior) {
  const values = new Map([["emberline.coins", String(coins)]]);
  if (prior) values.set("emberline.economy", JSON.stringify(prior));
  const saves = Storage.create({
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  });
  return { saves, values, shop: Economy.create(saves) };
}

test("each normal track costs 100, 200, 300, 400, 500 and stops at L5", () => {
  for (const id of ["dash", "jump", "damage"]) {
    const { shop } = fixture(1500n);
    for (let level = 0; level < 5; level++) {
      assert.equal(Upgrades.cost(id, shop.levels), (level + 1) * 100);
      assert(shop.upgrade(id, level).ok);
    }
    assert.equal(shop.levels[id], 5);
    assert.equal(shop.balance, 0n);
    assert.equal(Upgrades.cost(id, shop.levels), null);
    assert.equal(shop.upgrade(id, 5).reason, "maxed");
  }
});

test("insufficient and stale upgrade purchases never consume coins or levels", () => {
  const { shop } = fixture(300n);
  assert(shop.upgrade("dash", 0).ok);
  assert.equal(shop.balance, 200n);
  assert.equal(shop.upgrade("dash", 0).reason, "stale");
  assert.equal(shop.balance, 200n);
  assert(shop.upgrade("dash", 1).ok);
  assert.equal(shop.upgrade("dash", 2).reason, "insufficient");
  assert.equal(shop.upgrade("unknown", 0).reason, "unknown");
  assert.equal(shop.levels.dash, 2);
  assert.equal(shop.balance, 0n);
});

test("Triple Jump costs 5000 once and is capped at L1", () => {
  const { shop } = fixture(4999n);
  assert.equal(Upgrades.cost("triple", shop.levels), 5000);
  assert.equal(shop.upgrade("triple", 0).reason, "insufficient");
  shop.credit(1);
  assert(shop.upgrade("triple", 0).ok);
  assert.equal(shop.balance, 0n);
  assert.equal(shop.levels.triple, 1);
  assert.equal(shop.upgrade("triple", 1).reason, "maxed");
});

test("old wallet and owned gear migrate without being charged the increased prices", () => {
  const { shop, saves } = fixture(0n, {
    version: 1,
    balance: "321",
    owned: ["weapon:scatter", "character:hare"],
  });
  assert.equal(shop.balance, 321n);
  assert(shop.owns("weapon", "scatter"));
  assert(shop.owns("character", "hare"));
  assert.equal(shop.levels.damage, 0);
  const reloaded = Economy.create(saves);
  assert.equal(reloaded.balance, 321n);
  assert(reloaded.owns("weapon", "scatter"));
});

test("upgrade debit and level persist in the same saved snapshot", () => {
  const { shop, saves, values } = fixture(300n);
  shop.upgrade("jump", 0);
  shop.upgrade("jump", 1);
  const saved = JSON.parse(values.get("emberline.economy"));
  assert.equal(saved.version, 2);
  assert.equal(saved.balance, "0");
  assert.equal(saved.upgrades.jump, 2);
  assert.equal(Economy.create(saves).levels.jump, 2);
  const copy = shop.levels;
  copy.jump = 99;
  assert.equal(shop.levels.jump, 2);
});

test("corrupt upgrade levels are clamped to the documented caps", () => {
  assert.deepEqual(Upgrades.sanitize({ dash: 99, jump: -2, damage: NaN, triple: 9 }), {
    dash: 5,
    jump: 0,
    damage: 0,
    triple: 1,
  });
  assert.deepEqual(Upgrades.sanitize(null), { dash: 0, jump: 0, damage: 0, triple: 0 });
});

test("level zero begins basic and capped stats remain below the old overpowered dash", () => {
  const basic = Upgrades.stats();
  const max = Upgrades.stats({ dash: 5, jump: 5, damage: 5 });
  assert.equal(basic.dashWorldMultiplier, 1.18);
  assert.equal(basic.dashLungeMax, 18);
  assert.equal(basic.damageMultiplier, 1);
  assert.equal(max.damageMultiplier, 2);
  assert(max.dashWorldMultiplier < 1.8);
  assert(max.dashDuration < 0.36);
  assert(max.dashCooldown < basic.dashCooldown);
  assert(max.jumpVelocity < basic.jumpVelocity);
});

test("Triple Jump permits exactly three jump presses, and landing restores them", () => {
  const state = Engine.create(4, {}, { triple: 1 });
  state.mode = "playing";
  state.next = Infinity;
  assert(Engine.jump(state));
  Engine.update(state, 0.05);
  assert(Engine.jump(state));
  Engine.update(state, 0.05);
  assert(Engine.jump(state));
  assert(!Engine.jump(state));
  assert.equal(state.player.vy, state.stats.thirdJumpVelocity);
  for (let i = 0; i < 240; i++) Engine.update(state, 1 / 120);
  assert.equal(state.player.jumps, 0);
  assert(Engine.jump(state));
});

test("purchases during a run cannot change its stat snapshot", () => {
  const { shop } = fixture();
  const state = Engine.create(1, {}, shop.levels);
  shop.upgrade("damage", 0);
  shop.upgrade("triple", 0);
  assert.equal(state.stats.damageMultiplier, 1);
  assert.equal(state.stats.maxJumps, 2);
  const next = Engine.create(2, {}, shop.levels);
  assert.equal(next.stats.damageMultiplier, 1.2);
  assert.equal(next.stats.maxJumps, 3);
});

test("damage upgrades affect actual punches and projectile damage", () => {
  const state = Engine.create(1, {}, { damage: 1 });
  state.mode = "playing";
  state.next = Infinity;
  const drone = {
    kind: "enemy",
    variant: "drone",
    x: 115,
    y: 180,
    baseY: 180,
    w: 19,
    h: 12,
    age: 0,
    amplitude: 0,
    frequency: 0,
    phase: 0,
  };
  state.objects = [drone];
  Engine.attack(state);
  Engine.update(state, 0.01);
  assert(drone.dead);
  assert.equal(state.score >= 150n, true);
  state.loadout.weapon = "pulse";
  state.attackCooldown = 0;
  Engine.attack(state);
  assert.equal(state.projectiles[0].damage, 1.2);
});

test("a basic dash cannot deal repeated frame-by-frame damage to a strong enemy", () => {
  const state = Engine.create(1);
  state.mode = "playing";
  state.next = Infinity;
  const enemy = {
    kind: "enemy",
    variant: "crawler",
    x: 84,
    y: 184,
    baseY: 184,
    w: 20,
    h: 12,
    age: 0,
    amplitude: 0,
    frequency: 0,
    phase: 0,
  };
  state.objects = [enemy];
  Engine.dash(state);
  Engine.update(state, 0.06);
  assert.equal(enemy.hp, 1.4);
  assert(!enemy.dead);
  assert.equal(state.hits, 0);
});

test("skins and guns require substantial coin savings", () => {
  assert.deepEqual(
    [
      Economy.price("character", "bot"),
      Economy.price("character", "hare"),
      Economy.price("character", "ranger"),
    ],
    [500, 900, 1500],
  );
  assert.equal(Economy.price("weapon", "pulse"), 1200);
  assert.equal(Economy.price("weapon", "scatter"), 2400);
  assert.equal(Combat.durability({ kind: "enemy", variant: "crawler" }), 2.4);
});
