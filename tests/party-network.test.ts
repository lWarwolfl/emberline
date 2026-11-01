import test from "node:test";
import assert from "node:assert/strict";
import * as Network from "../src/party-network";

test("LAN uses the target protocol and rejects unsafe addresses", (t) => {
  const urls: string[] = [];
  for (const [name, value] of Object.entries({
    location: new URL("http://127.0.0.1:4174/?desktop=1"),
    WebSocket: class {
      constructor(url: URL) {
        urls.push(String(url));
      }
      close() {}
    },
  })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, name, original);
      else Reflect.deleteProperty(globalThis, name);
    });
  }
  const network = Network.create({
    message() {},
    disconnected() {},
    status() {},
    ready() {},
  });
  t.after(() => network.close());

  network.lan(false, " abc123 ", "https://host.example:8443/path");
  assert.equal(urls.pop(), "wss://host.example:8443/party?role=guest&room=ABC123");
  network.lan(false, "abc123", "http://host.example:4174/path");
  assert.equal(urls.pop(), "ws://host.example:4174/party?role=guest&room=ABC123");

  for (const address of [
    "ftp://host.example",
    "ws://host.example",
    "wss://host.example",
    "javascript:alert(1)",
    "https://user@host.example",
    "http://:password@host.example",
    "https://user:password@host.example",
  ]) {
    assert.throws(() => network.lan(false, "abc123", address), /without login details/);
  }
  assert.deepEqual(urls, []);
});
