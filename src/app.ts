import Config from "./config";
import Content from "./content";
import Engine from "./engine";
import Storage from "./storage";
import Audio from "./audio";
import Particles from "./particles";
import Renderer from "./renderer";
import UI from "./ui";
import Input from "./input";
import Popups from "./popups";
import Wardrobe from "./wardrobe";
import Economy from "./economy";
import * as PartySession from "./party-session";
import * as Accounts from "./accounts";
import { sameSave, saveKeys } from "./cloud-save";
import type { GameEvent } from "./types";

function create(doc: Document) {
  const ui = UI.create(doc);
  // Accessing window.localStorage itself can throw in restricted browsers.
  let storage;
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }
  const saves = Storage.create(storage);
  const audio = Audio.create(saves.muted());
  const particles = Particles.create();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = Renderer.create(ui.el.game, reducedMotion);
  const parameters = new URLSearchParams(location.search);
  const fixedSeed = parameters.get("seed");
  let economy = Economy.create(saves);
  let loadout = economy.enforce(saves.loadout());
  let state = Engine.create(fixedSeed ?? undefined, loadout, economy.levels);
  const popups = Popups.create(reducedMotion);
  const wardrobe = Wardrobe.create(
    doc,
    loadout,
    (updated) => {
      loadout = economy.enforce(updated);
      state.loadout = loadout;
      saves.write("loadout", JSON.stringify(loadout));
    },
    economy,
    () => {
      if (!saves.resetProgress()) return false;
      best = 0n;
      state = Engine.create(fixedSeed ?? undefined);
      economy = Economy.create(saves);
      loadout = economy.enforce({});
      doc
        .getElementById("setup-dialog")
        ?.querySelectorAll<HTMLButtonElement>("button")
        .forEach((button) => {
          button.disabled = true;
        });
      void accounts.sync().finally(() => window.location.reload());
      return true;
    },
  );
  let best = saves.best();
  let lastTime = 0;
  let animationTime = 0;
  const feedback = { shake: 0, flash: 0 };

  const session = PartySession.create(
    doc,
    () => ({ name: "Courier", loadout, levels: economy.levels }),
    () => {
      state = Engine.create(fixedSeed ?? undefined, loadout, economy.levels);
      partyMode = "menu";
      ui.el.start.removeAttribute("disabled");
      ui.el.heading.innerHTML = "KEEP THE<br><em>SIGNAL ALIVE.</em>";
      ui.el.description.innerHTML =
        "The city went dark. You kept running.<br>Carry the last ember as far as you can.";
      ui.el.start.innerHTML = "START RUN <span>↗</span>";
      ui.el.overlay.classList.remove("hidden");
    },
  );
  let partyMode = "menu";
  const accounts = Accounts.create(doc, {
    capture() {
      saveBest();
      return {
        ...saves.exportProgress(),
        economy: JSON.stringify(economy.snapshot()),
        loadout: JSON.stringify(loadout),
        best: best.toString(),
        muted: String(audio.muted),
        effects: String(particles.enabled),
      };
    },
    apply(data) {
      const restored = Object.fromEntries(saveKeys.map((key) => [key, data[key] ?? null]));
      if (sameSave(saves.exportProgress(), restored)) return;
      if (!saves.importProgress(restored))
        throw new Error("Could not restore your cloud save. Device storage is unavailable.");
      window.location.reload();
    },
    beforeOpen() {
      if (session.active && session.isHost && state.mode === "playing") session.pause();
      else pauseIfPlaying();
    },
    onStatus(message, user) {
      const summary = doc.getElementById("account-summary");
      if (summary) {
        summary.textContent = message;
        summary.title = message;
      }
      const hint = doc.querySelector("#account span");
      if (hint) hint.textContent = user ? "Your account / cloud save" : "Log in / create account";
    },
  });
  doc.getElementById("account")?.addEventListener("click", () => accounts.open());

  particles.setEnabled(saves.effects());
  ui.el.effects.checked = particles.enabled;
  ui.sound(audio.muted);
  ui.render(state, best, economy.balance);

  function saveBest() {
    if (state.score <= best) return;
    best = state.score;
    saves.write("best", best);
  }

  function start() {
    if (wardrobe.isOpen) return;
    if (session.active) {
      session.start();
      audio.unlock();
      ui.el.game.focus({ preventScroll: true });
      return;
    }
    audio.unlock();
    if (state.mode === "paused") state.mode = "playing";
    else {
      state = Engine.create(fixedSeed ?? undefined, loadout, economy.levels);
      state.mode = "playing";
      particles.clear();
      popups.clear();
      feedback.shake = 0;
      feedback.flash = 0;
      audio.play("start");
    }
    lastTime = performance.now();
    ui.hideOverlay();
    ui.el.game.focus({ preventScroll: true });
    ui.render(state, best, economy.balance);
  }

  function pauseIfPlaying() {
    if (session.active) return;
    if (state.mode !== "playing") return;
    state.mode = "paused";
    ui.showOverlay("paused", state);
  }

  function pause() {
    if (session.active) {
      session.pause();
      return;
    }
    if (state.mode === "paused") start();
    else pauseIfPlaying();
  }

  async function fullscreen() {
    try {
      if (doc.fullscreenElement) await doc.exitFullscreen();
      else await ui.el.shell.requestFullscreen();
    } catch {
      ui.announce("Fullscreen unavailable here. Try Play.cmd or F11.", 4);
    }
  }

  function toggleSound() {
    audio.unlock();
    audio.setMuted(!audio.muted);
    saves.write("muted", audio.muted);
    ui.sound(audio.muted);
    if (!audio.muted) audio.play("pickup");
  }

  const bursts: Record<string, [number, string, number]> = {
    revive: [65, "#b1ffe3", 100],
    front: [20, "#9ee9ec", 50],
    down: [35, "#ec9865", 65],
    portal: [65, "#c5bbff", 95],
    pad: [45, "#9de9c2", 85],
    deflect: [16, "#fff0b4", 60],
    "enemy-shot": [5, "#ff8a93", 25],
    jump: [10, "#d3c294", 25],
    dash: [25, "#b6dbc3", 90],
    pickup: [12, "#ffcb7c", 50],
    heal: [18, "#a6e4d1", 40],
    "powerup-pickup": [22, "#e9cd91", 50],
    powerup: [35, "#ffae62", 75],
    explosion: [40, "#ffae62", 90],
    smash: [32, "#b6dbc3", 90],
    hit: [25, "#ec9865", 75],
    death: [65, "#ffae62", 110],
  };

  function handleEvents(events: GameEvent[] = state.events.splice(0), partyEvents = false) {
    let collected = 0n;
    for (const event of events) {
      if (event.coins && !partyEvents) {
        collected += BigInt(event.coins);
      }
      if (
        event.points ||
        event.type === "armor" ||
        event.type === "heal" ||
        event.type === "powerup"
      )
        popups.add(event);
      audio.play(event.type, state.combo);
      const burst = event.label === "BLAST" ? bursts.explosion : bursts[event.type];
      if (burst && !(reducedMotion && ["portal", "pad", "revive", "front"].includes(event.type)))
        particles.burst(event.x, event.y, ...burst);
      switch (event.type) {
        case "heal":
        case "powerup-pickup":
        case "powerup":
          ui.announce(event.label ?? "POWER-UP", 2);
          break;
        case "revive":
        case "front":
        case "down":
          ui.announce(event.label ?? "COURIER DOWN / DASH A BEACON TO REVIVE", 2.5);
          break;
        case "portal":
        case "pad":
          feedback.shake = event.type === "portal" ? 4 : 2;
          ui.announce(event.label ?? "SHORTCUT", 2.5);
          break;
        case "smash":
          feedback.shake = 4;
          break;
        case "hit":
          feedback.shake = 6;
          feedback.flash = 0.25;
          break;
        case "death":
          feedback.shake = 10;
          saveBest();
          ui.showOverlay("dead", state);
          break;
        case "boss":
          ui.announce("BOSS / " + (event.label || "APPROACHING"));
          particles.burst(240, 40, 40, "#e2b15a", 70);
          feedback.shake = 5;
          break;
        case "sector":
          ui.announce(
            "SECTOR " +
              state.sector +
              " / " +
              Content.biomes.find((biome) => biome.id === state.biome)!.name,
          );
          particles.burst(240, 25, 25, "#ffae62", 50);
          break;
        case "pace":
          ui.announce(
            Content.paces.find((pace) => pace.id === state.pace)!.name + " / PACE SHIFT",
            1.6,
          );
          break;
      }
    }
    if (collected) economy.credit(collected);
  }

  Input.bind(
    doc,
    {
      start,
      pause,
      fullscreen,
      sound: toggleSound,
      pauseIfPlaying,
      enter() {
        if (state.mode !== "playing") start();
      },
      escape: pauseIfPlaying,
      jump() {
        audio.unlock();
        if (state.mode === "menu" || state.mode === "dead") start();
        else if (session.active) session.action("jump");
        else Engine.jump(state);
      },
      dash() {
        audio.unlock();
        if (session.active) session.action("dash");
        else Engine.dash(state);
      },
      front() {
        session.action("front");
      },
      setup() {
        if (session.active) {
          ui.announce("Leave the party to change your gear. Host difficulty applies to the party.");
          return;
        }
        pauseIfPlaying();
        wardrobe.open();
      },
      attack() {
        audio.unlock();
        if (session.active) session.action("attack");
        else Engine.attack(state);
      },
      powerup() {
        audio.unlock();
        if (session.active) session.action("powerup");
        else Engine.powerup(state);
      },
      effects(enabled) {
        particles.setEnabled(enabled);
        saves.write("effects", enabled);
      },
    },
    ui.el.game,
  );

  doc.addEventListener("fullscreenchange", () => {
    ui.el.fullscreen.textContent = doc.fullscreenElement ? "⛶ WINDOWED" : "⛶ FULLSCREEN";
  });

  function draw() {
    renderer.draw(
      state,
      animationTime,
      particles.items,
      feedback,
      popups.items,
      session.active ? session.run : null,
      session.localId,
    );
  }

  function frame(now: number) {
    const dt = Math.min(Config.maxFrameSeconds, Math.max(0, (now - lastTime) / 1000 || 0));
    lastTime = now;
    if (state.mode !== "paused") animationTime += dt;
    if (session.active) {
      session.update(dt);
      const shared = session.state;
      if (shared) {
        state = shared;
        const coins = session.takeCoins();
        if (coins) economy.credit(BigInt(coins));
        handleEvents(session.takeEvents(), true);
        if (state.mode !== partyMode) {
          if (state.mode === "playing") ui.hideOverlay();
          else if (state.mode === "paused" || state.mode === "dead")
            ui.showOverlay(state.mode, state);
          partyMode = state.mode;
        }
      }
    } else if (state.mode === "playing") {
      Engine.update(state, dt);
      handleEvents();
      if (Math.random() < dt * 24)
        particles.burst(
          state.player.x - 3,
          state.player.y + 12,
          1,
          state.dash > 0 ? "#b6dbc3" : "#e5a161",
          10,
        );
    }
    if (state.mode !== "paused") {
      particles.update(dt);
      popups.update(dt, state.runSpeed);
      feedback.shake = Math.max(0, feedback.shake - dt * 25);
      feedback.flash = Math.max(0, feedback.flash - dt * 1.4);
      ui.update(dt);
    }
    ui.render(state, best, economy.balance);
    if (session.active) {
      ui.el.pause.toggleAttribute("disabled", !session.isHost);
      const local = session.run?.members.find((m) => m.id === session.localId);
      if (local && local.state.hits >= local.state.health && state.mode === "playing") {
        ui.el.status.textContent = "DOWN / SPECTATING · TEAMMATE DASHES A BEACON TO REVIVE";
        ui.el.attack.disabled = true;
      }
    } else ui.el.pause.removeAttribute("disabled");
    draw();
    wardrobe.draw(now / 1000);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
  return {
    get state() {
      return state;
    },
    start,
    pause,
    draw,
    particles,
    audio,
    popups,
    wardrobe,
    economy,
    session,
    accounts,
    get coins() {
      return economy.balance;
    },
  };
}
export = { create };
