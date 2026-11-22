import test from "node:test";
import assert from "node:assert/strict";
import PowerupHud from "../src/powerup-hud";
import Icons from "../src/powerup-icons";
import Powerups from "../src/powerups";
import Sprites from "../src/sprites";
import Engine from "../src/engine";

test("all timed effects show independent shrinking meters and expire without a blank strip", () => {
  class Node {
    hidden = false;
    innerHTML = "";
    textContent = "";
    className = "";
    children: Node[] = [];
    parts = new Map<string, Node>();
    attributes = new Map<string, string>();
    style = { transform: "", setProperty() {} };
    append(child: Node) {
      this.children.push(child);
    }
    querySelector(key: string): Node {
      if (!this.parts.has(key)) this.parts.set(key, new Node());
      return this.parts.get(key)!;
    }
    setAttribute(key: string, value: string) {
      this.attributes.set(key, value);
    }
  }
  const root = new Node();
  const doc = { createElement: () => new Node() };
  const render = PowerupHud.create(doc as unknown as Document, root as unknown as HTMLElement);
  const s = Engine.create(1, undefined, { power: 5 });
  render(s);
  assert(root.hidden);
  for (const p of Powerups.catalog) {
    if (p.duration) s.activePowerups[p.id] = (p.duration * s.stats.powerDuration) / 2;
  }
  render(s);
  assert(!root.hidden);
  assert.equal(root.children.length, 5);
  for (const row of root.children) {
    assert(!row.hidden);
    assert.equal(row.querySelector("b").style.transform, "scaleX(0.5)");
    assert.match(row.querySelector("strong").textContent, /s$/);
    assert.match(row.attributes.get("aria-label")!, /seconds remaining/);
    assert.match(row.innerHTML, /<svg/);
  }
  s.activePowerups = { shield: 0.2 };
  render(s);
  assert.equal(root.children.filter((r) => !r.hidden).length, 1);
  s.activePowerups = {};
  render(s);
  assert(root.hidden);
});

test("map powerups have six distinct colored silhouettes without a shared box", () => {
  const silhouettes = new Set<string>();
  const colors = new Set<string>();
  for (const p of Powerups.catalog) {
    silhouettes.add(JSON.stringify(Icons.pixels(p.id)));
    colors.add(p.color);
    const draws: number[][] = [];
    const ctx = new Proxy({} as CanvasRenderingContext2D, {
      get(_target, key) {
        return (...args: number[]) => {
          if (key === "fillRect") draws.push(args);
        };
      },
      set() {
        return true;
      },
    });
    Sprites.create(ctx, true).object(
      { kind: "powerup", variant: p.id, x: 100, y: 100, w: 12, h: 12 },
      0,
    );
    assert(draws.length > 10);
    assert(
      draws.every((d) => d[2] === 2 && d[3] === 2),
      "only icon pixels, no surrounding box",
    );
  }
  assert.equal(silhouettes.size, 6);
  assert.equal(colors.size, 6);
});
