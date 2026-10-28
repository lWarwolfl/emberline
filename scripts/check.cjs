const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
for (const filename of [
  ...fs.readdirSync(path.join(root, "src")).map((name) => path.join(root, "src", name)),
  path.join(root, "sw.js"),
]) {
  if (!filename.endsWith(".js")) continue;
  execFileSync(process.execPath, ["--check", filename], {
    stdio: "inherit",
  });
}
console.log("All source files passed syntax checks.");
