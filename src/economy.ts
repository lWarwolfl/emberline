import type { GearGroup, SaveStore, UpgradeId } from "./types";
import Loadout from "./loadout";
import Upgrades from "./upgrades";

// Prices are whole earned coins. Starter items and unequipping are always free.
const prices: Record<GearGroup, Record<string, number>> = {
  character: { fox: 0, bot: 500, hare: 900, ranger: 1500 },
  cape: { ember: 0, signal: 250, storm: 600, none: 0 },
  jetpack: { ember: 0, twin: 400, coil: 800, none: 0 },
  weapon: { punch: 0, pulse: 1200, scatter: 2400 },
};
const keyOf = (group: string, id: string) => group + ":" + id;
function price(group: string, id: string) {
  return Object.hasOwn(prices, group) && Object.hasOwn(prices[group as GearGroup], id)
    ? prices[group as GearGroup][id]
    : null;
}
function amount(value: unknown) {
  try {
    const result = BigInt(value as string | number | bigint | boolean);
    return result >= 0n ? result : 0n;
  } catch {
    return 0n;
  }
}
function create(saves: SaveStore) {
  const raw = saves.economy();
  const saved = raw?.version === 1 || raw?.version === 2 ? raw : null;
  let balance = saved ? amount(saved.balance) : saves.coins();
  const levels = Upgrades.sanitize(saved?.version === 2 ? saved.upgrades : {});
  const owned = new Set<string>();
  for (const [group, items] of Object.entries(prices)) {
    for (const [id, cost] of Object.entries(items)) {
      const key = keyOf(group, id);
      if (cost === 0 || (Array.isArray(saved?.owned) && saved.owned.includes(key))) owned.add(key);
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
  function owns(group: string, id: string) {
    if (group === "difficulty") return Loadout.difficulties.some((item) => item.id === id);
    return owned.has(keyOf(group, id));
  }
  function enforce(value: unknown) {
    const result = Loadout.sanitize(value);
    for (const group of Object.keys(prices) as GearGroup[])
      if (!owns(group, result[group])) result[group] = Loadout.defaults[group];
    return result;
  }
  function buy(group: string, id: string) {
    const cost = price(group, id);
    if (cost === null) return { ok: false, reason: "unknown" };
    if (owns(group, id)) return { ok: true, reason: "owned" };
    if (balance < BigInt(cost)) return { ok: false, reason: "insufficient" };
    balance -= BigInt(cost);
    owned.add(keyOf(group, id));
    save();
    return { ok: true, reason: "purchased" };
  }
  function upgrade(id: UpgradeId, expectedLevel: number) {
    const track = Upgrades.definition(id);
    if (!track) return { ok: false, reason: "unknown" };
    if (levels[id] >= track.maxLevel) return { ok: false, reason: "maxed" };
    if (expectedLevel !== levels[id]) return { ok: false, reason: "stale" };
    const cost = Upgrades.cost(id, levels)!;
    if (balance < BigInt(cost)) return { ok: false, reason: "insufficient" };
    balance -= BigInt(cost);
    levels[id]++;
    save();
    return { ok: true, reason: "upgraded", level: levels[id] };
  }
  function credit(value: unknown) {
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
export = { prices, price, create };
