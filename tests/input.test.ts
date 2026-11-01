import test from "node:test";
import assert from "node:assert/strict";
import Input from "../src/input";
import type { Actions } from "../src/types";

test("closing any menu returns focus to gameplay without stealing open-menu focus", (t) => {
  class Node extends EventTarget {
    matches() {
      return false;
    }
  }
  for (const [key, value] of Object.entries({ window: new EventTarget(), Element: Node })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, key, original);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
  let open = false;
  let focused: string;
  let jumps = 0;
  const canvas = Object.assign(new Node(), {
    focus(options: FocusOptions) {
      assert.equal(options.preventScroll, true);
      focused = "game";
    },
  });
  const doc = Object.assign(new Node(), {
    getElementById: () => new Node(),
    querySelector: () => (open ? new Node() : null),
  });
  const actions = new Proxy(
    { jump: () => jumps++ },
    {
      get: (target, key) => target[key as keyof typeof target] ?? (() => {}),
    },
  ) as unknown as Actions;
  Input.bind(doc as unknown as Document, actions, canvas as unknown as HTMLCanvasElement);
  for (const menu of ["party", "setup", "menu-setup"]) {
    focused = menu;
    doc.dispatchEvent(new Event("close"));
    assert.equal(focused, "game");
    const event = Object.assign(new Event("keydown", { cancelable: true }), {
      code: "Space",
      key: " ",
      repeat: false,
    });
    doc.dispatchEvent(event);
    assert(event.defaultPrevented);
  }
  assert.equal(jumps, 3);
  open = true;
  focused = "nested-menu";
  doc.dispatchEvent(new Event("close"));
  assert.equal(focused, "nested-menu");
  const space = Object.assign(new Event("keydown", { cancelable: true }), {
    code: "Space",
    key: " ",
    repeat: false,
  });
  doc.dispatchEvent(space);
  assert.equal(jumps, 3);
  assert.equal(space.defaultPrevented, false);
});
