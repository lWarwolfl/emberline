import { element } from "./dom";
import type { Mode } from "./types";
import type { GameState } from "./types";
import Content from "./content";
import Loadout from "./loadout";
import Ships from "./ships";
import PowerupHud from "./powerup-hud";
import Shield from "./shield";

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
  const powerStatus = byId("powerup-active");
  const renderPowers = PowerupHud.create(doc, powerStatus);
  const flightControls = byId("ship-controls");
  const shipName = byId("ship-name");
  const shipBrief = byId("ship-brief");
  const deathDonate = byId("death-donate");
  const bossHealth = byId("boss-health");
  const bossCells = Array.from(byId("boss-meter").querySelectorAll<HTMLElement>("b"));
  let isSupporter = false;
  let announcementTime = 0;
  let countdownDigit = "";
  let countdownGoTime = 0;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const countdownRoot = element(doc, "countdown");
  const countdownFigure = element(doc, "countdown-digit");
  const countdownMeter = element(doc, "countdown-meter", "span").firstElementChild as HTMLElement;

  function render(state: GameState, best: bigint, coins = 0n) {
    renderPowers(state);
    byId("round-results").hidden = state.mode !== "dead";
    const shieldRatio = Math.max(0, Math.min(1, state.shield.charge / state.stats.shieldCapacity));
    const shieldStatus = byId("shield-status");
    shieldStatus.firstChild!.textContent = state.shield.broken
      ? "SHIELD EMPTY "
      : Shield.active(state)
        ? "K / SHIELD ACTIVE "
        : shieldRatio < 1
          ? "K / RECHARGING "
          : "K / SHIELD READY ";
    byId("shield-charge").querySelector<HTMLElement>("i")!.style.transform =
      `scaleX(${shieldRatio})`;
    byId("shield-charge").setAttribute("aria-valuenow", String(Math.round(shieldRatio * 100)));
    const boss = state.objects.find((o) => o.variant === "boss" && !o.dead && (o.hp ?? 0) > 0);
    bossHealth.hidden = !boss || state.mode === "menu" || state.mode === "dead";
    if (boss) {
      const id = boss.bossId ?? "warden";
      bossHealth.className = "boss-health boss-" + id;
      const current = Math.max(0, boss.hp ?? 0),
        max = Math.max(1, boss.maxHp ?? current);
      const ratio = Math.min(1, current / max);
      byId("boss-name").textContent = id.toUpperCase();
      byId("boss-hp").textContent = `${Math.ceil(current)} / ${Math.ceil(max)}`;
      byId("boss-meter").setAttribute("aria-label", id + " health");
      byId("boss-meter").setAttribute("aria-valuenow", String(Math.round(ratio * 100)));
      for (const [i, cell] of bossCells.entries())
        cell.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio * 12 - i))})`;
    }
    deathDonate.hidden = state.mode !== "dead";
    const ship = state.ship;
    const inFlight = Boolean(
      ship && ship.phase !== "crash" && state.mode === "playing" && state.hits < state.health,
    );
    flightControls.hidden = !inFlight;
    el.shell.classList.toggle("in-flight", Boolean(ship));
    if (ship && inFlight) {
      shipName.textContent = Ships.catalog[ship.id].name.toUpperCase();
      shipBrief.hidden = ship.phase !== "launch" && ship.wave > 0;
    }
    el["coin-total"].textContent = coins.toString().padStart(4, "0");
    const weapon = ship ? "CANNON" : Loadout.find(Loadout.weapons, state.loadout.weapon).short;
    const ready = state.attackCooldown <= 0;
    el.attack.textContent = "X / " + weapon;
    el.attack.disabled = state.mode !== "playing" || !ready;
    el["touch-attack"].textContent = weapon;
    el["combat-state"].textContent =
      ship?.phase === "crash" ? "HULL FAILING" : weapon + (ready ? " READY" : " CHARGING");
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
    deathDonate.hidden = mode !== "dead";
    byId("round-results").hidden = mode !== "dead";
    el.overlay.classList.toggle("has-results", mode === "dead");
    deathDonate.querySelector("strong")!.textContent = isSupporter
      ? "YOUR FLAMEBOUND COLLECTION"
      : "FUEL THE EMBER";
    deathDonate.querySelector("span")!.textContent = isSupporter
      ? "Equip your supporter skins / keep the signal alive"
      : "Donate any amount / unlock both fiery skins";
    if (mode === "dead") {
      el.eyebrow.textContent = "TRANSMISSION LOST / SECTOR " + state.sector;
      el.heading.innerHTML = "ONE MORE<br><em>SPARK.</em>";
      byId("round-score").textContent = state.score.toString();
      byId("round-coins").textContent = state.embers.toString();
      el.description.textContent = `${Math.floor(state.distance)} m travelled. A new route is waiting.`;
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
    deathDonate.hidden = true;
    byId("round-results").hidden = true;
    el.overlay.classList.add("hidden");
    el.pause.textContent = "Ⅱ PAUSE";
    announce("", 0);
  }

  return {
    el,
    supporter(value: boolean) {
      isSupporter = value;
    },
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
