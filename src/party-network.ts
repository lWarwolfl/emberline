import * as Party from "./party";
import { roomIce } from "./party-ice";

export type Message =
  | { type: "hello"; profile: Party.Profile }
  | {
      type: "state";
      snapshot: string;
      eventId: number;
      events: import("./types").GameEvent[];
      acks?: Record<string, number>;
    }
  | { type: "input"; action: Party.Action; sequence: number }
  | { type: "reject"; reason: string };
interface Link {
  send: (message: Message) => void;
  close: () => void;
}
export interface Callbacks {
  message: (id: string, message: Message) => void;
  disconnected: (id: string) => void;
  status: (message: string) => void;
  ready: (id: string, host: boolean, room: string) => void;
}
interface Invite {
  version: 7;
  slot: string;
  type: "offer" | "answer";
  sdp: string;
}
function valid(data: Invite) {
  return (
    !!data &&
    data.version === 7 &&
    (data.type === "offer" || data.type === "answer") &&
    typeof data.sdp === "string" &&
    data.sdp.length <= 24000 &&
    /^[a-z0-9-]{1,64}$/i.test(data.slot)
  );
}
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32(bytes: Uint8Array) {
  let bits = 0,
    value = 0,
    out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += BASE32[(value >> bits) & 31];
    }
  }
  if (bits) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}
