import { test } from "node:test";
import assert from "node:assert/strict";
import Storage from "../src/storage";
test("restricted and corrupt browser storage do not crash the game", () => {
  const blocked = Storage.create(null);
  assert.equal(blocked.best(), 0n);
  assert.equal(blocked.muted(), false);
  assert.doesNotThrow(() => blocked.write("best", 50n));
  const corrupt = Storage.create({
    setItem() {},
    removeItem() {},
    getItem() {
      return "not a score";
    },
  });
  assert.equal(corrupt.best(), 0n);
});
test("best score and preferences persist under the existing storage keys", () => {
  const values = new Map<string, string>();
  const storage = Storage.create({
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => values.set(key, value),
  });
  storage.write("best", 9007199254740993n);
  storage.write("muted", true);
  storage.write("effects", false);
  assert.equal(storage.best(), 9007199254740993n);
  assert(storage.muted());
  assert(!storage.effects());
  assert(values.has("emberline.best"));
});

test("cloud saves export every persisted setting and restore atomically", () => {
  const values = new Map<string, string>([["other-app", "keep"]]);
  let failOnce = false;
  const saves = Storage.create({
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      if (failOnce && key === "emberline.best") {
        failOnce = false;
        throw new Error("quota");
      }
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  });
  saves.write("best", "12345678901234567890");
  saves.write("effects", false);
  saves.write("economy", '{"balance":"4500"}');
  const saved = saves.exportProgress();
  assert.equal(saved.best, "12345678901234567890");
  assert.equal(saved.effects, "false");
  assert.equal(saved.loadout, null);
  assert.equal(saves.importProgress({ ...saved, best: "10", effects: "true" }), true);
  assert.equal(saves.best(), 10n);
  assert.equal(saves.effects(), true);
  failOnce = true;
  assert.equal(saves.importProgress(saved), false);
  assert.equal(saves.best(), 10n);
  assert.equal(saves.effects(), true);
  assert.equal(values.get("other-app"), "keep");
  assert.equal(Storage.create(null).importProgress(saved), false);
});
