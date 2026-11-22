import test from "node:test";
import assert from "node:assert/strict";
import Economy from "../src/economy";
import Storage from "../src/storage";
import { supporterCharacters } from "../src/donation-config";

test("coins and forged cloud ownership cannot buy supporter skins; verified entitlement unlocks both", () => {
  const saves = Storage.create(null),
    shop = Economy.create(saves);
  shop.credit(999999999999n);
  for (const id of supporterCharacters) {
    assert.equal(shop.buy("character", id).ok, false);
    assert.equal(shop.enforce({ character: id }).character, "fox");
  }
  assert(shop.setSupporter(true));
  for (const id of supporterCharacters) {
    assert(shop.owns("character", id));
    assert.equal(shop.enforce({ character: id }).character, id);
    assert(!shop.snapshot().owned.includes("character:" + id));
  }
  shop.setSupporter(false);
  assert(!shop.owns("character", supporterCharacters[0]));
  const forged = Storage.create({
    getItem: (key) =>
      key === "emberline.economy"
        ? JSON.stringify({
            version: 2,
            balance: "0",
            owned: supporterCharacters.map((id) => "character:" + id),
            upgrades: {},
          })
        : null,
    setItem() {},
    removeItem() {},
  });
  const other = Economy.create(forged);
  assert(!other.owns("character", supporterCharacters[0]));
});