function unbase32(text: string) {
  let bits = 0,
    value = 0;
  const out: number[] = [];
  for (const char of text) {
    const index = BASE32.indexOf(char);
    if (index < 0) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >> bits) & 255);
    }
  }
  return Uint8Array.from(out);
}
function copyBytes(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}
async function deflate(text: string) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function inflate(bytes: Uint8Array) {
  const stream = new Blob([copyBytes(bytes).buffer])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).text();
}
async function unpackCompressed(payload: string) {
  const raw = payload.toUpperCase().replace(/[^A-Z2-7]/g, "");
  for (let trim = 0; trim <= 40 && raw.length - trim >= 8; trim++) {
    try {
      const data = JSON.parse(await inflate(unbase32(raw.slice(0, raw.length - trim)))) as Invite;
      if (valid(data)) return data;
    } catch {
      continue;
    }
  }
  return null;
}
async function unpack(code: string): Promise<Invite> {
  if (code.length > 32000) throw new Error("Invite is too long.");
  const compact = code.replace(/[\s\u200b-\u200d\ufeff]/g, "");
  const compressedAt = compact.indexOf("EMBER7C.");
  const plainAt = compact.indexOf("EMBER7.");
  if (compressedAt >= 0 && (plainAt < 0 || compressedAt < plainAt)) {
    const invite = await unpackCompressed(compact.slice(compressedAt + "EMBER7C.".length));
    if (invite) return invite;
    throw new Error("That code is incomplete. Copy the whole answer and paste it again.");
  }
  if (plainAt < 0) throw new Error("Paste the whole EMBER7 code.");
  const raw = compact.slice(plainAt + "EMBER7.".length).replace(/[^A-Za-z0-9+/=]/g, "");
  for (let trim = 0; trim <= 40 && raw.length - trim >= 8; trim++) {
    const slice = raw.slice(0, raw.length - trim);
    const padded = slice + "=".repeat((4 - (slice.length % 4)) % 4);
    try {
      const data = JSON.parse(atob(padded)) as Invite;
      if (valid(data)) return data;
    } catch {
      continue;
    }
  }
  throw new Error("That code is incomplete. Copy the whole answer and paste it again.");
}
function pack(data: Invite) {
  return "EMBER7." + btoa(JSON.stringify(data));
}
function sameNetworkSdp(sdp: string) {
  const lines = sdp.split(/\r?\n/);
  const local = lines.filter(
    (line) => line.startsWith("a=candidate:") && / typ host\b|\.local\b/i.test(line),
  );
  if (!local.length) return sdp;
  return lines
    .filter((line) => !line.startsWith("a=candidate:") || local.includes(line))
    .join("\r\n");
}
/** Short uppercase form of an invite, small enough for a same-room scan. */
export async function compressed(code: string) {
  const invite = await unpack(code);
  invite.sdp = sameNetworkSdp(invite.sdp);
  return "EMBER7C." + base32(await deflate(JSON.stringify(invite)));
}
export async function read(code: string) {
  const invite = await unpack(code);
  return { type: invite.type, slot: invite.slot, sdp: invite.sdp };
}
function message(text: unknown): Message | null {
  if (typeof text !== "string" || text.length > 250000) return null;
  try {
    const data = JSON.parse(text) as Message;
    return data && ["hello", "state", "input", "reject"].includes(data.type) ? data : null;
  } catch {
    return null;
  }
}
function identifier() {
  const bytes = crypto.getRandomValues(new Uint32Array(3));
  return Array.from(bytes, (b) => b.toString(36)).join("-");
}
export async function requireRelay(address = "") {
  const target = address.trim() ? new URL(address.trim()) : new URL(location.href);
  if (!/^https?:$/.test(target.protocol) || target.username || target.password)
    throw new Error("Use the host's http:// LAN address without login details.");
  let hosting = false;
  try {
    const response = await fetch(new URL("/host-info", target), {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (response.ok) {
      const info = (await response.json()) as { hosting?: boolean };
      hosting = info.hosting === true;
    }
  } catch {
    hosting = false;
  }
  if (!hosting)
    throw new Error(
      "This page has no LAN relay. Host a room here for an internet join link, or open the address printed by npm run host.",
    );
}
export interface RoomChannel {
  peer: string;
  peerConnection?: RTCPeerConnection;
  send: (data: Message) => void;
  close: () => void;
  on: (event: "open" | "data" | "close" | "error", listener: (data?: unknown) => void) => void;
}
export interface RoomBroker {
  id: string;
  destroy: () => void;
  reconnect: () => void;
  on: (event: string, listener: (value?: unknown) => void) => void;
  connect: (id: string, options: { reliable: boolean; serialization: "json" }) => RoomChannel;
}
interface NetworkOptions {
  roomPeer?: (id: string | undefined, config: RTCConfiguration) => Promise<RoomBroker>;
  connectionTimeoutMs?: number;
}
export function create(callbacks: Callbacks, options: NetworkOptions = {}) {
  let links = new Map<string, Link>();
  let peers = new Map<string, RTCPeerConnection>();
  let socket: WebSocket | null = null;
  let broker: RoomBroker | null = null;
  let role: "host" | "guest" | null = null;
  let localId = "host",
    hostId = "host";
  let generation = 0;
  let cancelOpening: (() => void) | null = null;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  function later(fn: () => void, ms: number) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      fn();
    }, ms);
    timers.add(timer);
    return timer;
  }
  function close() {
    const cancel = cancelOpening;
    cancelOpening = null;
    cancel?.();
    generation++;
    const previous = links;
    links = new Map();
    const oldPeers = peers;
    peers = new Map();
    role = null;
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    for (const link of previous.values()) link.close();
    for (const pc of oldPeers.values()) pc.close();
    if (socket) {
      socket.onclose = null;
      socket.close();
      socket = null;
    }
    if (broker) {
      broker.destroy();
      broker = null;
    }
  }
  function attach(id: string, channel: RTCDataChannel, pc: RTCPeerConnection, epoch: number) {
    const lost = () => {
      if (generation !== epoch || !links.has(id)) return;
      links.delete(id);
      peers.delete(id);
      pc.close();
      callbacks.disconnected(id);
    };
    channel.onopen = () => {
      if (generation !== epoch) {
        pc.close();
        return;
      }
      links.set(id, {
        send(data) {
          if (channel.readyState === "open" && channel.bufferedAmount < 500000)
            channel.send(JSON.stringify(data));
        },
        close() {
          channel.close();
          pc.close();
        },
      });
      callbacks.status("Courier connected.");
      if (role === "guest") callbacks.ready(localId, false, "Direct connection");
    };
    channel.onmessage = (event) => {
      const data = message(event.data);
      if (data && generation === epoch) callbacks.message(id, data);
    };
    channel.onclose = lost;
    channel.onerror = lost;
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        if (!links.has(id))
          callbacks.status(
            "No direct route to that teammate. Ask them to keep their page open, or use LAN on the same Wi-Fi.",
          );
        lost();
      } else if (pc.connectionState === "disconnected")
        later(() => {
          if (pc.connectionState === "disconnected") lost();
        }, 5000);
    };
  }
  async function gather(pc: RTCPeerConnection) {
    const ready = () => pc.localDescription?.sdp.includes("a=candidate:") === true;
    if (pc.iceGatheringState === "complete" && ready()) return;
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (ok || ready()) resolve();
        else
          reject(new Error("Connection discovery timed out. Try LAN hosting on the same Wi-Fi."));
      };
      const timeout = later(() => finish(false), 12000);
      const change = () => {
        if (pc.iceGatheringState === "complete") finish(ready());
      };
      const candidate = (event: RTCPeerConnectionIceEvent) => {
        if (!event.candidate) finish(true);
      };
      function cleanup() {
        clearTimeout(timeout);
        timers.delete(timeout);
        pc.removeEventListener("icegatheringstatechange", change);
        pc.removeEventListener("icecandidate", candidate);
      }
      pc.addEventListener("icegatheringstatechange", change);
      pc.addEventListener("icecandidate", candidate);
      if (pc.iceGatheringState === "complete") finish(ready());
    });
  }
  function peer() {
    if (typeof RTCPeerConnection === "undefined")
      throw new Error("Direct invites are unavailable in this browser. Use LAN hosting instead.");
    return new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
  }
  function host() {
    close();
    role = "host";
    localId = hostId = "host";
    callbacks.ready(localId, true, "Direct invites");
  }
  async function offer() {
    if (role !== "host") throw new Error("Create a party first.");
    if (peers.size >= 3)
      throw new Error(
        "Party full, or three invites are pending. Cancel pending invites to free a slot.",
      );
    const id = identifier(),
      epoch = generation;
    const pc = peer();
    peers.set(id, pc);
    const channel = pc.createDataChannel("emberline-v7", { ordered: true });
    attach(id, channel, pc, epoch);
    try {
      await pc.setLocalDescription(await pc.createOffer());
      await gather(pc);
      if (epoch !== generation) throw new Error("Party closed.");
      later(() => {
        if (!links.has(id) && peers.get(id) === pc) {
          peers.delete(id);
          pc.close();
          callbacks.status("An unused invite expired. Generate a new invite.");
        }
      }, 180000);
      return pack({ version: 7, slot: id, type: "offer", sdp: pc.localDescription!.sdp });
    } catch (error) {
      peers.delete(id);
      pc.close();
      throw error;
    }
  }
  async function answer(code: string) {
    const invite = await unpack(code);
    if (invite.type !== "offer") throw new Error("Paste the host's invite here.");
    close();
    role = "guest";
    localId = invite.slot;
    hostId = "host";
    const epoch = generation,
      pc = peer();
    peers.set(hostId, pc);
    pc.ondatachannel = (event) => attach(hostId, event.channel, pc, epoch);
    await pc.setRemoteDescription({ type: "offer", sdp: invite.sdp });
    await pc.setLocalDescription(await pc.createAnswer());
    await gather(pc);
    return pack({ version: 7, slot: invite.slot, type: "answer", sdp: pc.localDescription!.sdp });
  }
  async function accept(code: string) {
    if (role !== "host") throw new Error("Only the host can accept answers.");
    const invite = await unpack(code),
      pc = peers.get(invite.slot);
    if (invite.type !== "answer" || !pc || pc.signalingState !== "have-local-offer")
      throw new Error(
        invite.type === "answer" && pc
          ? "This invite is no longer waiting. Choose New Invite, send that new code, and accept the new answer."
          : "This answer doesn't match a pending invite. Generate a fresh invite for each teammate.",
      );
    await pc.setRemoteDescription({ type: "answer", sdp: invite.sdp });
    later(() => {
      if (!links.has(invite.slot))
        callbacks.status(
          "No direct route found. Use LAN hosting on the same network; some internet networks need a relay.",
        );
    }, 20000);
  }
  function lan(host: boolean, room: string, address = "") {
    if (!/^https?:$/.test(location.protocol))
      throw new Error("Start npm run host and open its LAN address first.");
    const target = address.trim() ? new URL(address.trim()) : new URL(location.href);
    if (!/^https?:$/.test(target.protocol) || target.username || target.password)
      throw new Error("Use the host's http:// LAN address without login details.");
    close();
    role = host ? "host" : "guest";
    const epoch = generation;
    const url = new URL("/party", target);
    url.protocol = target.protocol === "https:" ? "wss:" : "ws:";
    url.search = new URLSearchParams({
      role: host ? "host" : "guest",
      room: room.trim().toUpperCase(),
    }).toString();
    const ws = new WebSocket(url);
    socket = ws;
    let welcomed = false;
    const timeout = later(() => {
      if (generation === epoch && !welcomed) {
        ws.close();
        callbacks.status("LAN server unavailable. Open the address printed by npm run host.");
      }
    }, 7000);
    let opened = false;
    ws.onopen = () => {
      opened = true;
    };
    ws.onerror = () => {
      if (!opened)
        callbacks.status(
          "LAN connection failed. Stay on the LAN host address, allow the firewall if asked, and try again.",
        );
    };
    ws.onmessage = (event) => {
      if (generation !== epoch || typeof event.data !== "string" || event.data.length > 300000)
        return;
      try {
        const envelope = JSON.parse(event.data);
        if (envelope.kind === "welcome") {
          welcomed = true;
          clearTimeout(timeout);
          timers.delete(timeout);
          localId = envelope.id;
          hostId = envelope.host;
          callbacks.ready(localId, host, envelope.room);
        } else if (envelope.kind === "data") {
          const data = message(JSON.stringify(envelope.data));
          if (!data) return;
          const id = String(envelope.from);
          if (role === "host" && !links.has(id))
            links.set(id, { send: (data) => sendSocket(id, data), close() {} });
          callbacks.message(id, data);
        } else if (envelope.kind === "left") {
          links.delete(envelope.id);
          if (role === "host" || envelope.id === hostId) callbacks.disconnected(envelope.id);
        } else if (envelope.kind === "error") callbacks.status(String(envelope.message));
      } catch {
        callbacks.status("Invalid LAN server response.");
      }
    };
    ws.onclose = () => {
      if (generation === epoch) callbacks.disconnected(host ? localId : hostId);
    };
  }
  async function link(hosting: boolean, code: string) {
    const room = code.trim().toUpperCase();
    if (!/^[A-F0-9]{6}$/.test(room)) throw new Error("Enter the six-character room code.");
    if (!/^https?:$/.test(location.protocol))
      throw new Error(
        "Open the join link in a browser. A file on this computer cannot introduce other people.",
      );
    close();
    role = hosting ? "host" : "guest";
    const epoch = generation;
    const ice = await roomIce();
    if (generation !== epoch) throw new Error("Connection cancelled.");
    const hostPeerId = `emberline8${room.toLowerCase()}`;
    const createPeer =
      options.roomPeer ??
      (async (id: string | undefined, config: RTCConfiguration) => {
        const { default: Peer } = await import("peerjs");
        return (
          id ? new Peer(id, { config, debug: 0 }) : new Peer({ config, debug: 0 })
        ) as RoomBroker;
      });
    const peer = await createPeer(hosting ? hostPeerId : undefined, ice);
    if (generation !== epoch) {
      peer.destroy();
      throw new Error("Connection cancelled.");
    }
    broker = peer;
    const routeError = ice.iceServers?.some((server) =>
      (typeof server.urls === "string" ? [server.urls] : server.urls).some((url) =>
        /^turns?:/.test(url),
      ),
    )
      ? "Could not reach the host through the room relay. Check both connections and try again."
      : "These networks could not connect. This site has no relay enabled yet; try the same Wi-Fi or another network.";
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const timeout = later(() => fail({ type: "timeout" }), options.connectionTimeoutMs ?? 30000);
      const clear = () => {
        clearTimeout(timeout);
        timers.delete(timeout);
        cancelOpening = null;
      };
      cancelOpening = () => {
        if (settled) return;
        settled = true;
        clear();
        reject(new Error("Connection cancelled."));
      };
      const ready = () => {
        if (settled || generation !== epoch) return;
        settled = true;
        clear();
        callbacks.ready(localId, hosting, room);
        resolve();
      };
      const fail = (error: { type?: string }) => {
        if (generation !== epoch) return;
        const kind = error.type ?? "";
        const text =
          kind === "unavailable-id"
            ? "That room is already open. Host again to get a new link."
            : kind === "peer-unavailable"
              ? "That room is not open. Ask the host to keep the page open and send the link again."
              : kind === "webrtc" || (!hosting && kind === "timeout")
                ? routeError
                : "Could not open the room link. Check the internet connection and try again.";
        if (!settled) {
          settled = true;
          clear();
          close();
          reject(new Error(text));
        } else {
          callbacks.status(text);
          if (hosting && (kind === "webrtc" || kind === "peer-unavailable")) return;
          callbacks.disconnected(hosting ? localId : hostId);
          close();
        }
      };
      const bind = (id: string, channel: RoomChannel) => {
        let connected = false;
        let finished = false;
        const pendingTimeout = later(() => {
          if (generation !== epoch || connected || finished) return;
          lost();
        }, options.connectionTimeoutMs ?? 30000);
        const clearChannelTimeout = () => {
          clearTimeout(pendingTimeout);
          timers.delete(pendingTimeout);
        };
        const lost = () => {
          if (generation !== epoch || finished) return;
          finished = true;
          clearChannelTimeout();
          channel.peerConnection?.removeEventListener("iceconnectionstatechange", iceChanged);
          channel.peerConnection?.removeEventListener("connectionstatechange", iceChanged);
          const wasConnected = links.delete(id);
          channel.close();
          if (wasConnected) callbacks.disconnected(id);
          else if (!hosting) fail({ type: "webrtc" });
          else callbacks.status("A teammate could not connect. Ask them to try again.");
        };
        channel.on("open", () => {
          if (generation !== epoch || finished) {
            channel.close();
            return;
          }
          clearChannelTimeout();
          if (hosting && links.size >= 3) {
            finished = true;
            channel.close();
            callbacks.status("The room is full.");
            return;
          }
          connected = true;
          links.set(id, {
            send(data) {
              channel.send(data);
            },
            close() {
              channel.close();
            },
          });
          if (!hosting) ready();
          else callbacks.status("Courier connected.");
        });
        channel.on("data", (data) => {
          if (generation !== epoch || finished) return;
          const parsed = message(typeof data === "string" ? data : JSON.stringify(data));
          if (parsed) callbacks.message(id, parsed);
        });
        const iceChanged = () => {
          if (
            channel.peerConnection?.iceConnectionState === "failed" ||
            channel.peerConnection?.connectionState === "failed"
          )
            lost();
        };
        channel.peerConnection?.addEventListener("iceconnectionstatechange", iceChanged);
        channel.peerConnection?.addEventListener("connectionstatechange", iceChanged);
        channel.on("close", lost);
        channel.on("error", lost);
      };
      peer.on("error", (error) => fail((error ?? {}) as { type?: string }));
      peer.on("disconnected", () => {
        if (generation === epoch) peer.reconnect();
      });
      peer.on("open", () => {
        if (generation !== epoch) return;
        if (hosting) {
          localId = hostId = "host";
          ready();
        } else {
          localId = peer.id;
          hostId = hostPeerId;
          bind(hostPeerId, peer.connect(hostPeerId, { reliable: true, serialization: "json" }));
        }
      });
      if (hosting)
        peer.on("connection", (value) => {
          if (generation !== epoch) {
            (value as RoomChannel).close();
            return;
          }
          bind((value as RoomChannel).peer, value as RoomChannel);
        });
    });
  }
  function sendSocket(to: string, data: Message) {
    if (socket?.readyState === WebSocket.OPEN && socket.bufferedAmount < 500000)
      socket.send(JSON.stringify({ to, data }));
  }
  return {
    host,
    offer,
    answer,
    accept,
    lan,
    link,
    close,
    cancelPending() {
      for (const [id, pc] of peers)
        if (!links.has(id)) {
          peers.delete(id);
          pc.close();
        }
    },
    send(id: string, data: Message) {
      if (socket) sendSocket(id, data);
      else links.get(id)?.send(data);
    },
    broadcast(data: Message) {
      for (const id of links.keys()) this.send(id, data);
    },
    toHost(data: Message) {
      this.send(hostId, data);
    },
    lock(locked: boolean) {
      if (socket?.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify({ kind: "lock", locked }));
    },
    remove(id: string) {
      links.get(id)?.close();
      links.delete(id);
      peers.get(id)?.close();
      peers.delete(id);
    },
    get isHost() {
      return role === "host";
    },
    get localId() {
      return localId;
    },
  };
}
