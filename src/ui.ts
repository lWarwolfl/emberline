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
  let announcementTime = 0;

  function render(state: GameState, best: bigint, coins = 0n) {
    el["coin-total"].textContent = coins.toString().padStart(4, "0");
    const weapon = Loadout.find(Loadout.weapons, state.loadout.weapon).short;
    const ready = state.attackCooldown <= 0;
    el.attack.textContent = "X / " + weapon;
    el.attack.disabled = state.mode !== "playing" || !ready;
    el["touch-attack"].textContent = weapon;
    el["combat-state"].textContent = weapon + (ready ? " READY" : " CHARGING");
    byId("jump-count").textContent = "×" + state.stats.maxJumps;
    byId("touch-jump").textContent =
      state.stats.maxJumps === 3 ? "JUMP / TRIPLE JUMP" : "JUMP / DOUBLE JUMP";
    el.score.textContent = format(state.score);
    el.best.textContent = format(best);
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

  function announce(message: string, seconds = 2.5) {
    el.announce.textContent = message;
    announcementTime = seconds;
  }

  function update(dt: number) {
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

  return { el, render, showOverlay, hideOverlay, announce, update, sound };
}
export = { create, format };
