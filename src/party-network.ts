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
  const data = JSON.parse(atob(code.trim().replace(/^EMBER7\./, ""))) as Invite;
  if (
    data.version !== 7 ||
    !["offer", "answer"].includes(data.type) ||
    typeof data.sdp !== "string" ||
    data.sdp.length > 24000 ||
    !/^[a-z0-9-]{1,64}$/i.test(data.slot)
  )
    throw new Error("Use a valid version 7 invite or answer.");
  return data;
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
      if (pc.connectionState === "failed" || pc.connectionState === "closed") lost();
      else if (pc.connectionState === "disconnected")
        later(() => {
          if (pc.connectionState === "disconnected") lost();
        }, 5000);
    };
  }
  async function gather(pc: RTCPeerConnection) {
    if (pc.iceGatheringState === "complete") return;
    await new Promise<void>((resolve, reject) => {
      const timeout = later(() => {
        cleanup();
        if (pc.localDescription?.sdp.includes("a=candidate:")) resolve();
        else
          reject(new Error("Connection discovery timed out. Try LAN hosting on the same Wi-Fi."));
      }, 12000);
      const change = () => {
        if (pc.iceGatheringState === "complete") {
          cleanup();
          resolve();
        }
      };
      function cleanup() {
        clearTimeout(timeout);
        timers.delete(timeout);
        pc.removeEventListener("icegatheringstatechange", change);
      }
      pc.addEventListener("icegatheringstatechange", change);
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
        "This answer doesn't match a pending invite. Generate a fresh invite for each teammate.",
      );
    await pc.setRemoteDescription({ type: "answer", sdp: invite.sdp });
    later(() => {
      if (!links.has(invite.slot))
        callbacks.status(
          "No direct route found. Use LAN hosting on the same network; some internet networks need a relay.",
        );
    }, 20000);
  }
  function lan(host: boolean, room: string) {
    if (!/^https?:$/.test(location.protocol))
      throw new Error("Start npm run host and open its LAN address first.");
    close();
    role = host ? "host" : "guest";
    const epoch = generation;
    const url = new URL("/party", location.href);
    url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
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
    ws.onopen = () => {
      clearTimeout(timeout);
      timers.delete(timeout);
    };
    ws.onerror = () =>
      callbacks.status(
        "LAN connection failed. Open the address printed by npm run host on the same Wi-Fi.",
      );
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
