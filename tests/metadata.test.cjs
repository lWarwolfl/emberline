const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = (filename) => fs.readFileSync(path.join(root, filename));
const html = read("index.html").toString();

test("page has one title/description, canonical and complete social-card tags", () => {
  assert.equal((html.match(/<title>/g) || []).length, 1);
  assert.equal((html.match(/name="description"/g) || []).length, 1);
  assert(html.includes('rel="canonical" href="https://emberline.sinakheiri.dev/"'));
  for (const property of [
    "og:title",
    "og:description",
    "og:url",
    "og:image",
    "og:image:width",
    "og:image:height",
    "og:image:alt",
  ])
    assert(html.includes(`property="${property}"`), property);
  for (const name of [
    "twitter:card",
    "twitter:title",
    "twitter:description",
    "twitter:image",
    "twitter:image:alt",
  ])
    assert(html.includes(`name="${name}"`), name);
  assert(html.includes("https://emberline.sinakheiri.dev/assets/og-image.png"));
});

test("all icon and preview images have the advertised pixel dimensions", () => {
  const dimensions = [
    ["og-image.png", 1200, 630],
    ["preview-square.png", 1080, 1080],
    ...[16, 32, 48, 180, 192, 512].map((size) => [`icon-${size}.png`, size, size]),
    ["icon-maskable-512.png", 512, 512],
  ];
  for (const [filename, width, height] of dimensions) {
    const bytes = read("assets/" + filename);
    assert.equal(bytes.toString("hex", 0, 8), "89504e470d0a1a0a");
    assert.equal(bytes.readUInt32BE(16), width, filename);
    assert.equal(bytes.readUInt32BE(20), height, filename);
  }
  const ico = read("favicon.ico");
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 3);
  assert(read("assets/favicon.svg").toString().includes('viewBox="0 0 64 64"'));
});

test("manifest contains existing local icons/previews and coherent app settings", () => {
  const manifest = JSON.parse(read("site.webmanifest"));
  assert.equal(manifest.name, "EMBERLINE");
  assert.equal(manifest.display, "standalone");
  for (const item of [...manifest.icons, ...manifest.screenshots])
    assert(fs.existsSync(path.join(root, item.src)), item.src);
  assert(manifest.icons.some((icon) => icon.purpose === "maskable"));
  assert(fs.existsSync(path.resolve(root, manifest.start_url)));
});

test("game structured data and crawl files refer to the supplied public domain", () => {
  const json = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  const data = JSON.parse(json);
  assert.equal(data["@type"], "VideoGame");
  assert.equal(data.url, "https://emberline.sinakheiri.dev/");
  assert.equal(data.isAccessibleForFree, true);
  assert(read("robots.txt").toString().includes("https://emberline.sinakheiri.dev/sitemap.xml"));
  assert(read("sitemap.xml").toString().includes("<loc>https://emberline.sinakheiri.dev/</loc>"));
});
