import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const html = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf8");
const dialog = html.match(/<dialog id="party-dialog"[\s\S]*?<\/dialog>/)?.[0] ?? "";

test("party setup separates connection methods from the persistent lobby", () => {
  assert.match(dialog, /<details class="party-path" open>/);
  assert.match(dialog, /<summary[^>]*>[\s\S]*?LAN \/ SAME WI-FI/);
  assert.match(
    dialog,
    /<details class="party-path" id="party-direct">[\s\S]*?<summary[^>]*>[\s\S]*?DIRECT INVITES/,
  );
  assert.match(dialog, /id="party-host-steps"/);
  assert.match(dialog, /id="party-join-steps" class="party-steps" hidden/);
  assert.match(dialog, /id="party-role-host"[^>]*aria-pressed="true"/);
  assert.match(dialog, /id="party-role-join"[^>]*aria-pressed="false"/);
  assert.match(dialog, /<aside class="party-lobby" aria-labelledby="party-lobby-heading">/);
  assert.match(dialog, /id="party-message" role="status"/);
  assert.match(dialog, /<button id="party-start" class="primary" disabled>/);
  for (const id of [
    "party-close",
    "party-name",
    "party-lan-host",
    "party-room",
    "party-lan-join",
    "party-host",
    "party-invite",
    "party-cancel-invites",
    "party-input",
    "party-answer",
    "party-accept",
    "party-output",
    "party-copy",
    "party-roster",
    "party-leave",
  ])
    assert.equal([...dialog.matchAll(new RegExp(`id="${id}"`, "g"))].length, 1, id);
  for (const id of ["party-name", "party-room", "party-input", "party-output"])
    assert.match(dialog, new RegExp(`<label[^>]*for="${id}"`), id);
});
