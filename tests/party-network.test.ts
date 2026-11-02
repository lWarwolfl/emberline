import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
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

test("LAN relay check accepts this host and rejects a page with no relay", async () => {
  const { createServer } = await import("node:http");
  const { createLanServer } = await import("../scripts/lan-server");
  const app = createLanServer();
  const plain = createServer((_req, res) => {
    res.writeHead(404).end();
  });
  app.server.listen(0, "127.0.0.1");
  plain.listen(0, "127.0.0.1");
  await Promise.all([once(app.server, "listening"), once(plain, "listening")]);
  const relay = app.server.address();
  const other = plain.address();
  assert(relay && typeof relay !== "string");
  assert(other && typeof other !== "string");
  try {
    await Network.requireRelay(`http://127.0.0.1:${relay.port}/`);
    await assert.rejects(
      () => Network.requireRelay(`http://127.0.0.1:${other.port}/`),
      /no LAN relay/,
    );
  } finally {
    app.close();
    plain.close();
  }
});

test("a line-broken answer still matches the waiting invite", async (t) => {
  const sdp = "v=0\r\na=candidate:1 1 udp 2122260223 1.2.3.4 9 typ host\r\n";
  class Channel {
    readyState = "connecting";
    bufferedAmount = 0;
    onopen: (() => void) | null = null;
    onmessage: (() => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    send() {}
    close() {}
  }
  class Peer {
    signalingState = "stable";
    iceGatheringState = "complete";
    connectionState = "new";
    localDescription: { type: string; sdp: string } | null = null;
    ondatachannel: ((event: { channel: Channel }) => void) | null = null;
    onconnectionstatechange: (() => void) | null = null;
    createDataChannel() {
      return new Channel();
    }
    createOffer() {
      return Promise.resolve({ type: "offer", sdp });
    }
    createAnswer() {
      return Promise.resolve({ type: "answer", sdp });
    }
    setLocalDescription(description: { type: string; sdp: string }) {
      this.localDescription = description;
      this.signalingState = description.type === "offer" ? "have-local-offer" : "stable";
      return Promise.resolve();
    }
    setRemoteDescription() {
      this.signalingState = "stable";
      return Promise.resolve();
    }
    close() {
      this.connectionState = "closed";
    }
    addEventListener() {}
    removeEventListener() {}
  }
  const original = Object.getOwnPropertyDescriptor(globalThis, "RTCPeerConnection");
  Object.defineProperty(globalThis, "RTCPeerConnection", { configurable: true, value: Peer });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "RTCPeerConnection", original);
    else Reflect.deleteProperty(globalThis, "RTCPeerConnection");
  });
  const callbacks = { message() {}, disconnected() {}, status() {}, ready() {} };
  const host = Network.create(callbacks);
  const guest = Network.create(callbacks);
  t.after(() => {
    host.close();
    guest.close();
  });
  host.host();
  const offer = await host.offer();
  const answer = await guest.answer(offer);
  const wrapped = `answer:\n${answer.slice(0, 16)}\n${answer.slice(16)}\nthanks`;
  await host.accept(wrapped);
});
