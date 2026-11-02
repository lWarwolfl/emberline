import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { packageSite, files } from "../scripts/package-site";
import vercel from "../vercel.json";
import ts from "typescript";
import { spawnSync } from "node:child_process";

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

test("Vercel can emit and initialize accounts without requiring Better Auth ESM", (t) => {
  const entry = path.join(root, "api/account/[...action].ts");
  const configPath = ts.findConfigFile(path.dirname(entry), ts.sys.fileExists);
  assert(configPath);
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  assert.equal(config.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
  const program = ts.createProgram([...new Set([...parsed.fileNames, entry])], {
    ...parsed.options,
    noEmit: false,
    sourceMap: true,
  });
  const outputs = new Map<string, string>();
  const result = program.emit(undefined, (file, content) => outputs.set(file, content));
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(
    result.emitSkipped,
    false,
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCurrentDirectory: () => root,
      getCanonicalFileName: (file) => file,
      getNewLine: () => "\n",
    }),
  );
  assert(
    [...outputs].some(
      ([file, content]) =>
        file.endsWith("[...action].js") && content.includes("handleAccountRequest"),
    ),
  );
  const serverOutput = [...outputs].find(([file]) => file.endsWith("server/accounts.js"))?.[1];
  assert(serverOutput);
  assert.match(serverOutput, /import\("better-auth"\)/);
  assert.doesNotMatch(serverOutput, /require\("better-auth(?:\/plugins|\/crypto)?"\)/);
  const buildRoot = path.join(root, ".build");
  fs.mkdirSync(buildRoot, { recursive: true });
  const runtime = fs.mkdtempSync(path.join(buildRoot, "account-runtime-"));
  t.after(() => {
    assert(path.resolve(runtime).startsWith(path.resolve(buildRoot) + path.sep));
    fs.rmSync(runtime, { recursive: true, force: true });
  });
  for (const [file, content] of outputs) {
    const relative = path.relative(parsed.options.outDir!, file);
    const target = path.resolve(runtime, relative);
    assert(target.startsWith(runtime + path.sep));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  const child = spawnSync(
    process.execPath,
    [
      "-e",
      `
    const Module = require('node:module');
    const load = Module._load;
    Module._load = function(id, ...args) {
      if (/^better-auth(?:\\/|$)/.test(id)) throw new Error('ERR_REQUIRE_ESM: use native import');
      return load.call(this, id, ...args);
    };
    const { createAccountService } = require('./server/accounts.js');
    createAccountService('postgresql://test:test@localhost/unused', 'test-secret-for-module-loading-only-123456', 'http://localhost:4173')
      .then(service => service.close()).then(() => console.log('account startup passed'))
      .catch(error => { console.error(error); process.exitCode = 1; });
  `,
    ],
    { cwd: runtime, encoding: "utf8", timeout: 20000 },
  );
  assert.equal(child.status, 0, child.stderr);
  assert(child.stdout.includes("account startup passed"));
});
