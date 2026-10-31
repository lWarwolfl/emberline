const { test } = require("node:test");
const assert = require("node:assert/strict");
const Storage = require("../.build/storage.js");
test("restricted and corrupt browser storage do not crash the game", () => {
  const blocked = Storage.create(null);
  assert.equal(blocked.best(), 0n);
  assert.equal(blocked.muted(), false);
  assert.doesNotThrow(() => blocked.write("best", 50n));
  const corrupt = Storage.create({
    getItem() {
      return "not a score";
    },
  });
  assert.equal(corrupt.best(), 0n);
});
test("best score and preferences persist under the existing storage keys", () => {
  const values = new Map();
  const storage = Storage.create({
    getItem: (key) => values.get(key),
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
