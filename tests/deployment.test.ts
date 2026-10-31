import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { packageSite, files } from "../scripts/package-site";
import vercel from "../vercel.json";

const root = path.resolve(__dirname, "..");
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "emberline-package-"));
after(() => fs.rmSync(fixture, { recursive: true, force: true }));
for (const file of files) {
  fs.mkdirSync(path.dirname(path.join(fixture, file)), { recursive: true });
  fs.cpSync(path.join(root, file), path.join(fixture, file), { recursive: true });
}

test("Vercel receives every playable asset and no development sources", () => {
  assert.equal(vercel.outputDirectory, "public");
  assert.equal(vercel.buildCommand, "npm run build:site");
  const output = packageSite(fixture);
  const html = fs.readFileSync(path.join(output, "index.html"), "utf8");
  const worker = fs.readFileSync(path.join(output, "sw.js"), "utf8");
  for (const match of html.matchAll(/<script src="([^"]+)"/g)) {
    assert(fs.existsSync(path.join(output, match[1])), match[1]);
  }
  for (const match of worker.matchAll(/"\.\/([^"]*)"/g)) {
    assert(fs.existsSync(path.join(output, match[1])), match[1]);
  }
  for (const name of ["src", "tests", "scripts", "node_modules", "package.json"])
    assert(!fs.existsSync(path.join(output, name)), name);
  assert.deepEqual(
    fs.readFileSync(path.join(output, "dist/game.js")),
    fs.readFileSync(path.join(root, "dist/game.js")),
  );
});

test("packaging removes stale files from previous deployments", () => {
  packageSite(fixture);
  const stale = path.join(fixture, "public", "stale.js");
  fs.writeFileSync(stale, "old build");
  packageSite(fixture);
  assert(!fs.existsSync(stale));
});
