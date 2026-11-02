import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const html = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf8");
const css = fs.readFileSync(path.resolve(__dirname, "../style.css"), "utf8");

test("gameplay player HUD stays compact while lobby retains detailed stats", () => {
  assert.match(css, /#party-hud\s*\{[^}]*padding:\s*4px;[^}]*gap:\s*4px;/);
  assert.match(
    css,
    /#party-hud \.party-member\s*\{[^}]*display:\s*flex;[^}]*padding:\s*2px 6px;[^}]*white-space:\s*nowrap;/,
  );
  assert.match(css, /#party-hud \.party-member span\s*\{[^}]*display:\s*inline;/);
  assert.match(css, /#party-hud \.party-member small\s*\{\s*display:\s*none;/);
  assert.match(
    css,
    /#party-hud \.party-member span\s*\{[^}]*white-space:\s*nowrap;[^}]*text-overflow:\s*ellipsis;[^}]*line-height:\s*14px;/,
  );
  assert.doesNotMatch(css, /#party-roster[^{}]*small\s*\{\s*display:\s*none/);
});

test("playfield has its own remaining-height container and accessible beacon trail", () => {
  assert.match(html, /<div class="playfield">\s*<section\s+id="stage"/);
  assert.match(html, /<progress id="beacon-progress" max="1" value="0"/);
  assert.match(html, /id="beacon-distance"/);
  assert.match(css, /\.playfield\s*\{[^}]*min-height:\s*0;[^}]*container-type:\s*size;/);
  assert.match(css, /width:\s*min\(100cqw, 200cqh\)/);
  assert.match(css, /#shell,\s*#shell:fullscreen\s*\{[^}]*height:\s*100dvh;/);
});
