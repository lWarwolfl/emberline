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
  const economy = Economy.create(saves);
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
      state.mode = "menu";
      window.location.reload();
      return true;
    },
  );
  let best = saves.best();
  let lastTime = 0;
  let animationTime = 0;
  const feedback = { shake: 0, flash: 0 };

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
    if (state.mode !== "playing") return;
    state.mode = "paused";
    ui.showOverlay("paused", state);
  }

  function pause() {
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
    portal: [65, "#c5bbff", 95],
    pad: [45, "#9de9c2", 85],
    deflect: [16, "#fff0b4", 60],
    "enemy-shot": [5, "#ff8a93", 25],
    jump: [10, "#d3c294", 25],
    dash: [25, "#b6dbc3", 90],
    pickup: [12, "#ffcb7c", 50],
    smash: [32, "#b6dbc3", 90],
    hit: [25, "#ec9865", 75],
    death: [65, "#ffae62", 110],
  };

  function handleEvents() {
    let collected = 0n;
    for (const event of state.events.splice(0)) {
      if (event.coins) {
        collected += BigInt(event.coins);
      }
      if (event.points || event.type === "armor") popups.add(event);
      audio.play(event.type, state.combo);
      const burst = bursts[event.type];
      if (burst && !(reducedMotion && (event.type === "portal" || event.type === "pad")))
        particles.burst(event.x, event.y, ...burst);
      switch (event.type) {
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
        else Engine.jump(state);
      },
      dash() {
        audio.unlock();
        Engine.dash(state);
      },
      setup() {
        pauseIfPlaying();
        wardrobe.open();
      },
      attack() {
        audio.unlock();
        Engine.attack(state);
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
    renderer.draw(state, animationTime, particles.items, feedback, popups.items);
  }

  function frame(now: number) {
    const dt = Math.min(Config.maxFrameSeconds, Math.max(0, (now - lastTime) / 1000 || 0));
    lastTime = now;
    if (state.mode !== "paused") animationTime += dt;
    if (state.mode === "playing") {
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
    get coins() {
      return economy.balance;
    },
  };
}
export = { create };
