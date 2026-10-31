const prettier = require("prettier");
async function main() {
  /* Edit site.config.json, then run npm run metadata. No network calls. */
  const fs = require("node:fs");
  const path = require("node:path");
  const root = path.resolve(__dirname, "..");
  const config = JSON.parse(fs.readFileSync(path.join(root, "site.config.json"), "utf8"));
  const url = new URL(config.url);
  if (!/^https?:$/.test(url.protocol)) throw new Error("Public URL must use HTTP or HTTPS");
  const image = new URL(config.socialImage, url).href;
  const escape = (value) =>
    String(value).replace(
      /[&"<>]/g,
      (char) => ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" })[char],
    );
  const meta = (key, value, property = false) =>
    `    <meta ${property ? "property" : "name"}="${key}" content="${escape(value)}" />`;
  const json = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "VideoGame",
      name: config.name,
      description: config.description,
      url: url.href,
      image,
      genre: ["Arcade", "Endless runner"],
      gamePlatform: "Web browser",
      operatingSystem: "Any",
      playMode: "https://schema.org/SinglePlayer",
      inLanguage: "en",
      isAccessibleForFree: true,
    },
    null,
    2,
  ).replace(/</g, "\\u003c");
  const metadata = [
    "    <!-- Site metadata: generated from site.config.json -->",
    `    <title>${escape(config.title)}</title>`,
    meta("description", config.description),
    meta("application-name", config.name),
    meta("theme-color", config.themeColor),
    meta("color-scheme", "dark"),
    meta("robots", "index, follow, max-image-preview:large"),
    meta("referrer", "strict-origin-when-cross-origin"),
    meta("format-detection", "telephone=no"),
    `    <link rel="canonical" href="${escape(url.href)}" />`,
    meta("og:type", "website", true),
    meta("og:site_name", config.name, true),
    meta("og:locale", "en_US", true),
    meta("og:title", config.title, true),
    meta("og:description", config.description, true),
    meta("og:url", url.href, true),
    meta("og:image", image, true),
    meta("og:image:secure_url", image, true),
    meta("og:image:type", "image/png", true),
    meta("og:image:width", "1200", true),
    meta("og:image:height", "630", true),
    meta("og:image:alt", config.socialImageAlt, true),
    meta("twitter:card", "summary_large_image"),
    meta("twitter:title", config.title),
    meta("twitter:description", config.description),
    meta("twitter:image", image),
    meta("twitter:image:alt", config.socialImageAlt),
    `    <link rel="icon" href="favicon.ico" sizes="16x16 32x32 48x48" />`,
    `    <link rel="icon" type="image/svg+xml" href="assets/favicon.svg" />`,
    `    <link rel="icon" type="image/png" sizes="32x32" href="assets/icon-32.png" />`,
    `    <link rel="apple-touch-icon" sizes="180x180" href="assets/icon-180.png" />`,
    meta("apple-mobile-web-app-title", config.name),
    meta("apple-mobile-web-app-capable", "yes"),
    meta("mobile-web-app-capable", "yes"),
    meta("apple-mobile-web-app-status-bar-style", "black-translucent"),
    `    <link rel="manifest" href="site.webmanifest" />`,
    `    <script type="application/ld+json">\n${json}\n    </script>`,
    "    <!-- End site metadata -->",
  ].join("\n");
  const filename = path.join(root, "index.html");
  let html = fs.readFileSync(filename, "utf8");
  if (/<!-- Site metadata:/.test(html))
    html = html.replace(/^[ \t]*<!-- Site metadata:[\s\S]*?<!-- End site metadata -->/m, metadata);
  else
    html = html.replace(
      /^[ \t]*<meta name="theme-color"[^>]*\/>\s*<title>[\s\S]*?<\/title>/m,
      metadata,
    );
  fs.writeFileSync(
    filename,
    await prettier.format(html, {
      ...(await prettier.resolveConfig(filename)),
      filepath: filename,
    }),
  );
  fs.writeFileSync(
    path.join(root, "site.webmanifest"),
    JSON.stringify(
      {
        id: "./",
        name: config.name,
        short_name: config.name,
        description: config.description,
        lang: "en",
        start_url: "./index.html",
        scope: "./",
        display: "standalone",
        background_color: config.themeColor,
        theme_color: config.themeColor,
        categories: ["games", "entertainment"],
        icons: [
          { src: "assets/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "assets/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "assets/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        screenshots: [
          {
            src: "assets/og-image.png",
            sizes: "1200x630",
            type: "image/png",
            form_factor: "wide",
            label: "EMBERLINE — Keep the signal alive",
          },
          {
            src: "assets/preview-square.png",
            sizes: "1080x1080",
            type: "image/png",
            label: "EMBERLINE pixel arcade preview",
          },
        ],
      },
      null,
      2,
    ) + "\n",
  );
  const manifestPath = path.join(root, "site.webmanifest");
  fs.writeFileSync(
    manifestPath,
    await prettier.format(fs.readFileSync(manifestPath, "utf8"), {
      ...(await prettier.resolveConfig(manifestPath)),
      filepath: manifestPath,
    }),
  );
  console.log(
    "Updated title, description, social cards, canonical URL, icons, game schema and manifest for " +
      url.href,
  );
  fs.writeFileSync(
    path.join(root, "robots.txt"),
    "User-agent: *\nAllow: /\nSitemap: " + new URL("sitemap.xml", url).href + "\n",
  );
  fs.writeFileSync(
    path.join(root, "sitemap.xml"),
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>' +
      escape(url.href) +
      "</loc></url></urlset>\n",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
