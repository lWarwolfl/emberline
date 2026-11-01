import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { networkInterfaces } from "node:os";
import { randomBytes, randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";

/** A small LAN-only static host and room relay. Game simulation stays in the host browser. */
export function createLanServer(root = path.resolve(__dirname, "../public"), desktop = false) {
  const rooms = new Map<string, { host: string; peers: Map<string, WebSocket>; locked: boolean }>();
  const mime: Record<string, string> = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".json": "application/json",
    ".webmanifest": "application/manifest+json",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
  };
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://localhost");
      if (url.pathname === "/host-info" || (desktop && url.pathname === "/desktop-info")) {
        const address = server.address();
        const port = address && typeof address !== "string" ? address.port : 4173;
        const addresses = Object.values(networkInterfaces()).flatMap((entries) =>
          (entries || [])
            .filter((entry) => entry.family === "IPv4" && !entry.internal)
            .map((entry) => `http://${entry.address}:${port}/`),
        );
        res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        res.end(JSON.stringify({ desktop, hosting: true, addresses }));
        return;
      }
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
      const file = path.resolve(root, relative);
      if (!file.startsWith(path.resolve(root) + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, {
        "Content-Type": mime[path.extname(file)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
      });
      res.end(body);
    } catch {
      res.writeHead(404).end("Not found");
    }
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 250000 });
  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url || "/", "http://localhost");
    // Only browsers loading this LAN host may connect. Reject cross-site requests.
    let sameOrigin = true;
    try {
      if (req.headers.origin) {
        const origin = new URL(req.headers.origin);
        sameOrigin =
          origin.host === req.headers.host ||
          (desktop && origin.protocol === "http:" && origin.hostname === "127.0.0.1");
      }
    } catch {
      sameOrigin = false;
    }
    if (url.pathname !== "/party" || !sameOrigin) {
      socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  });
  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "/", "http://localhost");
    const hosting = url.searchParams.get("role") === "host";
    const code = hosting
      ? randomBytes(3).toString("hex").toUpperCase()
      : url.searchParams.get("room") || "";
    const id = randomUUID();
    if (hosting && rooms.size < 32) rooms.set(code, { host: id, peers: new Map(), locked: false });
    const room = rooms.get(code);
    function reject(message: string) {
      ws.send(JSON.stringify({ kind: "error", message }));
      ws.close(1008, message.slice(0, 120));
    }
    if (!room) {
      reject("Room not found. Check the code and LAN address.");
      return;
    }
    if (room.peers.size >= 4) {
      reject("Party full: maximum four couriers.");
      return;
    }
    if (room.locked) {
      reject("This run has started. Join the next lobby.");
      return;
    }
    room.peers.set(id, ws);
    ws.send(JSON.stringify({ kind: "welcome", id, host: room.host, room: code }));
    let windowStart = Date.now(),
      count = 0;
    ws.on("message", (raw) => {
      if (Date.now() - windowStart > 1000) {
        windowStart = Date.now();
        count = 0;
      }
      if (++count > 90) {
        reject("Too many messages.");
        return;
      }
      try {
        const value = JSON.parse(raw.toString());
        if (id === room.host && value.kind === "lock") {
          room.locked = value.locked === true;
          return;
        }
        const to = String(value.to);
        if (id !== room.host && to !== room.host) return;
        const target = room.peers.get(to);
        if (target?.readyState === WebSocket.OPEN && target.bufferedAmount < 500000)
          target.send(JSON.stringify({ kind: "data", from: id, data: value.data }));
      } catch {
        reject("Malformed message.");
      }
    });
    ws.on("close", () => {
      room.peers.delete(id);
      if (id === room.host) {
        rooms.delete(code);
        for (const peer of room.peers.values()) {
          peer.send(JSON.stringify({ kind: "left", id }));
          peer.close(1000, "Host left");
        }
      } else
        for (const peer of room.peers.values())
          if (peer.readyState === WebSocket.OPEN) peer.send(JSON.stringify({ kind: "left", id }));
    });
    ws.on("error", () => ws.close());
  });
  return {
    server,
    wss,
    close() {
      for (const ws of wss.clients) ws.terminate();
      wss.close();
      server.close();
    },
  };
}
if (require.main === module && !process.versions.electron) {
  const port = Number(process.env.PORT || 4173);
  const { server } = createLanServer();
  server.listen(port, "0.0.0.0", () => {
    console.log(
      `EMBERLINE LAN: http://localhost:${port}/ — keep this terminal and the host browser open.`,
    );
    for (const addresses of Object.values(networkInterfaces()))
      for (const a of addresses || [])
        if (a.family === "IPv4" && !a.internal)
          console.log(
            `Teammates open http://${a.address}:${port}/ on the same network, then PARTY → Join LAN.`,
          );
  });
}
