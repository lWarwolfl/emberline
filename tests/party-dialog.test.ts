import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const html = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf8");
const dialog = html.match(/<dialog id="party-dialog"[\s\S]*?<\/dialog>/)?.[0] ?? "";

test("party setup is one shared link plus the lobby", () => {
  assert.doesNotMatch(dialog, /DIRECT INVITES/);
  assert.match(dialog, /HOST A ROOM/);
  assert.match(dialog, /JOIN LINK OR ROOM CODE/);
  assert.match(dialog, /<aside class="party-lobby" aria-labelledby="party-lobby-heading">/);
  assert.match(dialog, /id="party-message" role="status"/);
  assert.match(dialog, /<button id="party-start" class="primary" disabled>/);
  for (const id of [
    "party-close",
    "party-name",
    "party-lan-host",
    "party-lan-share",
    "party-lan-link",
    "party-lan-qr",
    "party-copy-link",
    "party-room",
    "party-lan-join",
    "party-scan",
    "party-roster",
    "party-leave",
  ])
    assert.equal([...dialog.matchAll(new RegExp(`id="${id}"`, "g"))].length, 1, id);
  for (const id of ["party-name", "party-room"])
    assert.match(dialog, new RegExp(`<label[^>]*for="${id}"`), id);
});
