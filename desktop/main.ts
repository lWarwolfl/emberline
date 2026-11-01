import { app, BrowserWindow, dialog, screen, session } from "electron";
import { once } from "node:events";
import path from "node:path";
import { createLanServer } from "../scripts/lan-server";

let host: ReturnType<typeof createLanServer> | undefined;
let window: BrowserWindow | undefined;

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.setAppUserModelId("dev.sinakheiri.emberline");
  app.on("second-instance", () => {
    if (window?.isMinimized()) window.restore();
    window?.focus();
  });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => host?.close());
  void app.whenReady().then(async () => {
    try {
      host = createLanServer(path.join(app.getAppPath(), "public"), true);
      host.server.listen(4174, "0.0.0.0");
      await once(host.server, "listening");
      const address = host.server.address();
      if (!address || typeof address === "string") throw new Error("Local server did not start.");
      const origin = `http://127.0.0.1:${address.port}`;
      const trustedUrl = (url: string | undefined) =>
        !!url && URL.canParse(url) && new URL(url).origin === origin;
      const trustedRenderer = (contents: Electron.WebContents | null) =>
        !!contents &&
        contents === window?.webContents &&
        !contents.isDestroyed() &&
        trustedUrl(contents.getURL());
      session.defaultSession.setPermissionRequestHandler(
        (contents, permission, callback, details) =>
          callback(
            permission === "fullscreen" &&
              trustedRenderer(contents) &&
              details.isMainFrame &&
              trustedUrl(details.requestingUrl),
          ),
      );
      session.defaultSession.setPermissionCheckHandler(
        (contents, permission, requestingOrigin, details) =>
          permission === "fullscreen" &&
          trustedRenderer(contents) &&
          details.isMainFrame &&
          trustedUrl(requestingOrigin) &&
          trustedUrl(details.requestingUrl),
      );
      session.defaultSession.webRequest.onHeadersReceived((details, callback) =>
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            "Content-Security-Policy": [
              "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
            ],
          },
        }),
      );
      const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
      const width = Math.min(1280, display.workAreaSize.width);
      const height = Math.min(900, display.workAreaSize.height);
      window = new BrowserWindow({
        title: "EMBERLINE",
        width,
        height,
        x: display.workArea.x + Math.floor((display.workAreaSize.width - width) / 2),
        y: display.workArea.y + Math.floor((display.workAreaSize.height - height) / 2),
        minWidth: Math.min(800, display.workAreaSize.width),
        minHeight: Math.min(600, display.workAreaSize.height),
        backgroundColor: "#101514",
        icon: path.join(app.getAppPath(), "public/assets/icon-512.png"),
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          webSecurity: true,
          backgroundThrottling: false,
        },
      });
      window.removeMenu();
      if (display.workAreaSize.width <= 1280 || display.workAreaSize.height <= 900)
        window.maximize();
      window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      window.webContents.on("will-navigate", (event, url) => {
        if (new URL(url).origin !== origin) event.preventDefault();
      });
      window.webContents.on("will-attach-webview", (event) => event.preventDefault());
      await window.loadURL(origin + "/?desktop=1");
    } catch (error) {
      dialog.showErrorBox(
        "EMBERLINE could not start",
        error instanceof Error ? error.message : String(error),
      );
      app.quit();
    }
  });
}
