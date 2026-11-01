import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

import fs from "node:fs";

const root = path.resolve(__dirname, "..");
const current = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
  .version as string;
const next = current.split(".");
next[2] = String(BigInt(next[2]) + 1n);
const version = next.join(".");
const run = (...args: string[]) =>
  spawnSync(process.execPath, ["--import", "tsx", "scripts/release.ts", ...args], {
    cwd: root,
    encoding: "utf8",
  });

test("release dry-run describes the complete workflow without publishing", () => {
  const result = run(version, "--dry-run");
  assert.equal(result.status, 0, result.stderr);
  for (const text of [
    version,
    "check",
    "dist:desktop",
    "commit",
    "push",
    "draft",
    "SHA256",
    "publish",
  ])
    assert.match(result.stdout, new RegExp(text, "i"));
});

test("release rejects invalid, non-increasing versions and unknown options", () => {
  for (const args of [["v" + version], [current], ["0.0.0"], ["7.01.1"], [version, "--force"]]) {
    const result = run(...args, "--dry-run");
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /version|usage/i);
  }
});
