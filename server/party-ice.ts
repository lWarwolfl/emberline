import "dotenv/config";
import { createHmac, randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

const STUN = [{ urls: "stun:stun.l.google.com:19302" }];

/** Coturn REST credentials expire after ten minutes; the shared secret stays server-side. */
export function partyIce(env = process.env, now = Date.now()) {
  const urls = (env.TURN_URLS ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
  const secret = env.TURN_SHARED_SECRET ?? "";
  if (!urls.length && !secret) return { iceServers: STUN, relayConfigured: false };
  if (
    !urls.length ||
    !secret ||
    urls.some((url) => !/^turns?:[^\s/?#@]+(?:\?transport=(?:udp|tcp))?$/.test(url))
  )
    throw new Error("Set TURN_URLS and TURN_SHARED_SECRET to a working TURN relay.");
  const username = `${Math.floor(now / 1000) + 600}:emberline-${randomBytes(8).toString("hex")}`;
  const credential = createHmac("sha1", secret).update(username).digest("base64");
  return {
    iceServers: [...STUN, { urls, username, credential }],
    relayConfigured: true,
  };
}

export function handlePartyIceRequest(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.writeHead(405).end(JSON.stringify({ error: "Method not allowed." }));
    return;
  }
  try {
    res.writeHead(200).end(JSON.stringify(partyIce()));
  } catch {
    res
      .writeHead(503)
      .end(JSON.stringify({ error: "The room relay is not configured correctly." }));
  }
}
