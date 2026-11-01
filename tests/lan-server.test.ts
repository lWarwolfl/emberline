import test from "node:test";
import path from "node:path";
import assert from "node:assert/strict";
import { once } from "node:events";
import { WebSocket } from "ws";
import { createLanServer } from "../scripts/lan-server";

function incoming(ws: WebSocket) {
  return new Promise<Record<string, unknown>>((resolve) =>
    ws.once("message", (raw) => resolve(JSON.parse(raw.toString()))),
  );
}
test("LAN room relay enforces four players, host routing, run locks and host departure", async () => {
  const app = createLanServer(path.resolve(__dirname, ".."));
  app.server.listen(0, "127.0.0.1");
  await once(app.server, "listening");
  const address = app.server.address();
  assert(address && typeof address !== "string");
  const base = `ws://127.0.0.1:${address.port}/party`;
  async function connect(query: string) {
    const ws = new WebSocket(base + query);
    const data = await incoming(ws);
    return { ws, data };
  }
  try {
    const host = await connect("?role=host");
    assert.equal(host.data.kind, "welcome");
    const room = host.data.room;
    const guests = [];
    for (let i = 0; i < 3; i++) guests.push(await connect(`?role=guest&room=${room}`));
    const fifth = await connect(`?role=guest&room=${room}`);
    assert.equal(fifth.data.kind, "error");
    assert.match(String(fifth.data.message), /full/);
    const received = incoming(host.ws);
    guests[0].ws.send(
      JSON.stringify({
        to: host.data.id,
        data: { type: "hello", profile: { name: "Guest" } },
        from: "forged",
      }),
    );
    const hello = await received;
    assert.equal(hello.from, guests[0].data.id);
    const snapshot = incoming(guests[1].ws);
    host.ws.send(
      JSON.stringify({ to: guests[1].data.id, data: { type: "state", snapshot: "hello" } }),
    );
    assert.equal((await snapshot).from, host.data.id);
    const left = incoming(host.ws);
    guests[2].ws.close();
    await left;
    host.ws.send(JSON.stringify({ kind: "lock", locked: true }));
    // An acknowledgement message on the same host socket orders the lock before join.
    const ack = incoming(guests[0].ws);
    host.ws.send(
      JSON.stringify({ to: guests[0].data.id, data: { type: "state", snapshot: "locked" } }),
    );
    await ack;
    const late = await connect(`?role=guest&room=${room}`);
    assert.match(String(late.data.message), /started/);
    const departure = incoming(guests[0].ws);
    host.ws.close();
    assert.equal((await departure).kind, "left");
    const missing = await connect(`?role=guest&room=${room}`);
    assert.equal(missing.data.kind, "error");
  } finally {
    app.close();
  }
});
test("LAN static server serves the build and blocks cross-site WebSocket clients", async () => {
  const app = createLanServer(path.resolve(__dirname, ".."));
  app.server.listen(0, "127.0.0.1");
  await once(app.server, "listening");
  const address = app.server.address();
  assert(address && typeof address !== "string");
  try {
    const res = await fetch(`http://127.0.0.1:${address.port}/`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /party-dialog/);
    const ws = new WebSocket(`ws://127.0.0.1:${address.port}/party?role=host`, {
      origin: "https://unrelated.example",
    });
    const [error] = await once(ws, "error");
    assert.match(String(error), /403/);
  } finally {
    app.close();
  }
});
