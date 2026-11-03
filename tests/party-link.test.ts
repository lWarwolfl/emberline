import test from "node:test";
import assert from "node:assert/strict";
import { joinAddresses, joinUrl, parseJoin } from "../src/party-link";

test("join links prefer a reachable LAN address and keep the room", () => {
  const addresses = joinAddresses("http://localhost:4173/party", [
    "http://127.0.0.1:4173/",
    "http://192.168.1.20:4173/index.html",
    "http://10.0.0.8:4173/",
    "http://192.168.1.20:4173/other",
  ]);
  assert.deepEqual(addresses, ["http://192.168.1.20:4173/", "http://10.0.0.8:4173/"]);
  assert.equal(joinUrl(addresses[0], "ab12ef"), "http://192.168.1.20:4173/?room=AB12EF");
  assert.deepEqual(parseJoin(`join here ${joinUrl(addresses[1], "ab12ef")} thanks`), {
    address: "http://10.0.0.8:4173/",
    room: "AB12EF",
  });
});

test("an opened LAN page stays the join address", () => {
  assert.deepEqual(joinAddresses("http://192.168.1.20:4173/?dev=1", ["http://172.16.0.4:4173/"]), [
    "http://192.168.1.20:4173/",
    "http://172.16.0.4:4173/",
  ]);
});

test("join links reject unsafe addresses and incomplete rooms", () => {
  assert.equal(parseJoin("http://192.168.1.20:4173/"), null);
  assert.equal(parseJoin("http://user:secret@192.168.1.20:4173/?room=ABC123"), null);
  assert.throws(() => joinUrl("ftp://192.168.1.20/", "ABC123"), /without login details/);
  assert.throws(() => joinUrl("http://192.168.1.20/", "ROOM"), /six-character/);
  assert.deepEqual(joinAddresses("http://127.0.0.1:4173/", []), ["http://127.0.0.1:4173/"]);
});
