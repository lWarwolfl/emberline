import * as Party from "./party";
import Config from "./config";
import * as Network from "./party-network";
import { element } from "./dom";
import type { GameEvent } from "./types";

export function create(doc: Document, getProfile: () => Party.Profile, ended: () => void) {
  const dialog = element(doc, "party-dialog", "dialog");
  const status = element(doc, "party-message");
  const output = element(doc, "party-output", "textarea");
  const input = element(doc, "party-input", "textarea");
  const name = element(doc, "party-name", "input");
  const room = element(doc, "party-room", "input");
  const roster = element(doc, "party-roster");
  const hud = element(doc, "party-hud");
  const beaconProgress = element(doc, "beacon-progress", "progress");
  const beaconDistance = element(doc, "beacon-distance", "span");
  const startButton = element(doc, "party-start", "button");
  const front = element(doc, "touch-front", "button");
  let run: Party.PartyRun | null = null;
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
  const inputs = new Map<string, { seq: number; time: number; count: number }>();
  function say(text: string) {
    status.textContent = text;
  }
  function localProfile() {
    return Party.profile({ ...getProfile(), name: name.value });
  }
  function refresh() {
    const members = run ? Party.sorted(run) : [];
    startButton.disabled = !host || !run || run.world.mode === "playing";
    element(doc, "party-leave", "button").disabled = !active;
    element(doc, "party-invite", "button").disabled = !host || !run || run.started;
    for (const key of ["party-host", "party-lan-host", "party-lan-join", "party-answer"])
      element(doc, key, "button").disabled = active;
    front.hidden = !active;
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
          `${m.id}|${m.name}|${m.connected}|${m.state.hits}|${m.state.health}|${Object.values(m.state.stats.levels)}|${m.frontCooldown > 0}|${m.id === id}`,
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
    const local = run?.members.find((m) => m.id === id);
    front.disabled =
      !run ||
      run.world.mode !== "playing" ||
      !local ||
      !Party.alive(local) ||
      local.frontCooldown > 0 ||
      Party.sorted(run).find(Party.alive)?.id === id;
    front.textContent =
      local && local.frontCooldown > 0 ? "TAKE POINT · CHARGING" : "T / TAKE POINT";
    const desktopFront = element(doc, "take-front", "button");
    desktopFront.hidden = !active;
    desktopFront.disabled = front.disabled;
    desktopFront.textContent = front.textContent;
    const mainStart = element(doc, "start", "button");
    if (active) {
      mainStart.disabled = !host;
      mainStart.textContent = host
        ? run?.started
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
    network.broadcast({ type: "state", snapshot: Party.encode(run), eventId, events });
  }
  function account() {
    if (!run) return;
    pendingCoins += Math.max(0, run.earned - earned);
    earned = run.earned;
  }
  function leave(message = "Party closed. Your solo progress is saved.") {
    network.close();
    active = false;
    run = null;
    pendingEvents = [];
    unsentEvents = [];
    pendingCoins = 0;
    earned = 0;
    inputs.clear();
    fingerprint = "";
    output.value = "";
    input.value = "";
    say(message);
    refresh();
    ended();
  }
  const network = Network.create({
    status: say,
    ready(playerId, hosting, code) {
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
      if (/^[A-F0-9]{6}$/.test(code)) room.value = code;
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
            !["jump", "dash", "attack", "front"].includes(data.action) ||
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
          run = received;
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
  async function attempt(fn: () => void | Promise<void>) {
    try {
      await fn();
    } catch (error) {
      say(error instanceof Error ? error.message : "Connection failed.");
    }
    refresh();
  }
  function markDirect(id: string, index: number) {
    const items = [...element(doc, id).querySelectorAll("li")];
    for (const [i, item] of items.entries()) item.classList.toggle("is-current", i === index);
  }
  function setDirectRole(hosting: boolean) {
    element(doc, "party-role-host", "button").setAttribute("aria-pressed", String(hosting));
    element(doc, "party-role-join", "button").setAttribute("aria-pressed", String(!hosting));
    element(doc, "party-host-steps").hidden = !hosting;
    element(doc, "party-join-steps").hidden = hosting;
    element(doc, "party-host-actions").hidden = !hosting;
    element(doc, "party-join-actions").hidden = hosting;
    element(doc, "party-accept-actions").hidden = !hosting;
    const flow = element(doc, "party-direct-flow");
    const order = hosting
      ? [
          "party-host-actions",
          "party-output-field",
          "party-copy-actions",
          "party-input-field",
          "party-accept-actions",
        ]
      : ["party-input-field", "party-join-actions", "party-output-field", "party-copy-actions"];
    for (const id of order) flow.append(element(doc, id));
    element(doc, "party-input-label").textContent = hosting
      ? "ANSWER FROM TEAMMATE"
      : "INVITE FROM HOST";
    element(doc, "party-output-label").textContent = hosting
      ? "INVITE TO SEND"
      : "ANSWER TO SEND BACK";
    markDirect(hosting ? "party-host-steps" : "party-join-steps", 0);
  }
  function openDirect(hosting: boolean) {
    const details = element(doc, "party-direct", "details");
    details.open = true;
    setDirectRole(hosting);
    details.scrollIntoView({ block: "nearest" });
  }
  async function connectLan(hosting: boolean, roomCode: string) {
    if (!/^https?:$/.test(location.protocol))
      throw new Error("Start npm run host and open its LAN address first.");
    const address = hosting ? "" : element(doc, "party-address", "input").value;
    try {
      await Network.requireRelay(address);
    } catch (error) {
      if (error instanceof Error && error.message.includes("no LAN relay")) openDirect(hosting);
      throw error;
    }
    network.lan(hosting, roomCode, address);
  }
  const clicks: Record<string, () => void | Promise<void>> = {
    "party-host": () => {
      network.host();
      markDirect("party-host-steps", 1);
    },
    "party-invite": async () => {
      say("Preparing a unique invite for the next teammate…");
      output.value = await network.offer();
      markDirect("party-host-steps", 2);
      say(
        "Send this whole invite to one teammate. When their answer comes back, paste it and accept it.",
      );
    },
    "party-answer": async () => {
      say("Preparing answer…");
      output.value = await network.answer(input.value);
      markDirect("party-join-steps", 2);
      say("Copy this answer and send the whole code back to the host. Stay on this page.");
    },
    "party-accept": async () => {
      const button = element(doc, "party-accept", "button");
      const code = input.value.trim();
      if (!code) {
        input.focus();
        throw new Error("Paste their answer in the box above Accept Answer.");
      }
      const label = button.textContent;
      button.textContent = "ACCEPTING…";
      say("Checking their answer…");
      try {
        await network.accept(code);
        input.value = "";
        markDirect("party-host-steps", 3);
        say("Answer accepted. Waiting for your teammate to appear in the crew.");
      } finally {
        button.textContent = label;
      }
    },
    "party-cancel-invites": () => {
      network.cancelPending();
      output.value = "";
      say("Pending invites cancelled. Connected teammates remain.");
    },
    "party-role-host": () => setDirectRole(true),
    "party-role-join": () => setDirectRole(false),
    "party-lan-host": () => connectLan(true, ""),
    "party-lan-join": () => {
      if (!/^[A-Fa-f0-9]{6}$/.test(room.value.trim()))
        throw new Error("Enter the six-character LAN room code.");
      return connectLan(false, room.value);
    },
    "party-copy": async () => {
      if (!output.value) return;
      try {
        await navigator.clipboard.writeText(output.value);
        say("Code copied.");
      } catch {
        output.focus();
        output.select();
        say("Code selected. Press Ctrl+C to copy.");
      }
    },
    "party-leave": () => leave(),
    "party-start": () => {
      start();
      dialog.close();
    },
    "party-close": () => dialog.close(),
  };
  for (const [button, fn] of Object.entries(clicks))
    element(doc, button).addEventListener("click", () => {
      void attempt(fn);
    });
  element(doc, "party-direct").addEventListener("paste", (event) => {
    if (!(event instanceof ClipboardEvent) || event.target === input) return;
    const text = event.clipboardData?.getData("text") ?? "";
    if (!text.includes("EMBER7.")) return;
    event.preventDefault();
    input.value = text;
    input.focus();
    say("Pasted the code into the box. Use the button under it.");
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
    if (run.world.mode === "paused") run.world.mode = "playing";
    else {
      Party.start(run);
      network.lock(true);
    }
    publish();
    refresh();
  }
  if (/^https?:$/.test(location.protocol))
    void fetch("/host-info")
      .then(async (response) => (response.ok ? response.json() : null))
      .then((info: { desktop?: boolean; hosting?: boolean; addresses?: unknown } | null) => {
        if (!info?.hosting || !Array.isArray(info.addresses)) return;
        element(doc, "party-lan-instructions").textContent = info.desktop
          ? "LAN hosting starts automatically with this app. Host a room, then share one of these addresses and its room code. Keep the app open."
          : "LAN hosting is running for this web page. Host a room, then share one of these addresses and its room code. Keep this tab open.";
        element(doc, "party-lan-addresses").textContent = info.addresses
          .filter((address): address is string => typeof address === "string")
          .join(" · ");
      })
      .catch(() => {});
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
      if (host && run && run.started && run.world.mode !== "dead") {
        run.world.mode = run.world.mode === "paused" ? "playing" : "paused";
        publish();
      }
    },
    action(action: Party.Action) {
      if (!active) return;
      if (host && run) Party.action(run, id, action);
      else network.toHost({ type: "input", action, sequence: ++sequence });
    },
    update(dt: number) {
      if (!active || !run) return;
      if (host) {
        Party.update(run, dt);
        const events = run.world.events.splice(0);
        pendingEvents.push(...events);
        unsentEvents.push(...events);
        elapsed += dt;
        if (elapsed >= 1 / 20) {
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
