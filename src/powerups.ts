import type { GameState, PowerupId, WorldObject } from "./types";
import Config from "./config";
import Combat from "./combat";
const catalog = [
  { id: "blast", name: "Chain blast", rarity: "rare", duration: 0 },
  { id: "titan", name: "Titan", rarity: "epic", duration: 10 },
  { id: "flight", name: "Jet flight", rarity: "legendary", duration: 12 },
] as const;
function activate(state: GameState) {
  if (
    state.mode !== "playing" ||
    state.hits >= state.health ||
    state.activePowerup ||
    (state.grounding && state.powerups[0] === "flight") ||
    !state.powerups.length
  )
    return false;
  const id = state.powerups.shift()!;
  const item = catalog.find((p) => p.id === id)!;
  if (id === "blast") {
    for (const o of state.objects)
      if (
        o.kind === "enemy" &&
        o.x + o.w > 0 &&
        o.x < Config.width &&
        o.y + o.h > 0 &&
        o.y < Config.height
      )
        Combat.damage(state, o, 10000, "blast");
  } else state.activePowerup = { id, remaining: item.duration };
  state.events.push({
    type: "powerup",
    x: state.player.x,
    y: state.player.y,
    label: item.name.toUpperCase(),
  });
  return true;
}
function collect(state: GameState, object: WorldObject) {
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
  if (object.kind === "powerup") {
    if (state.powerups.length >= 3) return true;
    object.dead = true;
    state.powerups.push(object.variant as PowerupId);
    state.events.push({ type: "powerup", x: object.x, y: object.y, label: "POWER STORED" });
    return true;
  }
  return false;
}
function update(state: GameState, dt: number) {
  if (!state.activePowerup) return;
  state.activePowerup.remaining -= dt;
  if (state.activePowerup.id === "flight") {
    state.player.vy -= Config.gravity * dt * 0.82;
    state.player.vy = Math.min(28, state.player.vy);
    if (state.player.y > Config.floor - 45) {
      state.player.y = Config.floor - 45;
      state.player.vy = 0;
    }
    if (state.player.y < 25) {
      state.player.y = 25;
      state.player.vy = Math.max(0, state.player.vy);
    }
    state.player.jumps = 0;
  }
  if (state.activePowerup.remaining <= 0) state.activePowerup = null;
}
function land(state: GameState, previousY: number, dt: number) {
  const p = state.player;
  if (p.vy < 0 || state.grounding || state.activePowerup?.id === "flight") return;
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
export = { catalog, activate, collect, update, land };
