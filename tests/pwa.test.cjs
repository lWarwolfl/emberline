const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const assets = [...sw.matchAll(/"\.\/([^"]*)"/g)].map((match) => match[1]).filter(Boolean);

test("service worker precaches every script the page loads", () => {
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((match) => match[1]);
  assert(scripts.includes("dist/game.js"));
  for (const script of scripts) assert(assets.includes(script), script);
});

test("precache list is complete and every listed file exists", () => {
  for (const file of ["index.html", "style.css", "site.webmanifest", "dist/game.js"])
    assert(assets.includes(file), file);
  for (const file of assets) assert(fs.existsSync(path.join(root, file)), file);
  assert(!assets.includes("sw.js"));
});

test("registration is skipped on file:// and the cache is versioned", () => {
  const registration = fs.readFileSync(path.join(root, "dist/game.js"), "utf8");
  assert(registration.includes("https?:"));
  assert(registration.includes("./sw.js"));
  assert(/emberline-v\d/.test(sw));
  assert(sw.includes('request.mode === "navigate"'));
});
