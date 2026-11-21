import type { GameState, WorldObject } from "./types";
import Config from "./config";
import Combat from "./combat";
import Random from "./random";

const catalog = [
  { id: "blast", name: "Chain blast", rarity: "rare", duration: 0, weight: 25, color: "#ffcf83" },
  { id: "magnet", name: "Ember magnet", rarity: "rare", duration: 8, weight: 24, color: "#f8a782" },
  { id: "overclock", name: "Overclock", rarity: "rare", duration: 7, weight: 18, color: "#91e7ff" },
  { id: "titan", name: "Titan", rarity: "epic", duration: 10, weight: 15, color: "#eac5fb" },
  { id: "shield", name: "Prism shield", rarity: "epic", duration: 6, weight: 12, color: "#9bf1bf" },
  {
    id: "flight",
    name: "Jet flight",
    rarity: "legendary",
    duration: 12,
    weight: 6,
    color: "#ffe3a8",
  },
] as const;

function definition(id: string) {
  return catalog.find((item) => item.id === id);
}
function drop(state: GameState) {
  return Random.weighted(state.rng, catalog);
}
function collect(state: GameState, object: WorldObject) {
  if (object.dead || state.mode !== "playing" || state.hits >= state.health) return false;
  if (object.kind === "heart") {
    object.dead = true;
    state.hits = Math.max(0, state.hits - (object.rarity === "rare" ? 2 : 1));
    state.events.push({
      type: "heal",
      x: object.x,
      y: object.y,
      label: object.rarity === "rare" ? "+2 HEARTS" : "+1 HEART",
    });
    return true;
  }
  const item = object.kind === "powerup" && definition(object.variant);
  if (!item) return false;
  object.dead = true;
  if (item.id === "blast") {
    for (const target of state.objects) {
      const visible =
        target.x + target.w > 0 &&
        target.x < state.stats.blastReach &&
        target.y + target.h > 0 &&
        target.y < Config.height;
      if (visible && (target.kind === "enemy" || target.kind === "hazard"))
        Combat.damage(state, target, 10000, "blast");
    }
  } else {
    state.activePowerups[item.id] = item.duration * state.stats.powerDuration;
    if (item.id === "flight") state.grounding = false;
  }
  state.events.push({ type: "powerup", x: object.x, y: object.y, label: item.name.toUpperCase() });
  return true;
}

function attracts(state: GameState, object: WorldObject) {
  return (
    state.activePowerups.magnet &&
    object.kind === "ember" &&
    Math.hypot(object.x + object.w / 2 - state.player.x - 6, object.y - state.player.y - 9) <=
      state.stats.magnetRadius
  );
}

function update(state: GameState, dt: number) {
  for (const { id } of catalog) {
    const remaining = state.activePowerups[id];
    if (remaining === undefined) continue;
    if (remaining <= dt) delete state.activePowerups[id];
    else state.activePowerups[id] = remaining - dt;
  }
  if (state.activePowerups.flight && !state.ship) {
    const player = state.player;
    player.vy = Math.min(28, player.vy - Config.gravity * dt * 0.82);
    if (player.y > Config.floor - 45) {
      player.y = Config.floor - 45;
      player.vy = 0;
    }
    if (player.y < 25) {
      player.y = 25;
      player.vy = Math.max(0, player.vy);
    }
    player.jumps = 0;
  }
}
function land(state: GameState, previousY: number, dt: number) {
  const p = state.player;
  if (p.vy < 0 || state.grounding || state.activePowerups.flight) return;
  for (const o of state.objects) {
    if (o.kind !== "platform" || o.dead) continue;
    if (
      p.x + 12 > o.x - state.runSpeed * dt &&
      p.x < o.x + o.w &&
      previousY + 18 <= o.y + 1 &&
      p.y + 18 >= o.y
    ) {
      p.y = o.y - 18;
      p.vy = 0;
      p.jumps = 0;
    }
  }
}
export = { catalog, definition, drop, collect, update, attracts, land };
