import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import Input from "../src/input";
import type { Actions } from "../src/types";

test("Space never natively activates retry while Enter and click remain deliberate", (t) => {
  class Node extends EventTarget {
    constructor(public id = "") {
      super();
    }
    matches(selector: string) {
      return selector === "#start"
        ? this.id === "start"
        : selector.split(",").includes("button") && this.id === "start";
    }
    focus() {}
  }
  const nodes = new Map<string, Node>();
  const get = (id: string) => {
    if (!nodes.has(id)) nodes.set(id, new Node(id));
    return nodes.get(id)!;
  };
  const doc = Object.assign(new Node(), { getElementById: get, querySelector: () => null });
  for (const [key, value] of Object.entries({ window: new EventTarget(), Element: Node })) {
    const old = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => {
      if (old) Object.defineProperty(globalThis, key, old);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
  let starts = 0,
    jumps = 0,
    enters = 0;
  const actions = new Proxy(
    { start: () => starts++, jump: () => jumps++, enter: () => enters++ },
    { get: (target, key) => target[key as keyof typeof target] ?? (() => {}) },
  ) as unknown as Actions;
  Input.bind(doc as unknown as Document, actions, get("game") as unknown as HTMLCanvasElement);
  const keyboard = (type: string, code: string, key: string, target: Node) => {
    const e = Object.assign(new Event(type, { cancelable: true }), { code, key, repeat: false });
    Object.defineProperty(e, "target", { value: target });
    doc.dispatchEvent(e);
    return e;
  };
  for (const type of ["keydown", "keyup"])
    assert(keyboard(type, "Space", " ", get("start")).defaultPrevented);
  assert.equal(starts, 0);
  assert.equal(jumps, 0);
  const enter = keyboard("keydown", "Enter", "Enter", get("start"));
  assert(!enter.defaultPrevented);
  // Simulate the browser's default Enter activation only when not prevented.
  if (!enter.defaultPrevented) get("start").dispatchEvent(new Event("click"));
  assert.equal(starts, 1);
  get("start").dispatchEvent(new Event("click"));
  assert.equal(starts, 2);
  keyboard("keydown", "Enter", "Enter", get("game"));
  assert.equal(enters, 1);
  keyboard("keydown", "Space", " ", get("game"));
  assert.equal(jumps, 1);
  assert.equal(starts, 2);
});

test("the app jump action cannot start a dead or menu run", () => {
  const source = ts.createSourceFile(
    "app.ts",
    fs.readFileSync("src/app.ts", "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  let jump: ts.MethodDeclaration | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isMethodDeclaration(node) && node.name.getText(source) === "jump") jump = node;
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert(jump?.body);
  const body = jump.body.getText(source);
  assert.match(body, /if \(state\.mode !== "playing"\) return;/);
  assert.doesNotMatch(body, /\bstart\s*\(/);
  assert.match(body, /Engine\.jump\(state\)/);
});
