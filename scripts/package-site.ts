import fs from "node:fs";
import path from "node:path";

/** Stage only playable static files; development code never enters the deployment. */
export const files = [
  "index.html",
  "style.css",
  "sw.js",
  "dist/game.js",
  "assets",
  "favicon.ico",
  "site.webmanifest",
  "robots.txt",
  "sitemap.xml",
] as const;
export function packageSite(root = path.resolve(__dirname, "..")) {
  const output = path.join(root, "public");
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output, { recursive: true });
  for (const file of files) {
    const destination = path.join(output, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.cpSync(path.join(root, file), destination, { recursive: true });
  }
  return output;
}
if (require.main === module) console.log(`Packaged static site at ${packageSite()}`);
