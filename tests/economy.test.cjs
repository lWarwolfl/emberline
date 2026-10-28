const { test } = require("node:test");
const assert = require("node:assert/strict");
const Economy = require("../src/economy.js");
const Storage = require("../src/storage.js");
const Engine = require("../src/engine.js");
const Popups = require("../src/popups.js");

function fixture(balance = 0n) {
  const values = new Map([["emberline.coins", String(balance)]]);
  const saves = Storage.create({
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  });
  return { values, saves, shop: Economy.create(saves) };
}

test("legacy coins migrate once without resetting or duplicating the wallet", () => {
  const { saves, shop } = fixture(600n);
  assert.equal(shop.balance, 600n);
  shop.buy("character", "bot");
  const reloaded = Economy.create(saves);
  assert.equal(reloaded.balance, 100n);
  assert(reloaded.owns("character", "bot"));
});

test("starter equipment and no-gear variants are free; paid gear begins locked", () => {
  const { shop } = fixture();
  assert(shop.owns("character", "fox"));
  assert(shop.owns("cape", "ember"));
  assert(shop.owns("jetpack", "none"));
  assert(shop.owns("weapon", "punch"));
  assert(shop.owns("difficulty", "hard"));
  assert(!shop.owns("character", "hare"));
  assert(!shop.owns("weapon", "pulse"));
});

test("a purchase debits exact price and permanently grants the category-qualified item", () => {
  const { shop, saves, values } = fixture(1300n);
  assert.equal(shop.buy("weapon", "pulse").reason, "purchased");
  assert.equal(shop.balance, 100n);
  assert(shop.owns("weapon", "pulse"));
  const snapshot = JSON.parse(values.get("emberline.economy"));
  assert.equal(snapshot.balance, "100");
  assert(snapshot.owned.includes("weapon:pulse"));
  assert(Economy.create(saves).owns("weapon", "pulse"));
});

test("repeated purchase never charges twice and free equipment never charges", () => {
  const { shop } = fixture(1200n);
  shop.buy("weapon", "pulse");
  assert.equal(shop.buy("weapon", "pulse").reason, "owned");
  shop.buy("cape", "none");
  assert.equal(shop.balance, 0n);
});

test("insufficient funds and invalid purchase IDs cannot change wallet or ownership", () => {
  const { shop } = fixture(10n);
  assert.equal(shop.buy("cape", "storm").reason, "insufficient");
  for (const [group, id] of [
    ["weapon", "bogus"],
    ["difficulty", "hard"],
    ["__proto__", "toString"],
    ["constructor", "prototype"],
  ]) {
    assert.equal(shop.buy(group, id).reason, "unknown");
  }
  assert.equal(shop.balance, 10n);
  assert(!shop.owns("cape", "storm"));
});

test("saved unowned loadout is replaced by starters without charging or granting it", () => {
  const { shop } = fixture(200n);
  const chosen = shop.enforce({
    character: "hare",
    weapon: "scatter",
    cape: "storm",
    difficulty: "custom",
  });
  assert.equal(chosen.character, "fox");
  assert.equal(chosen.weapon, "punch");
  assert.equal(chosen.cape, "ember");
  assert.equal(chosen.difficulty, "custom");
  assert.equal(shop.balance, 200n);
});

test("wallet credits and purchases remain exact beyond safe Number limits", () => {
  const { shop } = fixture(9007199254740993n);
  shop.credit(3);
  shop.buy("character", "bot");
  assert.equal(shop.balance, 9007199254740496n);
  shop.credit(-1);
  shop.credit(NaN);
  shop.credit("invalid");
  assert.equal(shop.balance, 9007199254740496n);
});

test("every difficulty awards its fixed coins per pickup, custom awards zero", () => {
  for (const [difficulty, reward] of [
    ["easy", 1],
    ["standard", 2],
    ["hard", 3],
    ["custom", 0],
  ]) {
    const state = Engine.create(1, {
      difficulty,
      custom: { speed: 1.4, growth: 1.8, health: 2, density: 1.4 },
    });
    state.mode = "playing";
    state.next = Infinity;
    state.objects = [{ kind: "ember", x: 84, y: 181, w: 5, h: 6 }];
    Engine.update(state, 0.001);
    const event = state.events.find((item) => item.type === "pickup");
    assert.equal(event.coins, reward);
    assert.equal(state.embers, reward);
    assert.equal(state.pickups, 1);
    assert(state.score >= 55n);
    const { shop } = fixture();
    shop.credit(event.coins);
    assert.equal(shop.balance, BigInt(reward));
  }
});

test("changing pending difficulty cannot upgrade an active custom run's earnings", () => {
  const state = Engine.create(1, { difficulty: "custom" });
  state.mode = "playing";
  state.next = Infinity;
  state.loadout.difficulty = "hard";
  state.objects = [{ kind: "ember", x: 84, y: 181, w: 5, h: 6 }];
  Engine.update(state, 0.001);
  assert.equal(state.embers, 0);
  assert.equal(state.events.find((event) => event.type === "pickup").coins, 0);
});

test("popups display scaled coin awards and score-only practice feedback", () => {
  const popups = Popups.create();
  popups.add({ points: 55, coins: 3, x: 80, y: 100, label: "COIN" });
  assert.equal(popups.items[0].detail, "+3 COINS");
  popups.add({ points: 55, coins: 0, x: 80, y: 100, label: "NO COINS" });
  assert.equal(popups.items[1].text, "+55");
  assert.equal(popups.items[1].detail, "NO COINS");
});
