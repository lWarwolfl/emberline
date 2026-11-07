import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createServer } from "node:http";
import { once } from "node:events";
import { partyIce, handlePartyIceRequest } from "../server/party-ice";
import { roomIce } from "../src/party-ice";

test("TURN credentials expire, use coturn REST signing and never return the shared secret", () => {
  const secret = "test-only-secret";
  const env = {
    TURN_URLS: "turn:relay.example:3478?transport=udp,turns:relay.example:443?transport=tcp",
    TURN_SHARED_SECRET: secret,
  };
  const config = partyIce(env, 1000000);
  assert.equal(config.relayConfigured, true);
  const turn = config.iceServers[1];
  assert(turn && "username" in turn);
  assert.match(turn.username, /^1600:emberline-/);
  assert.equal(turn.credential, createHmac("sha1", secret).update(turn.username).digest("base64"));
  assert(!JSON.stringify(config).includes(secret));
  assert.notDeepEqual(config, partyIce(env, 1000000));
  assert.equal(partyIce({}).relayConfigured, false);
  assert.throws(() => partyIce({ TURN_URLS: "turn:relay.example:3478" }), /TURN_SHARED_SECRET/);
  assert.throws(() => partyIce({ ...env, TURN_URLS: "https://relay.example" }), /TURN_URLS/);
});

test("ICE endpoint never caches credentials and only accepts GET", async () => {
  const server = createServer(handlePartyIceRequest).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/party/ice`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert(Array.isArray((await response.json()).iceServers));
    const rejected = await fetch(`http://127.0.0.1:${address.port}/api/party/ice`, {
      method: "POST",
    });
    assert.equal(rejected.status, 405);
  } finally {
    server.closeAllConnections();
    server.close();
  }
});

test("client requests fresh configuration and validates relay credentials", async (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "location");
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: new URL("https://game.example"),
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "location", original);
    else Reflect.deleteProperty(globalThis, "location");
  });
  const config = partyIce({
    TURN_URLS: "turn:relay.example:3478",
    TURN_SHARED_SECRET: "test-secret",
  });
  const result = await roomIce(async (url, options) => {
    assert.equal(url, "/api/party/ice");
    assert.equal(options?.cache, "no-store");
    return Response.json(config);
  });
  assert.equal(result.iceServers?.length, 2);
  assert.equal(
    (await roomIce(async () => new Response(null, { status: 404 }))).iceServers?.length,
    2,
  );
  await assert.rejects(
    () => roomIce(async () => new Response(null, { status: 503 })),
    /unavailable/,
  );
  await assert.rejects(
    () => roomIce(async () => Response.json({ iceServers: [{ urls: "turn:relay.example" }] })),
    /credentials/,
  );
  await assert.rejects(
    () => roomIce(async () => Response.json({ iceServers: [{ urls: "https://bad.example" }] })),
    /address/,
  );
});
