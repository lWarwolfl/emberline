import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const root = path.resolve(__dirname, "..");
process.chdir(root);
const args = process.argv.slice(2);
const version = args[0] ?? "";
const publish = args.includes("--publish");
const manifest = JSON.parse(fs.readFileSync("package.json", "utf8")) as { version: string };
const valid = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const run = (command: string, values: string[], capture = false) =>
  execFileSync(command, values, {
    cwd: root,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    windowsHide: true,
  })?.trim() ?? "";
const npm = (...values: string[]) => {
  if (!process.env.npm_execpath) throw new Error("Run this script through npm run release.");
  run(process.execPath, [process.env.npm_execpath, ...values]);
};
function main() {
  if (
    !valid.test(version) ||
    args.slice(1).some((arg) => !["--dry-run", "--publish"].includes(arg)) ||
    (publish && args.includes("--dry-run"))
  )
    throw new Error("Usage: npm run release -- 7.1.1 [--dry-run | --publish]");
  const next = version.split(".").map(BigInt);
  const current = manifest.version.split(".").map(BigInt);
  const difference = next.findIndex((part, i) => part !== current[i]);
  if (difference < 0 || next[difference] < current[difference])
    throw new Error(`Version must be higher than ${manifest.version}.`);
  const tag = `v${version}-desktop`;
  console.log(
    `Release ${version}: preflight → version bump → check → dist:desktop → commit → push branch/tag → draft → upload → verify SHA256 → publish`,
  );
  if (!publish) {
    console.log("Preview only. Add --publish to execute. Commit your changes first.");
    return;
  }
  if (process.platform !== "win32") throw new Error("Build this Windows installer on Windows.");
  if (run("git", ["status", "--porcelain"], true))
    throw new Error("Working tree is dirty. Review and commit your changes before releasing.");
  const branch = run("git", ["symbolic-ref", "--short", "HEAD"], true);
  if (["main", "master"].includes(branch)) throw new Error("Switch to the desktop branch first.");
  run("gh", ["auth", "status"]);
  const remote = run("git", ["remote", "get-url", "origin"], true);
  const repository = remote.match(
    /^(?:https:\/\/github\.com\/|git@github\.com:)([^/]+\/[^/]+?)(?:\.git)?\/?$/,
  )?.[1];
  if (!repository) throw new Error("origin must be a GitHub repository.");
  if (run("git", ["tag", "--list", tag], true)) throw new Error(`Local tag ${tag} already exists.`);
  if (run("git", ["ls-remote", "origin", `refs/tags/${tag}`], true))
    throw new Error(`Remote tag ${tag} already exists.`);
  const releases = JSON.parse(
    run("gh", ["api", `repos/${repository}/releases?per_page=100`], true),
  ) as { tag_name: string }[];
  if (releases.some((release) => release.tag_name === tag))
    throw new Error(`Release ${tag} already exists.`);
  npm("version", version, "--no-git-tag-version");
  const worker = "src/service-worker.ts";
  fs.writeFileSync(
    worker,
    fs
      .readFileSync(worker, "utf8")
      .replace(/const CACHE = "[^"]+";/, `const CACHE = "emberline-v${version}";`),
  );
  npm("run", "check");
  npm("run", "dist:desktop");
  const installer = path.join("release", `EMBERLINE-Setup-${version}.exe`);
  const data = fs.readFileSync(installer);
  if (data.subarray(0, 2).toString() !== "MZ")
    throw new Error("Installer is not a Windows executable.");
  const digest = "sha256:" + createHash("sha256").update(data).digest("hex");
  const files = ["package.json", "package-lock.json", worker, "dist/game.js", "sw.js"];
  run("git", ["add", "--", ...files]);
  run("git", ["diff", "--cached", "--check"]);
  run("git", ["commit", "-m", `chore: release desktop ${version}`]);
  if (run("git", ["status", "--porcelain"], true))
    throw new Error("Unexpected changes after build/commit; release stopped.");
  const sha = run("git", ["rev-parse", "HEAD"], true);
  run("git", ["tag", "-a", tag, "-m", `EMBERLINE desktop ${version}`]);
  run("git", ["push", "--atomic", "origin", `HEAD:refs/heads/${branch}`, `refs/tags/${tag}`]);
  const publishedSha = run("git", ["ls-remote", "origin", `refs/heads/${branch}`], true).split(
    /\s/,
  )[0];
  if (publishedSha !== sha) throw new Error("Remote branch does not match the built commit.");
  run("gh", [
    "release",
    "create",
    tag,
    installer,
    "--repo",
    repository,
    "--verify-tag",
    "--draft",
    "--title",
    `EMBERLINE ${version} — Windows Desktop`,
    "--generate-notes",
    "--notes",
    `Unsigned Windows x64 installer. No automatic updater.\n\nSHA256: ${digest.slice(7)}`,
  ]);
  const release = JSON.parse(
    run("gh", ["api", `repos/${repository}/releases/tags/${tag}`], true),
  ) as { id: number; assets: { name: string; size: number; digest: string; state: string }[] };
  const asset = release.assets.find((item) => item.name === path.basename(installer));
  if (!asset || asset.size !== data.length || asset.digest !== digest || asset.state !== "uploaded")
    throw new Error("Uploaded installer verification failed. Release remains a draft.");
  run("gh", ["release", "edit", tag, "--repo", repository, "--draft=false", "--latest"]);
  const result = JSON.parse(
    run("gh", ["api", `repos/${repository}/releases/${release.id}`], true),
  ) as { draft: boolean; html_url: string };
  if (result.draft) throw new Error("Release is still a draft.");
  console.log(`Published: ${result.html_url}`);
}
try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
