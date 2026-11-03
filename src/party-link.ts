const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function clean(value: string) {
  const url = new URL(value);
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) return null;
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}

export function isLoopback(address: string) {
  try {
    return LOOPBACK.has(new URL(address).hostname);
  } catch {
    return false;
  }
}

/** Addresses a teammate on this network can open, preferring the page they already reached. */
export function joinAddresses(page: string, advertised: string[]) {
  const seen = new Set<string>();
  const lan: string[] = [];
  const local: string[] = [];
  for (const value of [page, ...advertised]) {
    let url: URL | null;
    try {
      url = clean(value);
    } catch {
      continue;
    }
    if (!url || seen.has(url.origin)) continue;
    seen.add(url.origin);
    (LOOPBACK.has(url.hostname) ? local : lan).push(url.toString());
  }
  return lan.length ? lan : local;
}

export function joinUrl(address: string, room: string) {
  const url = clean(address);
  if (!url) throw new Error("Use the host's http:// LAN address without login details.");
  if (!/^[A-F0-9]{6}$/i.test(room)) throw new Error("Enter the six-character LAN room code.");
  url.searchParams.set("room", room.toUpperCase());
  return url.toString();
}

/** Pull a host address and room from a join link, including one wrapped in other text. */
export function parseJoin(text: string) {
  const found = text.trim().match(/https?:\/\/[^\s]+/i);
  if (!found) return null;
  let url: URL;
  try {
    url = new URL(found[0]);
  } catch {
    return null;
  }
  const room = url.searchParams.get("room") ?? "";
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) return null;
  if (!/^[A-F0-9]{6}$/i.test(room)) return null;
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return { address: url.toString(), room: room.toUpperCase() };
}
