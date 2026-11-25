import type { GameState } from "./types";
function create() {
  return { held: false, charge: 100, delay: 0, broken: false, hitGrace: 0 };
}
function active(state: GameState) {
  return (
    state.mode === "playing" &&
    state.hits < state.health &&
    state.shield.held &&
    !state.shield.broken &&
    state.shield.charge > 0
  );
}
function update(state: GameState, dt: number) {
  const s = state.shield,
    max = state.stats.shieldCapacity;
  s.charge = Math.min(max, s.charge);
  s.hitGrace = Math.max(0, s.hitGrace - dt);
  s.delay = Math.max(0, s.delay - dt);
  if (state.hits >= state.health) {
    s.held = false;
    return;
  }
  if (active(state)) {
    s.charge = Math.max(0, s.charge - 22 * dt);
    s.delay = 1.1;
    if (s.charge === 0) s.broken = true;
  } else if (!s.held && s.delay === 0) {
    s.charge = Math.min(max, s.charge + state.stats.shieldRecharge * dt);
    if (s.charge >= 20) s.broken = false;
  }
}
function block(state: GameState) {
  if (!active(state)) return false;
  const s = state.shield;
  if (s.hitGrace > 0) return true;
  s.charge = Math.max(0, s.charge - 25);
  s.delay = 1.1;
  s.hitGrace = 0.22;
  if (s.charge === 0) s.broken = true;
  state.events.push({
    type: s.broken ? "shield-break" : "shield-block",
    x: state.player.x + 7,
    y: state.player.y + 8,
    label: s.broken ? "SHIELD EMPTY" : "BLOCK",
  });
  return true;
}
export = { create, active, update, block };
