import type { GameState, Traversal } from "./types";
import Config from "./config";

/** Devices skip distance, never grant coins or kills for the part of the route skipped. */
function activate(state: GameState, device: Traversal) {
  const distance =
    device.kind === "portal" ? Config.traversal.portalSkip : Config.traversal.padSkip;
  state.distance += distance;
  state.score += BigInt(distance);
  state.time += Math.min(6, distance / Math.max(98, state.speed));
  state.objects = [];
  state.projectiles = [];
  state.hostileProjectiles = [];
  state.traversals = [];
  state.next = state.distance + Math.max(Config.generation.initialDistance, state.runSpeed * 2);
  state.invincible = Math.max(state.invincible, Config.traversal.arrivalGrace);
  state.player.x = Config.playerX;
  if (device.kind === "portal") {
    state.player.y = Config.floor - Config.playerHeight;
    state.player.vy = 0;
    state.player.jumps = 0;
  } else {
    state.player.vy = -260;
    state.player.jumps = 1;
  }
  const duration = device.kind === "portal" ? 0.8 : 1.5;
  state.traversalEffect = { kind: device.kind, life: duration, duration, distance };
  state.events.push({
    type: device.kind,
    x: state.player.x,
    y: state.player.y,
    points: distance,
    label: `${device.kind === "portal" ? "WARP" : "LAUNCH"} / ${distance}m`,
  });
}

function update(state: GameState, dt: number) {
  if (state.traversalEffect) {
    state.traversalEffect.life -= dt;
    if (state.traversalEffect.life <= 0) state.traversalEffect = null;
  }
  for (const device of state.traversals) {
    const previousX = device.x;
    device.x -= state.runSpeed * dt;
    device.age += dt;
    const player = state.player;
    if (
      player.x + 13 > Math.min(previousX, device.x) &&
      player.x < Math.max(previousX, device.x) + device.w &&
      player.y + Config.playerHeight > device.y &&
      player.y < device.y + device.h
    ) {
      activate(state, device);
      return;
    }
  }
  state.traversals = state.traversals.filter((device) => device.x + device.w > -20);
}
export = { activate, update };
