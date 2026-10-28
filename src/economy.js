/** Permanent local purchases and spendable coins. A single snapshot saves both. */
(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./loadout.js"), require("./upgrades.js"));
  else {
    root.Emberline = root.Emberline || {};
    root.Emberline.Economy = factory(root.Emberline.Loadout, root.Emberline.Upgrades);
  }
})(globalThis, function (Loadout, Upgrades) {
  "use strict";
  // Prices are whole earned coins. Starter items and unequipping are always free.
  const prices = {
    character: { fox: 0, bot: 500, hare: 900, ranger: 1500 },
    cape: { ember: 0, signal: 250, storm: 600, none: 0 },
    jetpack: { ember: 0, twin: 400, coil: 800, none: 0 },
    weapon: { punch: 0, pulse: 1200, scatter: 2400 },
  };
  const keyOf = (group, id) => group + ":" + id;
  function price(group, id) {
    return Object.hasOwn(prices, group) && Object.hasOwn(prices[group], id)
      ? prices[group][id]
      : null;
  }
  function amount(value) {
    try {
      const result = BigInt(value);
      return result >= 0n ? result : 0n;
    } catch {
      return 0n;
    }
  }
  function create(saves) {
    const raw = saves.economy();
    const saved = [1, 2].includes(raw?.version) ? raw : null;
    let balance = saved ? amount(saved.balance) : saves.coins();
    const levels = Upgrades.sanitize(saved?.version === 2 ? saved.upgrades : {});
    const owned = new Set();
    for (const [group, items] of Object.entries(prices)) {
      for (const [id, cost] of Object.entries(items)) {
        const key = keyOf(group, id);
        if (cost === 0 || (Array.isArray(saved?.owned) && saved.owned.includes(key)))
          owned.add(key);
      }
    }
    function save() {
      // Ownership and debit share one localStorage write: no half-purchase state.
      saves.write(
        "economy",
        JSON.stringify({
          version: 2,
          balance: balance.toString(),
          owned: [...owned],
          upgrades: levels,
        }),
      );
    }
    function owns(group, id) {
      if (group === "difficulty") return Loadout.difficulties.some((item) => item.id === id);
      return owned.has(keyOf(group, id));
    }
    function enforce(value) {
      const result = Loadout.sanitize(value);
      for (const group of Object.keys(prices))
        if (!owns(group, result[group])) result[group] = Loadout.defaults[group];
      return result;
    }
    function buy(group, id) {
      const cost = price(group, id);
      if (cost === null) return { ok: false, reason: "unknown" };
      if (owns(group, id)) return { ok: true, reason: "owned" };
      if (balance < BigInt(cost)) return { ok: false, reason: "insufficient" };
      balance -= BigInt(cost);
      owned.add(keyOf(group, id));
      save();
      return { ok: true, reason: "purchased" };
    }
    function upgrade(id, expectedLevel) {
      const track = Upgrades.definition(id);
      if (!track) return { ok: false, reason: "unknown" };
      if (levels[id] >= track.maxLevel) return { ok: false, reason: "maxed" };
      if (expectedLevel !== levels[id]) return { ok: false, reason: "stale" };
      const cost = Upgrades.cost(id, levels);
      if (balance < BigInt(cost)) return { ok: false, reason: "insufficient" };
      balance -= BigInt(cost);
      levels[id]++;
      save();
      return { ok: true, reason: "upgraded", level: levels[id] };
    }
    function credit(value) {
      const coins = amount(value);
      if (!coins) return;
      balance += coins;
      save();
    }
    // Migrate the previous lifetime coin counter into the spendable wallet once.
    if (!saved || saved.version !== 2) save();
    return {
      buy,
      upgrade,
      get levels() {
        return { ...levels };
      },
      owns,
      enforce,
      credit,
      price,
      get balance() {
        return balance;
      },
    };
  }
  return { prices, price, create };
});
