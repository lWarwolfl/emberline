/* Reuses the actual pixel renderer. Requires optional Playwright, no game dependency. */
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

// Designed poster art, drawn from the brand palette. No game renderer involved.
function previewArt(square) {
  const biomes = [
    ["#192b27", "#c0a96e"],
    ["#302323", "#ffb461"],
    ["#122d2c", "#c6d688"],
    ["#1e2d3c", "#d0e6d7"],
    ["#352d36", "#f4cf8a"],
  ];
  const swatches = biomes
    .map(([sky, light]) => `<i style="--sky:${sky};--light:${light}"></i>`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    :root{--bg:#0b0f0e;--parch:#ece6d6;--ember:#ffae62;--mint:#b6dbc3;--sage:#a4afa4;
      --pad:72px;--word:150px;--sigil:320px;--display:Impact,"Haettenschweiler","Arial Black",sans-serif;
      --mono:Consolas,"Cascadia Mono",monospace;--body:"Segoe UI",Arial,sans-serif}
    body.square{--pad:80px;--word:220px;--sigil:300px}
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:100%;height:100%;overflow:hidden}
    body{background:var(--bg);color:var(--parch);font-family:var(--body);
      display:flex;flex-direction:column;padding:var(--pad);position:relative}
    body::before{content:"";position:absolute;inset:0;
      background:radial-gradient(58% 62% at 82% 74%,rgba(255,174,98,.2),transparent 68%),
        radial-gradient(42% 40% at 8% 6%,rgba(182,219,195,.09),transparent 70%),
        repeating-linear-gradient(90deg,rgba(236,230,214,.045) 0 1px,transparent 1px 40px),
        repeating-linear-gradient(0deg,rgba(236,230,214,.045) 0 1px,transparent 1px 40px);
      mask-image:radial-gradient(120% 100% at 50% 50%,#000 45%,transparent 100%)}
    body::after{content:"";position:absolute;inset:0;
      background:linear-gradient(105deg,transparent 55%,rgba(255,174,98,.05) 55.2%,transparent 55.6%),
        linear-gradient(105deg,transparent 63%,rgba(255,174,98,.04) 63.2%,transparent 63.6%),
        radial-gradient(120% 90% at 50% 50%,transparent 55%,rgba(0,0,0,.55))}
    .frame{position:absolute;inset:26px;border:1px solid rgba(236,230,214,.16);pointer-events:none}
    .frame::before,.frame::after{content:"";position:absolute;background:var(--ember)}
    .frame::before{left:-1px;top:-1px;width:70px;height:2px}
    .frame::after{right:-1px;bottom:-1px;width:2px;height:70px}
    header,main,footer{position:relative;z-index:2}
    header{display:flex;justify-content:space-between;align-items:center}
    .brand{display:flex;align-items:center;gap:14px}
    .mark{width:36px;height:36px;background:var(--ember);color:#101514;font:700 25px/36px var(--mono);
      text-align:center;letter-spacing:0}
    .brand b{font:400 15px var(--mono);letter-spacing:.4em;color:var(--parch)}
    .meta{font:400 11px var(--mono);letter-spacing:.22em;color:var(--sage);text-transform:uppercase}
    .meta b{color:var(--ember);font-weight:400;margin-left:14px}
    main{flex:1;display:flex;flex-direction:column;justify-content:center}
    .kicker{font:400 12px var(--mono);letter-spacing:.34em;color:var(--mint);text-transform:uppercase;
      margin-bottom:22px}
    h1{font:400 var(--word)/.82 var(--display);letter-spacing:.005em;text-transform:uppercase;
      color:var(--parch)}
    h1 span{display:block;background:linear-gradient(96deg,#ffd9a8,#ffae62 52%,#ff8a3d);
      -webkit-background-clip:text;background-clip:text;color:transparent}
    .tag{margin-top:16px;font:400 15px var(--mono);letter-spacing:.24em;color:var(--sage);
      text-transform:uppercase}
    .swatches{display:flex;align-items:center;gap:10px;margin-top:16px}
    .swatches i{width:19px;height:19px;border:1px solid rgba(236,230,214,.22);
      background:linear-gradient(180deg,var(--light) 0 4px,var(--sky) 4px)}
    .swatches span{font:400 10px var(--mono);letter-spacing:.24em;color:var(--sage);
      text-transform:uppercase;margin-left:8px}
    .filament{position:relative;height:36px;margin-top:10px;display:flex;align-items:flex-end}
    .filament::before{content:"";position:absolute;left:0;right:0;bottom:10px;height:3px;
      background:linear-gradient(90deg,transparent,#ff8a3d 12%,#ffae62 34%,#ffe3b8 52%,
        #ffae62 68%,#ff8a3d 84%,transparent)}
    .filament::after{content:"";position:absolute;left:0;right:0;bottom:4px;height:22px;
      background:radial-gradient(50% 100% at 52% 100%,rgba(255,174,98,.35),transparent 72%)}
    .spark{position:absolute;background:var(--ember)}
    .s1{left:18%;bottom:13px;width:5px;height:5px}
    .s2{left:22%;bottom:19px;width:3px;height:3px}
    .s3{left:56%;bottom:13px;width:7px;height:7px;background:#ffe3b8}
    .s4{left:60%;bottom:24px;width:3px;height:3px}
    .s5{left:83%;bottom:13px;width:4px;height:4px}
    .runner{position:relative;z-index:1;margin-left:38%;margin-bottom:10px;width:34px;height:34px;
      filter:drop-shadow(0 0 10px rgba(255,174,98,.55))}
    footer{display:flex;justify-content:space-between;align-items:center;gap:20px}
    .chips{display:flex;gap:10px}
    .chips b{font:400 10px var(--mono);letter-spacing:.16em;color:#cfd8c6;text-transform:uppercase;
      border:1px solid rgba(236,230,214,.24);padding:9px 13px;white-space:nowrap}
    .url{font:400 11px var(--mono);letter-spacing:.12em;color:var(--sage);white-space:nowrap;
      display:flex;align-items:center;gap:9px}
    .url::before{content:"";width:6px;height:6px;background:var(--ember)}
    .sigil{position:absolute;z-index:1;right:56px;top:118px;width:var(--sigil);height:var(--sigil);
      opacity:.9;filter:drop-shadow(0 0 40px rgba(255,174,98,.22))}
    .square .sigil{top:auto;bottom:230px;right:56px}
    .wide .kicker{display:none}
    .square .runner{margin-left:62%}
    .stats{display:none}
    .square .stats{display:flex;gap:52px;margin-top:30px}
    .stats div{display:flex;flex-direction:column;gap:6px}
    .stats b{font:400 44px/.9 var(--display);color:var(--parch);letter-spacing:.02em}
    .stats b em{color:var(--ember);font-style:normal}
    .stats span{font:400 10px var(--mono);letter-spacing:.24em;color:var(--sage);text-transform:uppercase}
  </style></head><body class="${square ? "square" : "wide"}">
    <div class="frame"></div>
    <header>
      <div class="brand"><span class="mark">E</span><b>EMBERLINE</b></div>
      <div class="meta">Endless pixel arcade<b>v5.3</b></div>
    </header>
    <main>
      <p class="kicker">An offline pixel runner</p>
      <h1>Ember<span>Line</span></h1>
      <p class="tag">Run &middot; Jump &middot; Fight &middot; Upgrade</p>
      <div class="swatches">${swatches}<span>Five changing biomes</span></div>
      <div class="stats">
        <div><b>05</b><span>Biomes</span></div>
        <div><b><em>&infin;</em></b><span>Procedural runs</span></div>
        <div><b>0</b><span>Network needed</span></div>
      </div>
      <div class="filament">
        <span class="spark s1"></span><span class="spark s2"></span><span class="spark s3"></span>
        <span class="spark s4"></span><span class="spark s5"></span>
        <svg class="runner" viewBox="0 0 16 16" aria-hidden="true">
          <g fill="#ffae62">
            <rect x="7" y="1" width="3" height="3"/><rect x="6" y="4" width="4" height="5"/>
            <rect x="4" y="5" width="2" height="2"/><rect x="3" y="6" width="2" height="2"/>
            <rect x="10" y="4" width="3" height="2"/>
            <rect x="5" y="9" width="2" height="4"/><rect x="3" y="12" width="3" height="2"/>
            <rect x="9" y="9" width="3" height="3"/><rect x="11" y="11" width="3" height="2"/>
          </g>
        </svg>
      </div>
    </main>
    <footer>
      <div class="chips"><b>5 biomes</b><b>Procedural runs</b><b>Plays offline</b><b>PWA ready</b></div>
      <div class="url">emberline.sinakheiri.dev</div>
    </footer>
    <svg class="sigil" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M17 14h28v8H26v7h15v7H26v7h19v8H17z" fill="#ffae62" opacity=".07"/>
      <path d="M17 14h28v8H26v7h15v7H26v7h19v8H17z" fill="none" stroke="#ffae62" stroke-width="1.1"/>
      <path d="M47 5h5v5h5v5h-5v5h-5v-5h-5v-5h5z" fill="#ffe3b8" opacity=".85"/>
    </svg>
  </body></html>`;
}

async function main() {
  const root = path.resolve(__dirname, "..");
  const output = path.join(root, "assets");
  fs.mkdirSync(output, { recursive: true });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#101514"/><path fill="#ffae62" d="M17 14h28v8H26v7h15v7H26v7h19v8H17z"/><path fill="#ffe0a3" d="M47 5h5v5h5v5h-5v5h-5v-5h-5v-5h5z"/></svg>`;
  fs.writeFileSync(path.join(output, "favicon.svg"), svg);
  const browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || "msedge",
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(path.join(root, "index.html")).href);
    for (const size of [16, 32, 48, 180, 192, 512]) {
      const encoded = await page.evaluate(
        async ({ svg, size }) => {
          const img = new Image();
          img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
          await img.decode();
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = size;
          const ctx = canvas.getContext("2d");
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, 0, 0, size, size);
          return canvas.toDataURL("image/png").split(",")[1];
        },
        { svg, size },
      );
      fs.writeFileSync(path.join(output, `icon-${size}.png`), Buffer.from(encoded, "base64"));
    }
    // A real multi-size ICO containing PNG-compressed image entries.
    const images = [16, 32, 48].map((size) =>
      fs.readFileSync(path.join(output, `icon-${size}.png`)),
    );
    const header = Buffer.alloc(6);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(3, 4);
    let offset = 6 + images.length * 16;
    const entries = images.map((bytes, index) => {
      const entry = Buffer.alloc(16);
      entry[0] = entry[1] = [16, 32, 48][index];
      entry.writeUInt16LE(1, 4);
      entry.writeUInt16LE(32, 6);
      entry.writeUInt32LE(bytes.length, 8);
      entry.writeUInt32LE(offset, 12);
      offset += bytes.length;
      return entry;
    });
    fs.writeFileSync(
      path.join(root, "favicon.ico"),
      Buffer.concat([header, ...entries, ...images]),
    );
    const maskable = await page.evaluate(async (svg) => {
      const img = new Image();
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 512;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#101514";
      ctx.fillRect(0, 0, 512, 512);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 77, 77, 358, 358);
      return canvas.toDataURL("image/png").split(",")[1];
    }, svg);
    fs.writeFileSync(path.join(output, "icon-maskable-512.png"), Buffer.from(maskable, "base64"));

    for (const [filename, width, height] of [
      ["og-image.png", 1200, 630],
      ["preview-square.png", 1080, 1080],
    ]) {
      await page.setViewportSize({ width, height });
      await page.setContent(previewArt(width === height), { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(output, filename) });
    }
    console.log(
      "Generated local SVG/PNG/ICO icons, 1200×630 social image and 1080×1080 square preview.",
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
