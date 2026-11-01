import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const html = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf8");
const css = fs.readFileSync(path.resolve(__dirname, "../style.css"), "utf8");

test("playfield has its own remaining-height container and accessible beacon trail", () => {
  assert.match(html, /<div class="playfield">\s*<section\s+id="stage"/);
  assert.match(html, /<progress id="beacon-progress" max="1" value="0"/);
  assert.match(html, /id="beacon-distance"/);
  assert.match(css, /\.playfield\s*\{[^}]*min-height:\s*0;[^}]*container-type:\s*size;/);
  assert.match(css, /width:\s*min\(100cqw, 200cqh\)/);
  assert.match(css, /#shell,\s*#shell:fullscreen\s*\{[^}]*height:\s*100dvh;/);
});
