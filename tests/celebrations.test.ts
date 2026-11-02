import test from "node:test";
import assert from "node:assert/strict";
import Celebrations from "../src/celebrations";

class Node {
  hidden = true;
  className = "";
  textContent = "";
  children: Node[] = [];
  style = { setProperty() {} };
  setAttribute() {}
  append(...children: Node[]) {
    this.children.push(...children);
  }
  replaceChildren(...children: Node[]) {
    this.children = children;
  }
}
function fixture(reduced = false, particles = true) {
  const purchase = new Node(),
    record = new Node();
  const doc = {
    getElementById: (id: string) => (id === "purchase-feedback" ? purchase : record),
    createElement: () => new Node(),
  } as unknown as Document;
  return { purchase, record, effects: Celebrations.create(doc, reduced, () => particles) };
}
test("purchase and record visuals have separate messages and expire independently", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { purchase, record, effects } = fixture();
  effects.purchase("Storm mantle");
  effects.record(9007199254740993n);
  assert.equal(purchase.hidden, false);
  assert.equal(purchase.children[0].children[2].textContent, "Storm mantle");
  assert(record.children[0].children[3].textContent.includes("9,007,199,254,740,993"));
  assert.equal(purchase.children[1].children.length, 16);
  t.mock.timers.tick(2201);
  assert.equal(purchase.hidden, true);
  assert.equal(record.hidden, false);
  t.mock.timers.tick(600);
  assert.equal(record.hidden, true);
});
test("effects off or reduced motion retains readable feedback without sparks", () => {
  for (const [reduced, particles] of [
    [true, true],
    [false, false],
  ]) {
    const { purchase, record, effects } = fixture(reduced, particles);
    effects.purchase("Twin rockets");
    effects.record(200n);
    assert.equal(purchase.children.length, 1);
    assert.equal(record.children.length, 1);
    assert.equal(purchase.hidden, false);
    effects.clear();
    assert.equal(purchase.hidden, true);
    assert.equal(record.hidden, true);
  }
});
