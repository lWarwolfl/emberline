import test from "node:test";
import assert from "node:assert/strict";
import Input from "../src/input";
import type { Actions } from "../src/types";

test("closing any menu returns focus to gameplay without stealing open-menu focus", (t) => {
  let summaryFocused = false;
  class Node extends EventTarget {
    matches(selector: string) {
      return summaryFocused && selector.split(",").includes("summary");
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
  let grounds = 0;
  let controls = 0;
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
    {
      jump: () => jumps++,
      ground: () => grounds++,
      controls: () => controls++,
    },
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
  for (const code of ["KeyS", "ArrowDown", "KeyH"])
    doc.dispatchEvent(
      Object.assign(new Event("keydown", { cancelable: true }), { code, key: code, repeat: false }),
    );
  assert.equal(grounds, 2);
  assert.equal(controls, 1);
  assert.deepEqual(Input.pose(), { strafe: 0, crouch: true, climb: false, shield: false });
  doc.dispatchEvent(
    Object.assign(new Event("keydown", { cancelable: true }), {
      code: "KeyA",
      key: "a",
      repeat: false,
    }),
  );
  assert.deepEqual(Input.pose(), { strafe: -1, crouch: true, climb: false, shield: false });
  doc.dispatchEvent(Object.assign(new Event("keyup"), { code: "KeyA" }));
  doc.dispatchEvent(
    Object.assign(new Event("keydown", { cancelable: true }), {
      code: "KeyD",
      key: "d",
      repeat: false,
    }),
  );
  assert.deepEqual(Input.pose(), { strafe: 1, crouch: true, climb: false, shield: false });
  doc.dispatchEvent(Object.assign(new Event("keyup"), { code: "KeyD" }));
  doc.dispatchEvent(Object.assign(new Event("keyup"), { code: "KeyS" }));
  assert.deepEqual(Input.pose(), { strafe: 0, crouch: false, climb: false, shield: false });
  doc.dispatchEvent(
    Object.assign(new Event("keydown", { cancelable: true }), {
      code: "ArrowUp",
      key: "ArrowUp",
      repeat: false,
    }),
  );
  assert(Input.pose().climb);
  doc.dispatchEvent(Object.assign(new Event("keyup"), { code: "ArrowUp" }));
  assert(!Input.pose().climb);
  const wPress = Object.assign(new Event("keydown", { cancelable: true }), {
    code: "KeyW",
    key: "w",
    repeat: false,
  });
  doc.dispatchEvent(wPress);
  assert(wPress.defaultPrevented);
  assert(Input.pose().climb);
  doc.dispatchEvent(Object.assign(new Event("keyup"), { code: "KeyW" }));
  assert(!Input.pose().climb);
  doc.dispatchEvent(
    Object.assign(new Event("keydown", { cancelable: true }), {
      code: "KeyK",
      key: "k",
      repeat: false,
    }),
  );
  assert(Input.pose().shield);
  doc.dispatchEvent(Object.assign(new Event("keyup"), { code: "KeyK" }));
  assert(!Input.pose().shield);
  doc.dispatchEvent(
    Object.assign(new Event("keydown", { cancelable: true }), {
      code: "KeyK",
      key: "k",
      repeat: false,
    }),
  );
  window.dispatchEvent(new Event("blur"));
  assert(!Input.pose().shield);
  summaryFocused = true;
  const summarySpace = Object.assign(new Event("keydown", { cancelable: true }), {
    code: "Space",
    key: " ",
    repeat: false,
  });
  doc.dispatchEvent(summarySpace);
  assert.equal(summarySpace.defaultPrevented, false);
  assert.equal(jumps, 5);
  summaryFocused = false;
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
  assert.equal(jumps, 5);
  assert.equal(space.defaultPrevented, false);
  doc.dispatchEvent(
    Object.assign(new Event("keydown", { cancelable: true }), {
      code: "KeyS",
      key: "s",
      repeat: false,
    }),
  );
  assert.equal(grounds, 2);
});

test("flight shield uses the shared hold behavior and releases on cancel, blur and dialog keys", (t) => {
  class Node extends EventTarget {
    matches() {
      return false;
    }
  }
  class Pointer extends Event {
    pointerId = 1;
  }
  for (const [key, value] of Object.entries({
    window: new EventTarget(),
    Element: Node,
    PointerEvent: Pointer,
  })) {
    const old = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => {
      if (old) Object.defineProperty(globalThis, key, old);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
  const nodes = new Map<string, Node>();
  const node = (id: string) => {
    if (!nodes.has(id)) nodes.set(id, new Node());
    return nodes.get(id)!;
  };
  let open = false;
  const doc = Object.assign(new Node(), {
    getElementById: node,
    querySelector: () => (open ? new Node() : null),
  });
  const actions = new Proxy({}, { get: () => () => {} }) as Actions;
  const canvas = Object.assign(new Node(), { focus() {} });
  Input.release();
  Input.bind(doc as unknown as Document, actions, canvas as unknown as HTMLCanvasElement);
  const flight = node("ship-shield");
  flight.dispatchEvent(new Pointer("pointerdown", { cancelable: true }));
  assert(Input.pose().shield);
  flight.dispatchEvent(new Event("pointercancel"));
  assert(!Input.pose().shield);
  flight.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { key: " " }));
  assert(Input.pose().shield);
  flight.dispatchEvent(Object.assign(new Event("keyup"), { key: " " }));
  assert(!Input.pose().shield);
  flight.dispatchEvent(new Pointer("pointerdown", { cancelable: true }));
  flight.dispatchEvent(new Event("blur"));
  assert(!Input.pose().shield);
  flight.dispatchEvent(new Pointer("pointerdown", { cancelable: true }));
  open = true;
  doc.dispatchEvent(Object.assign(new Event("keydown"), { code: "KeyK", key: "k", repeat: false }));
  assert(!Input.pose().shield);
});
