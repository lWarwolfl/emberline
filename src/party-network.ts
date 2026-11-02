import * as Party from "./party";

export type Message =
  | { type: "hello"; profile: Party.Profile }
  | { type: "state"; snapshot: string; eventId: number; events: import("./types").GameEvent[] }
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
function unpack(code: string): Invite {
  if (code.length > 32000) throw new Error("Invite is too long.");
  const compact = code.replace(/[\s\u200b-\u200d\ufeff]/g, "");
  const start = compact.indexOf("EMBER7.");
  if (start < 0) throw new Error("Paste the whole EMBER7 code.");
  const raw = compact.slice(start + "EMBER7.".length).replace(/[^A-Za-z0-9+/=]/g, "");
  for (let trim = 0; trim <= 40 && raw.length - trim >= 8; trim++) {
    const slice = raw.slice(0, raw.length - trim);
    const padded = slice + "=".repeat((4 - (slice.length % 4)) % 4);
    try {
      const data = JSON.parse(atob(padded)) as Invite;
      if (
        data.version === 7 &&
        (data.type === "offer" || data.type === "answer") &&
        typeof data.sdp === "string" &&
        data.sdp.length <= 24000 &&
        /^[a-z0-9-]{1,64}$/i.test(data.slot)
      )
        return data;
    } catch {
      continue;
    }
  }
  throw new Error("That code is incomplete. Copy the whole answer and paste it again.");
}
function pack(data: Invite) {
  return "EMBER7." + btoa(JSON.stringify(data));
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
    const response = await fetch(new URL("/host-info", target), { cache: "no-store" });
    if (response.ok) {
      const info = (await response.json()) as { hosting?: boolean };
      hosting = info.hosting === true;
    }
  } catch {
    hosting = false;
  }
  if (!hosting)
    throw new Error(
      "This page has no LAN relay. Follow the direct invite steps, or open the address printed by npm run host.",
    );
}
export function create(callbacks: Callbacks) {
  let links = new Map<string, Link>();
  let peers = new Map<string, RTCPeerConnection>();
  let socket: WebSocket | null = null;
  let role: "host" | "guest" | null = null;
  let localId = "host",
    hostId = "host";
  let generation = 0;
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
    const invite = unpack(code);
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
    const invite = unpack(code),
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
    const timeout = later(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        ws.close();
        callbacks.status("LAN server unavailable. Open the address printed by npm run host.");
      }
    }, 7000);
    let opened = false;
    ws.onopen = () => {
      opened = true;
      clearTimeout(timeout);
      timers.delete(timeout);
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
