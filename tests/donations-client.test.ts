import test from "node:test";
import assert from "node:assert/strict";
import { create } from "../src/donations";
import fs from "node:fs";
import path from "node:path";

test("donation dialog prepares and submits the signed claim, resets edited proofs, and hides history after logout", async (t) => {
  class Node extends EventTarget {
    tagName = "DIV";
    get localName() {
      return this.tagName.toLowerCase();
    }
    textContent = "";
    value = "";
    hidden = false;
    disabled = false;
    open = false;
    children: unknown[] = [];
    attributes = new Map<string, string>();
    classList = {
      contains: (name: string) => this.id === "donation-close" && name === "close-button",
    };
    constructor(public id = "") {
      super();
    }
    append(...children: unknown[]) {
      this.children.push(...children);
    }
    replaceChildren(...children: unknown[]) {
      this.children = children;
    }
    setAttribute(key: string, value: string) {
      this.attributes.set(key, value);
    }
    showModal() {
      this.open = true;
    }
    close() {
      this.open = false;
      this.dispatchEvent(new Event("close"));
    }
    click() {
      if (!this.disabled) this.dispatchEvent(new Event("click"));
    }
    reportValidity() {
      return true;
    }
    getContext() {
      return new Proxy({}, { get: () => () => {}, set: () => true });
    }
    querySelectorAll() {
      return [...nodes.values()].filter((n) => n.tagName === "BUTTON");
    }
  }
  const nodes = new Map<string, Node>();
  const html = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf8");
  for (const match of html.matchAll(/<(\w+)[^>]*\bid="(donation-[^"]+)"/g)) {
    const n = new Node(match[2]);
    n.tagName = match[1].toUpperCase();
    nodes.set(n.id, n);
  }
  const get = (id: string) => nodes.get("donation-" + id)!;
  get("network").value = "bnb";
  const doc = { getElementById: (id: string) => nodes.get(id), createElement: () => new Node() };
  let account: string | null = "account-a",
    unlocked = false,
    login = 0,
    equipped = "",
    claims = 0;
  const requests: { action: string; body: Record<string, unknown> }[] = [];
  const globals = {
    location: { protocol: "https:" },
    matchMedia: () => ({ matches: true }),
    fetch: async (url: string, init?: RequestInit) => {
      const action = url.split("/").at(-1)!;
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
      requests.push({ action, body });
      if (action === "donations")
        return Response.json({
          supporter: unlocked,
          donations: unlocked
            ? [
                {
                  network: "bnb",
                  txId: "0x" + "a".repeat(64),
                  asset: "BNB",
                  amountUnits: "1",
                  decimals: 18,
                  verifiedAt: "2026-11-22T00:00:00Z",
                },
              ]
            : [],
        });
      if (action === "donation-challenge")
        return Response.json({ nonce: "one-time-proof", message: "Emberline exact claim message" });
      if (action === "donation-claim") {
        claims++;
        unlocked = true;
        return Response.json({ supporter: true });
      }
      throw new Error("Unexpected action");
    },
  };
  for (const [key, value] of Object.entries(globals)) {
    const old = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => {
      if (old) Object.defineProperty(globalThis, key, old);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
  const ui = create(doc as unknown as Document, {
    beforeOpen() {},
    login() {
      login++;
    },
    refresh: async () => account,
    equip: (id) => {
      equipped = id;
    },
  });
  const flush = async () => {
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
  };
  ui.open();
  await flush();
  assert(get("dialog").open);
  assert(get("equip").hidden);
  get("tx").value = "0x" + "a".repeat(64);
  get("sender").value = "0x" + "1".repeat(40);
  get("prepare").click();
  await flush();
  assert.equal(get("message").value, "Emberline exact claim message");
  get("tx").dispatchEvent(new Event("input"));
  get("claim").click();
  await flush();
  assert.equal(claims, 0);
  get("prepare").click();
  await flush();
  get("signature").value = "wallet-signature";
  get("email").value = "donor@example.com";
  get("claim").click();
  await flush();
  assert.equal(claims, 1);
  assert(!get("equip").hidden);
  assert(!get("history-section").hidden);
  const submitted = requests.find((r) => r.action === "donation-claim")!.body;
  assert.equal(submitted.signature, "wallet-signature");
  assert.equal(submitted.email, "donor@example.com");
  assert(!("amount" in submitted));
  get("equip").click();
  await flush();
  assert.equal(equipped, "cinder-crown");
  account = null;
  get("dialog").close();
  ui.open();
  await flush();
  assert(get("equip").hidden);
  assert(get("history-section").hidden);
  assert.equal(get("email").value, "");
  assert.equal(get("history").children.length, 0);
  get("login").click();
  assert.equal(login, 1);
  assert(!get("dialog").open);
});
