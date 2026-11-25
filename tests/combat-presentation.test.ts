import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Sprites from "../src/sprites";
import Ships from "../src/ships";
import Engine from "../src/engine";
import * as Party from "../src/party";
import UI from "../src/ui";
import { run } from "./helpers";

test("hearts draw icon pixels without any background or frame", () => {
  const draws: { w: number; h: number; color: string }[] = [];
  const ctx = {
    fillStyle: "",
    fillRect(this: { fillStyle: string }, _x: number, _y: number, w: number, h: number) {
      draws.push({ w, h, color: this.fillStyle });
    },
  } as unknown as CanvasRenderingContext2D;
  for (const rarity of ["rare", "uncommon"] as const)
    Sprites.create(ctx, true).object(
      { kind: "heart", variant: "heart", rarity, x: 200, y: 100, w: 9, h: 9 },
      0,
    );
  assert.equal(draws.length, 12);
  assert(draws.every((d) => d.w <= 8 && d.h <= 3));
  assert(draws.every((d) => ["#f06d78", "#ffd5d8", "#fff1d6"].includes(d.color)));
});
test("ships remain deterministic but occur near twenty percent of eligible sectors", () => {
  let offers = 0;
  for (let seed = 0; seed < 10000; seed++) if (Ships.opportunity(seed, 2).available) offers++;
  assert(offers > 1800 && offers < 2200, String(offers));
});
test("left and right keyed motion share the same slower rate in solo and co-op", () => {
  for (const direction of [-1, 1] as const) {
    const s = run();
    const start = s.player.x;
    s.strafe = direction;
    Engine.update(s, 0.1);
    Engine.update(s, 0.1);
    assert(Math.abs(Math.abs(s.player.x - start) - 19) < 0.001);
    const r = Party.create("a", Party.profile({}), 42);
    Party.start(r);
    r.world.next = Infinity;
    const member = r.members[0].state,
      initial = member.player.x;
    Party.action(r, "a", direction < 0 ? "strafe-left" : "strafe-right");
    Party.update(r, 0.1);
    Party.update(r, 0.1);
    assert(Math.abs(Math.abs(member.player.x - initial) - 19) < 0.001);
  }
});
test("boss health and death-only donation invitation use actual state", (t) => {
  class Node {
    textContent = "";
    hidden = false;
    className = "";
    style = { transform: "", setProperty() {} };
    attributes = new Map<string, string>();
    children = new Map<string, Node>();
    classList = { toggle() {}, add() {}, remove() {} };
    firstChild = { textContent: "" };
    get firstElementChild() {
      return this.querySelector("i");
    }
    constructor(public localName = "div") {}
    setAttribute(key: string, value: string) {
      this.attributes.set(key, value);
    }
    append() {}
    querySelector(key: string): Node {
      if (!this.children.has(key)) this.children.set(key, new Node());
      return this.children.get(key)!;
    }
    cells = Array.from({ length: 12 }, () => ({ style: { transform: "" } }));
    querySelectorAll() {
      return this.cells;
    }
  }
  const nodes = new Map<string, Node>();
  const tags: Record<string, string> = {
    game: "canvas",
    effects: "input",
    attack: "button",
    "countdown-meter": "span",
  };
  const get = (id: string) => {
    if (!nodes.has(id)) nodes.set(id, new Node(tags[id]));
    return nodes.get(id)!;
  };
  const doc = { getElementById: get, createElement: () => new Node() };
  const prior = Object.getOwnPropertyDescriptor(globalThis, "matchMedia");
  Object.defineProperty(globalThis, "matchMedia", {
    configurable: true,
    value: () => ({ matches: true }),
  });
  t.after(() => {
    if (prior) Object.defineProperty(globalThis, "matchMedia", prior);
    else Reflect.deleteProperty(globalThis, "matchMedia");
  });
  const ui = UI.create(doc as unknown as Document),
    s = run();
  s.objects = [
    {
      kind: "enemy",
      variant: "boss",
      bossId: "leviathan",
      maxHp: 40,
      hp: 10,
      x: 300,
      y: 100,
      w: 46,
      h: 58,
    },
  ];
  ui.render(s, 0n);
  assert.equal(get("boss-hp").textContent, "10 / 40");
  assert.equal(get("boss-meter").attributes.get("aria-valuenow"), "25");
  assert.match(get("boss-health").className, /leviathan/);
  assert(get("death-donate").hidden);
  s.score = 900719925474099312345n;
  s.embers = 1234;
  ui.showOverlay("dead", s);
  assert.equal(get("round-score").textContent, "900719925474099312345");
  assert.equal(get("round-coins").textContent, "1234");
  assert(!get("round-results").hidden);
  assert(!get("death-donate").hidden);
  ui.showOverlay("paused", s);
  assert(get("round-results").hidden);
  assert(get("death-donate").hidden);
  ui.supporter(true);
  ui.showOverlay("dead", s);
  assert.match(get("death-donate").querySelector("strong").textContent, /COLLECTION/);
  ui.hideOverlay();
  assert(get("death-donate").hidden);
});
test("each boss health bar has a distinct structural treatment", () => {
  const css = fs.readFileSync("style.css", "utf8");
  assert.match(css, /boss-warden[^}]*border-bottom-width/);
  assert.match(css, /boss-leviathan \.boss-track i[^}]*clip-path/);
  assert.match(css, /boss-herald \.boss-track[^}]*border-block/);
  assert.match(css, /boss-matron \.boss-track i[^}]*clip-path/);
});
