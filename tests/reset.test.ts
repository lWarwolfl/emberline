import { test } from "node:test";
import assert from "node:assert/strict";
import Storage from "../src/storage";

function fixture(fail = false) {
  const values = new Map([
    ["emberline.economy", "purchases"],
    ["emberline.coins", "777"],
    ["emberline.loadout", "gear"],
    ["emberline.best", "1200"],
    ["emberline.muted", "true"],
    ["emberline.effects", "false"],
    ["other-app", "keep"],
  ]);
  let count = 0;
  const storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem(key) {
      if (fail && count++ === 1) throw new Error("Storage denied");
      values.delete(key);
    },
  };
  return { values, saves: Storage.create(storage) };
}

test("reset clears only progress, including legacy coins, and preserves preferences", () => {
  const { values, saves } = fixture();
  assert.equal(saves.resetProgress(), true);
  for (const key of ["economy", "coins", "loadout", "best"])
    assert(!values.has("emberline." + key));
  assert.equal(values.get("emberline.muted"), "true");
  assert.equal(values.get("emberline.effects"), "false");
  assert.equal(values.get("other-app"), "keep");
});

test("a partial storage failure restores removed progress instead of restarting", () => {
  const { values, saves } = fixture(true);
  const before = [...values.entries()].sort();
  assert.equal(saves.resetProgress(), false);
  assert.deepEqual([...values.entries()].sort(), before);
});

test("reset reports unavailable storage without throwing", () => {
  assert.equal(Storage.create(null).resetProgress(), false);
});
