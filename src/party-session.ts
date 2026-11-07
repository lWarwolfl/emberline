import * as Party from "./party";
import * as Sync from "./party-sync";
import Config from "./config";
import * as Network from "./party-network";
import { isLoopback, joinAddresses, joinUrl, parseJoin } from "./party-link";
import { drawQr } from "./qr";
import { element } from "./dom";
import type { GameEvent } from "./types";

export function create(doc: Document, getProfile: () => Party.Profile, ended: () => void) {
  const dialog = element(doc, "party-dialog", "dialog");
  const status = element(doc, "party-message");
  const name = element(doc, "party-name", "input");
  const room = element(doc, "party-room", "input");
  const roster = element(doc, "party-roster");
  const hud = element(doc, "party-hud");
  const beaconProgress = element(doc, "beacon-progress", "progress");
  const beaconDistance = element(doc, "beacon-distance", "span");
  const startButton = element(doc, "party-start", "button");
  let run: Party.PartyRun | null = null;
  let samples: Sync.Sample[] = [];
  let pendingInputs: Sync.Remembered[] = [];
  let lastAck = 0;
  let hostClock = { time: 0, at: 0 };
  const acks = new Map<string, number>();
  let id = "host",
    host = false,
    elapsed = 0,
    sequence = 0,
    eventId = 0,
    seenEvent = 0;
  let earned = 0,
    pendingCoins = 0,
    quiet = 0,
    active = false,
    fingerprint = "";
  let pendingEvents: GameEvent[] = [];
  let unsentEvents: GameEvent[] = [];
  let advertised: string[] = [];
  let selectedAddress = "";
  let joinLink = "";
  let scanning = 0;
  let scanTimer = 0;
  let scanStream: MediaStream | null = null;
  let connecting: string | null = null;
  let dismissedCountdown = false;
  let connectionAttempt = 0;
  const busyActions = new Set<string>();
  const buttonLabels = new Map<string, string>();
  function buttonLoading(key: string, busy: boolean) {
    const button = element(doc, key, "button");
    const label = buttonLabels.get(key) ?? button.textContent ?? "";
    buttonLabels.set(key, label);
    const text = busy
      ? key === "party-lan-host"
        ? "OPENING ROOM..."
        : key === "party-lan-join"
          ? "JOINING..."
          : "PLEASE WAIT..."
      : label;
    if (button.getAttribute("aria-busy") === String(busy) && button.textContent === text) return;
    button.setAttribute("aria-busy", String(busy));
    button.classList.toggle("is-loading", busy);
    button.textContent = text;
  }
  const inputs = new Map<string, { seq: number; time: number; count: number }>();
  function say(text: string) {
    status.textContent = text;
  }
  function dismiss() {
    element(doc, "overlay").classList.add("hidden");
    for (const dialog of doc.querySelectorAll("dialog[open]"))
      if (dialog instanceof HTMLDialogElement) dialog.close();
    const count = run?.countdown ?? 0;
    if (count <= 0) return;
    const root = element(doc, "countdown");
    root.hidden = false;
    root.classList.remove("is-go");
    element(doc, "countdown-digit").textContent = String(Math.ceil(count));
  }
  function localProfile() {
    return Party.profile({ ...getProfile(), name: name.value });
  }
  function refresh() {
    const members = run ? Party.sorted(run) : [];
    element(doc, "party-leave", "button").disabled = !active && !connecting;
    for (const key of buttonLabels.keys()) {
      const busy = busyActions.has(key) || connecting === key;
      buttonLoading(key, busy);
      if (["party-copy-link", "party-share-link", "party-scan"].includes(key))
        element(doc, key, "button").disabled = busy || connecting !== null;
    }
    for (const key of ["party-lan-host", "party-lan-join"])
      element(doc, key, "button").disabled = active || connecting !== null || busyActions.has(key);
    name.disabled = room.disabled = active || connecting !== null;
    hud.hidden = !active;
    element(doc, "beacon-trail").hidden = !active;
    const progress = run ? Party.progress(run) : null;
    beaconProgress.value = progress?.value ?? 0;
    beaconDistance.textContent = progress
      ? `${Math.ceil(progress.remaining)}m TO BEACON · ${progress.distance}m`
      : `${Config.beaconInterval}m TO BEACON`;
    element(doc, "party", "button").textContent = active
      ? `PARTY ${members.length}/4`
      : "PARTY / LAN";
    const rows = members
      .map(
        (m) =>
          `${m.id}|${m.name}|${m.connected}|${m.state.hits}|${m.state.health}|${Object.values(m.state.stats.levels)}|${m.id === id}`,
      )
      .join(";");
    if (rows !== fingerprint) {
      fingerprint = rows;
      for (const container of [roster, hud]) {
        container.replaceChildren();
        for (const [i, m] of members.entries()) {
          const row = doc.createElement("div");
          row.className =
            "party-member" + (m.id === id ? " local" : "") + (!Party.alive(m) ? " down" : "");
          row.dataset.player = m.id;
          const title = doc.createElement("strong");
          title.textContent = `${i + 1}. ${m.name}${m.id === id ? " (YOU)" : ""}`;
          const health = doc.createElement("span");
          health.textContent = !m.connected
            ? "DISCONNECTED"
            : Party.alive(m)
              ? `HP ${m.state.health - m.state.hits}/${m.state.health}`
              : "DOWN · REVIVE AT BEACON";
          const levels = doc.createElement("small");
          const l = m.state.stats.levels;
          levels.textContent = `DASH ${l.dash} · JUMP ${l.jump} · DAMAGE ${l.damage} · ${m.state.stats.maxJumps} JUMPS`;
          row.title = `${title.textContent} · ${health.textContent} · ${levels.textContent}`;
          if (container === hud) {
            if (!Party.alive(m) && m.connected) health.textContent = "DOWN";
            row.append(health, title);
          } else row.append(title, health, levels);
          container.append(row);
        }
      }
    }
    const counting = (run?.countdown ?? 0) > 0;
    startButton.disabled = !host || !run || run.world.mode === "playing" || counting;
    const mainStart = element(doc, "start", "button");
    if (active) {
      mainStart.disabled = !host || counting;
      mainStart.textContent = host
        ? counting
          ? "CREW COUNTDOWN"
          : run?.started
            ? run.world.mode === "paused"
              ? "RESUME PARTY"
              : "RESTART PARTY"
            : "START PARTY RUN"
        : "WAITING FOR HOST";
    }
  }
  function publish(events: GameEvent[] = []) {
    if (!run || !host) return;
    if (events.length) eventId++;
    network.broadcast({
      type: "state",
      snapshot: Party.encode(run),
      eventId,
      events,
      acks: Object.fromEntries(acks),
    });
  }
  function account() {
    if (!run) return;
    pendingCoins += Math.max(0, run.earned - earned);
    earned = run.earned;
  }
  function leave(message = "Party closed. Your solo progress is saved.") {
    connecting = null;
    connectionAttempt++;
    network.close();
    active = false;
    run = null;
    samples = [];
    pendingInputs = [];
    lastAck = 0;
    acks.clear();
    pendingEvents = [];
    unsentEvents = [];
    pendingCoins = 0;
    earned = 0;
    inputs.clear();
    fingerprint = "";
    hideLanShare();
    stopScan();
    say(message);
    refresh();
    ended();
  }
  const network = Network.create({
    status(message) {
      say(message);
      if (!active) connecting = null;
      refresh();
    },
    ready(playerId, hosting, code) {
      connecting = null;
      active = true;
      id = playerId;
      host = hosting;
      earned = 0;
      quiet = 0;
      seenEvent = 0;
      eventId = 0;
      sequence = 0;
      if (host) run = Party.create(id, localProfile());
      else network.toHost({ type: "hello", profile: localProfile() });
      say(
        host
          ? `HOST / ${code} · Choose gear before hosting. Start when everyone appears below.`
          : "Connected. Waiting for the host's lobby.",
      );
      if (/^[A-F0-9]{6}$/.test(code)) {
        room.value = code;
        if (hosting) showLanShare(code);
      } else hideLanShare();
      refresh();
    },
    message(sender, data) {
      if (host) {
        if (!run) return;
        if (data.type === "hello") {
          if (run.members.some((m) => m.id === sender)) return;
          if (!Party.add(run, sender, Party.profile(data.profile))) {
            network.send(sender, {
              type: "reject",
              reason: "Party full or run already started. Join the next lobby.",
            });
            network.remove(sender);
            return;
          }
          publish();
          refresh();
        } else if (data.type === "input") {
          if (
            ![
              "jump",
              "dash",
              "attack",
              "powerup",
              "ground",
              "strafe-left",
              "strafe-right",
              "strafe-stop",
              "crouch",
              "stand",
            ].includes(data.action) ||
            !Number.isSafeInteger(data.sequence)
          )
            return;
          let entry = inputs.get(sender);
          if (!entry) {
            entry = { seq: -1, time: performance.now(), count: 0 };
            inputs.set(sender, entry);
          }
          if (data.sequence <= entry.seq) return;
          if (performance.now() - entry.time > 1000) {
            entry.time = performance.now();
            entry.count = 0;
          }
          if (++entry.count > 30) return;
          entry.seq = data.sequence;
          acks.set(sender, data.sequence);
          Party.action(run, sender, data.action);
        }
      } else if (
        data.type === "state" &&
        typeof data.snapshot === "string" &&
        data.snapshot.length < 220000
      ) {
        try {
          const received = Party.decode(data.snapshot);
          if (
            !Array.isArray(received.members) ||
            received.members.length > 4 ||
            !received.members.some((m) => m.id === id)
          )
            return;
          const acknowledged = data.acks?.[id];
          if (typeof acknowledged === "number") lastAck = acknowledged;
          pendingInputs = pendingInputs.filter((input) => input.sequence > lastAck);
          hostClock = { time: received.world.time, at: performance.now() };
          samples = Sync.remember(samples, received);
          if (!run) run = Party.clone(received);
          else if (received.world.mode !== "playing" || run.world.mode !== "playing") {
            Party.adopt(run, received);
            samples = Sync.remember([], received);
          }
          if ((received.countdown ?? 0) > 0 || received.world.mode === "countdown") {
            if (!dismissedCountdown) {
              dismiss();
              dismissedCountdown = true;
            }
          } else if (received.world.mode === "playing" || received.world.mode === "menu")
            dismissedCountdown = false;
          quiet = 0;
          if (data.eventId > seenEvent && Array.isArray(data.events)) {
            pendingEvents.push(...data.events.slice(0, 100));
            seenEvent = data.eventId;
          }
          account();
          refresh();
        } catch {
          say("Invalid party update. Leave and rejoin the lobby.");
        }
      } else if (data.type === "reject") leave(String(data.reason));
    },
    disconnected(playerId) {
      if (!active) return;
      if (host && playerId !== id && run) {
        Party.disconnect(run, playerId);
        publish();
        say("A teammate disconnected. The line has reformed.");
        refresh();
      } else
        leave(
          "Host disconnected. Party ended; earned coins are saved. Create a new lobby to continue.",
        );
    },
  });
  async function attempt(fn: () => void | Promise<void>, button: string) {
    const connection = button === "party-lan-host" || button === "party-lan-join";
    if (busyActions.has(button) || (connection && (active || connecting))) return;
    if (connection) {
      connecting = button;
      connectionAttempt++;
    }
    busyActions.add(button);
    buttonLoading(button, true);
    refresh();
    try {
      await fn();
    } catch (error) {
      if (connection) {
        if (connecting === button) {
          connecting = null;
          network.close();
          say(error instanceof Error ? error.message : "Connection failed.");
        }
      } else say(error instanceof Error ? error.message : "Connection failed.");
    } finally {
      busyActions.delete(button);
      buttonLoading(button, false);
      refresh();
    }
  }
  function stopScan() {
    scanning++;
    window.clearTimeout(scanTimer);
    scanStream?.getTracks().forEach((track) => track.stop());
    scanStream = null;
    const video = element(doc, "party-scan-video", "video");
    video.srcObject = null;
    element(doc, "party-scan-view").hidden = true;
  }
  function hideLanShare() {
    joinLink = "";
    selectedAddress = "";
    element(doc, "party-lan-share").hidden = true;
    element(doc, "party-lan-choices").replaceChildren();
  }
  function showLanShare(code: string) {
    const options = joinAddresses(location.href, advertised);
    if (!selectedAddress || !options.includes(selectedAddress)) selectedAddress = options[0] ?? "";
    const share = element(doc, "party-lan-share");
    if (!selectedAddress) {
      share.hidden = true;
      return;
    }
    joinLink = joinUrl(selectedAddress, code);
    element(doc, "party-lan-link").textContent = joinLink;
    drawQr(element(doc, "party-lan-qr", "canvas"), joinLink);
    const choices = element(doc, "party-lan-choices");
    choices.replaceChildren();
    if (options.length > 1)
      for (const option of options) {
        const button = doc.createElement("button");
        button.type = "button";
        button.className = "secondary";
        button.textContent = new URL(option).host;
        button.setAttribute("aria-pressed", String(option === selectedAddress));
        button.addEventListener("click", () => {
          selectedAddress = option;
          showLanShare(code);
        });
        choices.append(button);
      }
    element(doc, "party-lan-reach").textContent = isLoopback(selectedAddress)
      ? "This link only works on this computer. Choose a network address for phones on the same Wi-Fi."
      : "Everyone opens this same link, sets a name, and joins.";
    element(doc, "party-share-link", "button").hidden = typeof navigator.share !== "function";
    share.hidden = false;
  }
  function roomCode() {
    const bytes = crypto.getRandomValues(new Uint8Array(3));
    return [...bytes]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  }
  async function relayHere() {
    try {
      await Network.requireRelay();
      return true;
    } catch (error) {
      if (error instanceof Error && /no LAN relay|LAN address/.test(error.message)) return false;
      throw error;
    }
  }
  async function hostRoom() {
    const epoch = connectionAttempt;
    const code = roomCode();
    room.value = code;
    say("Opening your room...");
    const relay = await relayHere();
    if (epoch !== connectionAttempt) return;
    if (relay) {
      network.lan(true, code);
      return;
    }
    say("Opening one join link for this room…");
    await network.link(true, code);
  }
  async function joinRoom(text = room.value) {
    const epoch = connectionAttempt;
    const parsed = parseJoin(text);
    if (parsed && new URL(parsed.address).origin !== location.origin) {
      say("Opening the host's address…");
      location.assign(joinUrl(parsed.address, parsed.room));
      return;
    }
    const code = (parsed?.room ?? text).trim().toUpperCase();
    if (!/^[A-F0-9]{6}$/.test(code))
      throw new Error("Paste the join link or the six-character room code.");
    room.value = code;
    say(`Joining room ${code}...`);
    const relay = await relayHere();
    if (epoch !== connectionAttempt) return;
    if (relay) {
      network.lan(false, code);
      return;
    }
    await network.link(false, code);
  }
  async function applyScanned(text: string) {
    const join = parseJoin(text);
    if (join) {
      const target = new URL(joinUrl(join.address, join.room));
      if (target.origin !== location.origin) {
        say("Opening the host's address on this network…");
        location.assign(target.href);
        return;
      }
      if (active) throw new Error("Leave this party before joining another room.");
      room.value = join.room;
      say(`Joining room ${join.room}…`);
      await attempt(() => joinRoom(join.room), "party-lan-join");
      return;
    }
    throw new Error("That code is not a join link. Ask the host for the room link.");
  }
  async function scan() {
    const Detector = (
      globalThis as {
        BarcodeDetector?: new (options: { formats: string[] }) => {
          detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
        };
      }
    ).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia)
      throw new Error("This browser can't scan codes. Paste the join link instead.");
    stopScan();
    const epoch = scanning;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" } },
    });
    if (epoch !== scanning) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    scanStream = stream;
    const video = element(doc, "party-scan-video", "video");
    video.srcObject = stream;
    await video.play();
    element(doc, "party-scan-view").hidden = false;
    const detector = new Detector({ formats: ["qr_code"] });
    let busy = false;
    const tick = () => {
      if (epoch !== scanning) return;
      if (!busy && video.readyState >= 2) {
        busy = true;
        void detector
          .detect(video)
          .then(async (codes) => {
            const text = codes
              .map((code) => code.rawValue)
              .find((value) => /https?:\/\//i.test(value));
            if (!text || epoch !== scanning) return;
            stopScan();
            try {
              await applyScanned(text);
            } catch (error) {
              say(error instanceof Error ? error.message : "Connection failed.");
            }
          })
          .catch(() => undefined)
          .finally(() => {
            busy = false;
          });
      }
      if (epoch === scanning) scanTimer = window.setTimeout(tick, 200);
    };
    scanTimer = window.setTimeout(tick, 200);
  }
  const clicks: Record<string, () => void | Promise<void>> = {
    "party-lan-host": () => hostRoom(),
    "party-lan-join": () => joinRoom(),
    "party-copy-link": async () => {
      if (!joinLink) return;
      try {
        await navigator.clipboard.writeText(joinLink);
        say("Join link copied.");
      } catch {
        say("Select the join link and copy it.");
      }
    },
    "party-share-link": async () => {
      if (!joinLink || typeof navigator.share !== "function") return;
      try {
        await navigator.share({ title: "EMBERLINE", url: joinLink });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        throw error;
      }
    },
    "party-scan": () => scan(),
    "party-scan-stop": () => {
      stopScan();
      say("Scan stopped.");
    },
    "party-leave": () => leave(),
    "party-start": () => start(),
    "party-close": () => dialog.close(),
  };
  for (const [button, fn] of Object.entries(clicks)) {
    buttonLabels.set(button, element(doc, button).textContent ?? "");
    element(doc, button).addEventListener("click", () => {
      void attempt(fn, button);
    });
  }
  room.addEventListener("paste", (event) => {
    if (!(event instanceof ClipboardEvent)) return;
    const text = event.clipboardData?.getData("text") ?? "";
    const join = parseJoin(text);
    if (!join) return;
    event.preventDefault();
    room.value = joinUrl(join.address, join.room);
  });
  element(doc, "party").addEventListener("click", () => {
    refresh();
    dialog.showModal();
  });
  function start() {
    if (!run || !host) {
      say("The host starts and restarts the party run.");
      return;
    }
    if (run.countdown > 0 || run.world.mode === "countdown") return;
    if (run.world.mode === "paused") run.world.mode = "playing";
    else {
      Party.start(run, true);
      network.lock(true);
    }
    dismiss();
    publish();
    refresh();
  }
  if (/^https?:$/.test(location.protocol))
    void fetch("/host-info")
      .then(async (response) => (response.ok ? response.json() : null))
      .then((info: { desktop?: boolean; hosting?: boolean; addresses?: unknown } | null) => {
        if (!info?.hosting || !Array.isArray(info.addresses)) return;
        element(doc, "party-lan-instructions").textContent = info.desktop
          ? "LAN hosting starts automatically with this app. Host a room, then let teammates scan the join code or open its link. Keep the app open."
          : "LAN hosting is running for this web page. Host a room, then let teammates scan the join code or open its link. Keep this tab open.";
        advertised = info.addresses.filter(
          (address): address is string => typeof address === "string",
        );
        element(doc, "party-lan-addresses").textContent = advertised.join(" · ");
        if (host && /^[A-F0-9]{6}$/.test(room.value)) showLanShare(room.value);
      })
      .catch(() => {});
  dialog.addEventListener("close", () => stopScan());
  const linked = /^https?:$/.test(location.protocol) ? parseJoin(location.href) : null;
  if (linked) {
    room.value = linked.room;
    say(`Room ${linked.room} is ready. Set your name, then join.`);
    dialog.showModal();
    name.focus();
  }
  refresh();
  return {
    get active() {
      return active;
    },
    get isHost() {
      return host;
    },
    get run() {
      return run;
    },
    get localId() {
      return id;
    },
    get state() {
      return run ? Party.view(run, id) : null;
    },
    start,
    pause() {
      if (
        host &&
        run &&
        run.started &&
        run.countdown <= 0 &&
        run.world.mode !== "dead" &&
        run.world.mode !== "countdown"
      ) {
        run.world.mode = run.world.mode === "paused" ? "playing" : "paused";
        publish();
      }
    },
    action(action: Party.Action) {
      if (!active) return;
      if (host && run) Party.action(run, id, action);
      else if (run) {
        const next = ++sequence;
        pendingInputs.push({ sequence: next, action });
        if (pendingInputs.length > 12) pendingInputs.shift();
        network.toHost({ type: "input", action, sequence: next });
        Sync.follow(
          run,
          samples,
          id,
          pendingInputs,
          lastAck,
          hostClock.time + (performance.now() - hostClock.at) / 1000,
        );
      }
    },
    update(dt: number) {
      if (!active || !run) return;
      if (host) {
        Party.update(run, dt);
        const events = run.world.events.splice(0);
        pendingEvents.push(...events);
        unsentEvents.push(...events);
        elapsed += dt;
        if (elapsed >= Sync.sendInterval) {
          publish(unsentEvents.splice(0, 100));
          elapsed = 0;
        }
        account();
      } else {
        quiet += dt;
        if (quiet > 6) {
          leave("Connection timed out. Party ended; earned coins are saved.");
          return;
        }
        if (samples.length)
          Sync.follow(
            run,
            samples,
            id,
            pendingInputs,
            lastAck,
            hostClock.time + (performance.now() - hostClock.at) / 1000,
          );
      }
      refresh();
    },
    takeEvents() {
      return pendingEvents.splice(0);
    },
    takeCoins() {
      const coins = pendingCoins;
      pendingCoins = 0;
      return coins;
    },
    leave,
  };
}
