import { test } from "node:test";
import assert from "node:assert/strict";
import * as Accounts from "../src/accounts";
import type { SavePayload } from "../src/cloud-save";

class ElementStub {
  hidden = false;
  disabled = false;
  open = false;
  textContent = "";
  value = "";
  dataset: Record<string, string> = {};
  labels = [{ textContent: "" }];
  classList = { contains: () => false };
  children = new Map<string, ElementStub>();
  listeners = new Map<string, (event: Event) => void>();
  setAttribute() {}
  append() {}
  remove() {}
  showModal() {
    this.open = true;
  }
  close() {
    this.open = false;
  }
  addEventListener(name: string, handler: (event: Event) => void) {
    this.listeners.set(name, handler);
  }
  querySelector(selector: string) {
    if (!this.children.has(selector)) this.children.set(selector, new ElementStub());
    return this.children.get(selector)!;
  }
  querySelectorAll(selector: string) {
    if (selector === "[data-mode]")
      return ["register", "recover"].map((mode) => {
        const element = this.querySelector(`[data-mode="${mode}"]`);
        element.dataset.mode = mode;
        return element;
      });
    return [...this.children.values()];
  }
  click() {
    this.listeners.get("click")?.({} as Event);
  }
}

test("account retries hydration, serializes save flushes, and retains a cloud conflict when apply fails", async () => {
  const originals = ["location", "window", "fetch"].map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  );
  const dialog = new ElementStub();
  const doc = {
    body: new ElementStub(),
    createElement: () => dialog,
    addEventListener() {},
  } as unknown as Document;
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { protocol: "http:" },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { addEventListener() {} },
  });
  let data: SavePayload = { best: "0" };
  const writes: SavePayload[] = [];
  let reads = 0;
  let version = 0;
  let hold = false;
  let release: (() => void) | undefined;
  let conflict = false;
  let denyApply = false;
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: async (url: string, init: RequestInit) => {
      if (url.endsWith("session")) return json({ user: { id: "one", username: "courier" } });
      if (init.method === "GET") {
        if (++reads === 1) throw new Error("Temporary outage");
        return json({ userId: "one", data: { best: "0" }, version });
      }
      const body = JSON.parse(String(init.body)) as { data: SavePayload };
      writes.push(body.data);
      if (hold) {
        hold = false;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      if (conflict)
        return json({ data: { best: "999" }, version: 99, message: "Cloud changed" }, 409);
      return json({ data: body.data, version: ++version });
    },
  });
  const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
  const client = Accounts.create(doc, {
    capture: () => ({ ...data }),
    apply: (incoming) => {
      if (denyApply) throw new Error("Storage denied");
      data = incoming;
    },
  });
  try {
    await tick();
    assert.match(client.status, /Temporary outage/);
    await client.sync();
    assert.equal(reads, 2);
    assert.equal(writes.length, 1);
    hold = true;
    data.best = "1";
    const first = client.sync();
    await tick();
    data.best = "2";
    const flush = client.sync();
    assert.ok(release);
    release();
    await Promise.all([first, flush]);
    assert.equal(writes.at(-2)?.best, "1");
    assert.equal(writes.at(-1)?.best, "2");
    conflict = true;
    await client.sync();
    const previousWrites = writes.length;
    denyApply = true;
    dialog.querySelector("[data-cloud]").click();
    await tick();
    assert.match(client.status, /Storage denied/);
    assert.equal(dialog.querySelector(".account-conflict").hidden, false);
    await client.sync();
    assert.equal(writes.length, previousWrites);
    denyApply = false;
    dialog.querySelector("[data-cloud]").click();
    await tick();
    assert.equal(data.best, "999");
    assert.equal(dialog.querySelector(".account-conflict").hidden, true);
  } finally {
    client.destroy();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
