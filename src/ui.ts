import { element } from "./dom";
import type { Mode } from "./types";
import type { GameState } from "./types";
import Content from "./content";
import Loadout from "./loadout";

const format = (value: bigint | number) => value.toString().padStart(6, "0");

function create(doc: Document) {
  const byId = (id: string) => element(doc, id);
  const ids = [
    "score",
    "coin-total",
    "attack",
    "combat-state",
    "touch-attack",
    "best",
    "sector",
    "zone",
    "velocity",
    "pace",
    "dash-state",
    "status",
    "overlay",
    "eyebrow",
    "heading",
    "description",
    "start",
    "pause",
    "sound",
    "fullscreen",
    "effects",
    "announce",
    "shell",
    "game",
  ] as const;
  const el = {
    ...(Object.fromEntries(ids.map((id) => [id, byId(id)])) as Record<
      (typeof ids)[number],
      HTMLElement
    >),
    game: element(doc, "game", "canvas"),
    effects: element(doc, "effects", "input"),
    attack: element(doc, "attack", "button"),
  };
  const dashBar = el["dash-state"].querySelector("i")!;
  const powerupButton = element(doc, "powerup", "button");
  const touchPowerup = element(doc, "touch-powerup", "button");
  const queue = element(doc, "powerup-queue");
  const powerupNames = { blast: "BLAST", titan: "TITAN", flight: "FLIGHT" };
  const powerupRarities = { blast: "rare", titan: "epic", flight: "legendary" };
  let queueSignature = "";
  let announcementTime = 0;
  let countdownDigit = "";
  let countdownGoTime = 0;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const countdownRoot = element(doc, "countdown");
  const countdownFigure = element(doc, "countdown-digit");
  const countdownMeter = element(doc, "countdown-meter", "span").firstElementChild as HTMLElement;

  function render(state: GameState, best: bigint, coins = 0n) {
    const signature = state.powerups.join(",");
    if (signature !== queueSignature || !queue.children[0]?.hasAttribute("data-slot")) {
      queueSignature = signature;
      queue.replaceChildren(
        ...Array.from({ length: 3 }, (_, i) => {
          const slot = doc.createElement("li");
          const id = state.powerups[i];
          slot.dataset.slot = String(i + 1);
          slot.textContent = id ? powerupNames[id] : "—";
          slot.setAttribute("aria-label", `Slot ${i + 1}: ${id ? powerupNames[id] : "empty"}`);
          if (id) {
            slot.dataset.rarity = powerupRarities[id];
            slot.title = `${powerupRarities[id]} · ${i === 0 ? "Next to activate" : "Queued"}`;
          }
          return slot;
        }),
      );
    }
    byId("powerup-count").textContent = `${state.powerups.length} / 3`;
    const active = state.activePowerup;
    const powerReady =
      state.mode === "playing" &&
      state.hits < state.health &&
      state.powerups.length > 0 &&
      !active &&
      !(state.grounding && state.powerups[0] === "flight");
    powerupButton.disabled = !powerReady;
    touchPowerup.disabled = !powerReady;
    powerupButton.textContent = "C / USE";
    touchPowerup.textContent = state.powerups[0] ? powerupNames[state.powerups[0]] : "POWER-UP";
    byId("powerup-active").textContent = active
      ? `${powerupNames[active.id]} · ${Math.ceil(active.remaining)}s`
      : state.powerups.length
        ? "Activate in order · C"
        : "Collect rare drops along the route.";
    el["coin-total"].textContent = coins.toString().padStart(4, "0");
    const weapon = Loadout.find(Loadout.weapons, state.loadout.weapon).short;
    const ready = state.attackCooldown <= 0;
    el.attack.textContent = "X / " + weapon;
    el.attack.disabled = state.mode !== "playing" || !ready;
    el["touch-attack"].textContent = weapon;
    el["combat-state"].textContent = weapon + (ready ? " READY" : " CHARGING");
    byId("jump-count").textContent = "×" + state.stats.maxJumps;
    byId("touch-jump").textContent = "JUMP ×" + state.stats.maxJumps;
    el.score.textContent = format(state.score);
    el.best.textContent = format(state.score > best ? state.score : best);
    el.sector.textContent = "SECTOR " + String(state.sector).padStart(2, "0");
    const biome = Content.biomes.find((item) => item.id === state.biome)!;
    const group = Content.groups.find((item) => item.biomes.some((entry) => entry.id === biome.id));
    el.zone.textContent = state.bossActive ? "BOSS / " + group!.boss : biome.name;
    el.velocity.textContent = Math.round(state.runSpeed) + " PX/S";
    el.pace.textContent =
      Content.paces.find((item) => item.id === state.pace)!.name +
      (state.rules.coinReward ? ` / ×${state.rules.coinReward} COINS` : " / NO COINS");
    el["dash-state"].firstChild!.textContent =
      state.cooldown > 0 ? "DASH CHARGING " : "DASH READY ";
    dashBar.style.transform = `scaleX(${1 - state.cooldown / state.stats.dashCooldown})`;
    if (state.mode === "playing")
      el.status.textContent = `${state.health - state.hits} INTEGRITY / ${state.embers} ${state.embers === 1 ? "COIN" : "COINS"}`;
  }

  function showOverlay(mode: Mode, state: GameState) {
    el.overlay.classList.remove("hidden");
    if (mode === "dead") {
      el.eyebrow.textContent = "TRANSMISSION LOST / SECTOR " + state.sector;
      el.heading.innerHTML = "ONE MORE<br><em>SPARK.</em>";
      el.description.innerHTML = `${format(state.score)} points · ${state.embers} coins · ${Math.floor(state.distance)} m<br>A new route is waiting. Run it again.`;
      el.start.innerHTML = "RUN AGAIN <span>↗</span>";
      el.status.textContent = "COURIER OFFLINE";
    } else {
      el.eyebrow.textContent = "TRANSMISSION ON HOLD";
      el.heading.innerHTML = "TAKE A<br><em>BREATHER.</em>";
      el.description.innerHTML = "Your ember is safe here.<br>Resume when you’re ready.";
      el.start.innerHTML = "RESUME RUN <span>↗</span>";
      el.status.textContent = "SIGNAL PAUSED";
    }
    el.pause.textContent = mode === "paused" ? "▶ RESUME" : "Ⅱ PAUSE";
  }

  function countdown(seconds: number) {
    countdownGoTime = 0;
    countdownRoot.classList.remove("is-go");
    countdownRoot.hidden = false;
    const digit = String(Math.ceil(seconds));
    const fraction = seconds - (Math.ceil(seconds) - 1);
    countdownMeter.style.transform = `scaleX(${Math.max(0, Math.min(1, fraction))})`;
    if (digit === countdownDigit) return false;
    countdownDigit = digit;
    countdownFigure.textContent = digit;
    countdownRoot.setAttribute("aria-label", `Starting in ${digit}`);
    if (!reducedMotion) {
      countdownFigure.classList.remove("mark");
      void countdownFigure.offsetWidth;
      countdownFigure.classList.add("mark");
    }
    return true;
  }

  function countdownGo() {
    countdownDigit = "GO";
    countdownRoot.hidden = false;
    countdownRoot.classList.add("is-go");
    countdownFigure.textContent = "GO";
    countdownFigure.classList.remove("mark");
    countdownRoot.setAttribute("aria-label", "Go");
    countdownMeter.style.transform = "scaleX(0)";
    countdownGoTime = reducedMotion ? 0.2 : 0.45;
  }

  function hideCountdown() {
    countdownGoTime = 0;
    countdownDigit = "";
    countdownRoot.hidden = true;
    countdownRoot.classList.remove("is-go");
  }

  function announce(message: string, seconds = 2.5) {
    el.announce.textContent = message;
    announcementTime = seconds;
  }

  function update(dt: number) {
    if (countdownGoTime > 0) {
      countdownGoTime -= dt;
      if (countdownGoTime <= 0) hideCountdown();
    }
    if (announcementTime <= 0) return;
    announcementTime -= dt;
    if (announcementTime <= 0) el.announce.textContent = "";
  }

  function sound(muted: boolean) {
    el.sound.textContent = muted ? "SOUND OFF" : "SOUND ON";
    el.sound.setAttribute("aria-pressed", String(!muted));
  }

  function hideOverlay() {
    el.overlay.classList.add("hidden");
    el.pause.textContent = "Ⅱ PAUSE";
    announce("", 0);
  }

  return {
    el,
    render,
    showOverlay,
    hideOverlay,
    countdown,
    countdownGo,
    hideCountdown,
    announce,
    update,
    sound,
  };
}
export = { create, format };
