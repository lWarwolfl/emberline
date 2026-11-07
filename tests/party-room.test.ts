import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { setImmediate } from "node:timers/promises";
import * as Network from "../src/party-network";

class Channel extends EventEmitter implements Network.RoomChannel {
  peer = "guest";
  closed = false;
  peerConnection = Object.assign(new EventTarget(), {
    iceConnectionState: "checking",
    connectionState: "connecting",
  }) as unknown as RTCPeerConnection;
  send() {}
  close() {
    this.closed = true;
  }
}
class Broker extends EventEmitter implements Network.RoomBroker {
  id = "guest-id";
  destroyed = false;
  channel = new Channel();
  destroy() {
    this.destroyed = true;
  }
  reconnect() {}
  connect() {
    return this.channel;
  }
}
function setup(t: TestContext, timeout = 1000) {
  for (const [name, value] of Object.entries({
    location: new URL("https://game.example"),
    fetch: async () => new Response(null, { status: 404 }),
  })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, name, original);
      else Reflect.deleteProperty(globalThis, name);
    });
  }
  const broker = new Broker();
  const ready: unknown[] = [],
    disconnected: string[] = [];
  const network = Network.create(
    {
      message() {},
      status() {},
      disconnected(id) {
        disconnected.push(id);
      },
      ready(...args) {
        ready.push(args);
      },
    },
    {
      connectionTimeoutMs: timeout,
      roomPeer: async (_id, config) => {
        assert(config.iceServers?.length);
        return broker;
      },
    },
  );
  t.after(() => network.close());
  return { network, broker, ready, disconnected };
}

test("joining waits for the data channel, not just signaling", async (t) => {
  const { network, broker, ready } = setup(t);
  const pending = network.link(false, "ABC123");
  await setImmediate();
  broker.emit("open");
  assert.equal(ready.length, 0);
  broker.channel.emit("open");
  await pending;
  assert.deepEqual(ready, [["guest-id", false, "ABC123"]]);
});

test("a silent ICE failure times out, closes the broker and allows retry", async (t) => {
  const { network, broker, ready } = setup(t, 25);
  const failed = assert.rejects(network.link(false, "ABC123"), /no relay enabled/);
  await setImmediate();
  broker.emit("open");
  await failed;
  assert.equal(broker.destroyed, true);
  broker.channel.emit("open");
  assert.equal(ready.length, 0);
});

test("failed ICE and early channel close reject the pending join immediately", async (t) => {
  const { network, broker } = setup(t);
  const failed = assert.rejects(network.link(false, "ABC123"), /could not connect/);
  await setImmediate();
  broker.emit("open");
  Object.assign(broker.channel.peerConnection, { iceConnectionState: "failed" });
  broker.channel.peerConnection.dispatchEvent(new Event("iceconnectionstatechange"));
  await failed;
  assert.equal(broker.channel.closed, true);
});

test("leaving cancels an in-flight join and ignores stale success", async (t) => {
  const { network, broker, ready } = setup(t);
  const cancelled = assert.rejects(network.link(false, "ABC123"), /cancelled/);
  await setImmediate();
  broker.emit("open");
  network.close();
  await cancelled;
  broker.channel.emit("open");
  assert.equal(ready.length, 0);
});

test("one guest's ICE failure does not tear down a hosted room", async (t) => {
  const { network, broker, disconnected } = setup(t);
  const pending = network.link(true, "ABC123");
  await setImmediate();
  broker.emit("open");
  await pending;
  broker.emit("connection", broker.channel);
  broker.channel.emit("error", new Error("ICE failed"));
  assert.equal(broker.destroyed, false);
  assert.deepEqual(disconnected, []);
  broker.emit("error", { type: "webrtc" });
  assert.equal(broker.destroyed, false);
});
