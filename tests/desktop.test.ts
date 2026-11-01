import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { WebSocket } from "ws";
import { createLanServer } from "../scripts/lan-server";
import { buildSync } from "esbuild";
import { createRequire } from "node:module";
import vm from "node:vm";
import path from "node:path";
import type { Session, WebContents } from "electron";

type PermissionRequestHandler = NonNullable<Parameters<Session["setPermissionRequestHandler"]>[0]>;
type PermissionCheckHandler = NonNullable<Parameters<Session["setPermissionCheckHandler"]>[0]>;

async function withDesktop(
  exercise: (desktop: {
    url: string;
    options: Record<string, unknown>;
    contents: WebContents;
    request: PermissionRequestHandler;
    check: PermissionCheckHandler;
    maximized: boolean;
    navigate: (url: string) => void;
  }) => Promise<void>,
  workAreaSize = { width: 1920, height: 1040 },
) {
  const root = path.resolve(__dirname, "..");
  const code = buildSync({
    entryPoints: [path.join(root, "desktop/main.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    external: ["electron"],
    write: false,
  }).outputFiles[0].text;
  const events = new Map<string, () => void>();
  let resolve!: (url: string) => void;
  let reject!: (error: Error) => void;
  const ready = {
    promise: new Promise<string>((yes, no) => {
      resolve = yes;
      reject = no;
    }),
    resolve: (url: string) => resolve(url),
    reject: (error: Error) => reject(error),
  };
  let options: Record<string, unknown> = {};
  let request!: PermissionRequestHandler;
  let check!: PermissionCheckHandler;
  let currentUrl = "";
  let maximized = false;
  const contents = {
    setWindowOpenHandler() {},
    on() {},
    getURL: () => currentUrl,
    isDestroyed: () => false,
  } as unknown as WebContents;
  class Window {
    webContents = contents;
    constructor(value: Record<string, unknown>) {
      options = value;
    }
    removeMenu() {}
    maximize() {
      maximized = true;
    }
    async loadURL(url: string) {
      currentUrl = url;
      ready.resolve(url);
    }
  }
  const electron = {
    app: {
      requestSingleInstanceLock: () => true,
      setAppUserModelId() {},
      on: (event: string, callback: () => void) => events.set(event, callback),
      whenReady: () => Promise.resolve(),
      getAppPath: () => root,
      quit: () => events.get("before-quit")?.(),
    },
    BrowserWindow: Window,
    screen: {
      getCursorScreenPoint: () => ({ x: 2000, y: 100 }),
      getDisplayNearestPoint: (point: { x: number; y: number }) => {
        assert.deepEqual(point, { x: 2000, y: 100 });
        return { workAreaSize, workArea: { x: 1920, y: 0, ...workAreaSize } };
      },
    },
    dialog: { showErrorBox: (_title: string, message: string) => ready.reject(new Error(message)) },
    session: {
      defaultSession: {
        setPermissionRequestHandler: (handler: PermissionRequestHandler) => (request = handler),
        setPermissionCheckHandler: (handler: PermissionCheckHandler) => (check = handler),
        webRequest: { onHeadersReceived() {} },
      },
    },
  };
  const require = createRequire(path.join(root, "package.json"));
  const timer = setTimeout(() => ready.reject(new Error("Desktop startup timed out")), 5000);
  try {
    vm.runInNewContext(code, {
      require: (id: string) => (id === "electron" ? electron : require(id)),
      module: { exports: {} },
      __dirname: path.join(root, ".build"),
      process: { ...process, versions: { ...process.versions, electron: "test" } },
      Buffer,
      URL,
      console,
      setTimeout,
      clearTimeout,
    });
    const url = await ready.promise;
    await exercise({
      url,
      options,
      contents,
      request,
      check,
      maximized,
      navigate: (url) => (currentUrl = url),
    });
  } finally {
    clearTimeout(timer);
    events.get("before-quit")?.();
  }
}

test("desktop bundle starts its relay before loading the isolated game", async () => {
  await withDesktop(async ({ url, options }) => {
    assert.equal(url, "http://127.0.0.1:4174/?desktop=1");
    assert.deepEqual(JSON.parse(JSON.stringify(options.webPreferences)), {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: false,
    });
    const response = await fetch(new URL("/desktop-info", url));
    assert.equal((await response.json()).desktop, true);
  });
});

test("desktop allows native fullscreen only for its trusted main renderer", async () => {
  await withDesktop(async ({ url, contents, request, check, navigate }) => {
    const origin = new URL(url).origin;
    const details = { requestingUrl: url, isMainFrame: true };
    const allowed = (
      sender: WebContents | null,
      permission: Parameters<PermissionRequestHandler>[1],
      requestingUrl = url,
      isMainFrame = true,
    ) => {
      let granted: boolean | undefined;
      request(sender as WebContents, permission, (value) => (granted = value), {
        requestingUrl,
        isMainFrame,
      });
      return granted;
    };
    assert.equal(allowed(contents, "fullscreen"), true);
    assert.equal(check(contents, "fullscreen", origin, details), true);
    for (const permission of [
      "media",
      "notifications",
      "pointerLock",
      "automatic-fullscreen",
    ] as const) {
      assert.equal(allowed(contents, permission), false);
      assert.equal(check(contents, permission, origin, details), false);
    }
    for (const untrusted of [
      "https://example.com/",
      "http://127.0.0.1:4175/",
      "http://127.0.0.1:4174.evil.test/",
      "http://127.0.0.1:4174@evil.test/",
      "null",
      "not a URL",
      "",
    ]) {
      assert.equal(allowed(contents, "fullscreen", untrusted), false, untrusted);
      assert.equal(check(contents, "fullscreen", untrusted, details), false, untrusted);
      assert.equal(
        check(contents, "fullscreen", origin, { ...details, requestingUrl: untrusted }),
        false,
        untrusted,
      );
    }
    assert.equal(allowed(contents, "fullscreen", url, false), false);
    assert.equal(check(contents, "fullscreen", origin, { ...details, isMainFrame: false }), false);
    assert.equal(check(contents, "fullscreen", origin, { isMainFrame: true }), false);
    for (const sender of [null, { ...contents } as WebContents]) {
      assert.equal(allowed(sender, "fullscreen"), false);
      assert.equal(check(sender, "fullscreen", origin, details), false);
    }
    navigate("https://example.com/");
    assert.equal(allowed(contents, "fullscreen"), false);
    assert.equal(check(contents, "fullscreen", origin, details), false);
    navigate(url);
    contents.isDestroyed = () => true;
    assert.equal(allowed(contents, "fullscreen"), false);
    assert.equal(check(contents, "fullscreen", origin, details), false);
  });
});

test("desktop fits the cursor monitor work area and maximizes constrained displays", async () => {
  for (const [width, height] of [
    [640, 480],
    [1366, 768],
    [1920, 1040],
  ]) {
    await withDesktop(
      async ({ options, maximized }) => {
        assert.equal(options.width, Math.min(1280, width));
        assert.equal(options.height, Math.min(900, height));
        assert.equal(options.minWidth, Math.min(800, width));
        assert.equal(options.minHeight, Math.min(600, height));
        assert.equal(options.x, 1920 + Math.floor((width - Math.min(1280, width)) / 2));
        assert.equal(options.y, Math.floor((height - Math.min(900, height)) / 2));
        assert.equal(maximized, width <= 1280 || height <= 900);
      },
      { width, height },
    );
  }
});

test("desktop host advertises LAN addresses and accepts installed guest origins", async () => {
  const host = createLanServer(undefined, true);
  host.server.listen(0, "127.0.0.1");
  await once(host.server, "listening");
  const address = host.server.address();
  assert(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const response = await fetch(base + "/desktop-info");
    assert.equal(response.status, 200);
    const info = await response.json();
    assert.equal(info.desktop, true);
    assert(Array.isArray(info.addresses));
    const socket = new WebSocket(base.replace("http:", "ws:") + "/party?role=host", {
      origin: "http://127.0.0.1:4174",
    });
    const [raw] = await once(socket, "message");
    assert.equal(JSON.parse(raw.toString()).kind, "welcome");
    socket.close();
    await once(socket, "close");
  } finally {
    host.close();
  }
});
