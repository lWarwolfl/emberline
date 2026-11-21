import type { GameState, Traversal } from "./types";
import Config from "./config";

/** Devices award skip distance without erasing the route already on screen. */
function activate(state: GameState, device: Traversal) {
  if (device.role) return;
  const distance =
    device.kind === "portal" ? Config.traversal.portalSkip : Config.traversal.padSkip;
  state.distance += distance;
  state.parallax += distance;
  state.next += distance;
  state.score += BigInt(distance);
  state.time += Math.min(6, distance / Math.max(98, state.speed));
  state.invincible = Math.max(state.invincible, Config.traversal.arrivalGrace);
  const entry = device.kind === "portal" ? { x: state.player.x, y: state.player.y } : undefined;
  state.traversals = state.traversals.filter((item) => !item.role && item !== device);
  if (device.kind === "portal") {
    state.player.x = Math.min(Config.playerRight, Math.max(Config.playerX, device.x + 90));
    state.traversals.push({ ...device, role: "entry", age: 0 });
    state.player.y = Config.floor - Config.playerHeight;
    state.player.vy = 0;
    state.player.jumps = 0;
    state.traversals.push({
      kind: "portal",
      role: "exit",
      x: state.player.x + (13 - device.w) / 2,
      y: device.y,
      w: device.w,
      h: device.h,
      age: 0,
    });
  } else {
    state.player.x = Config.playerX;
    state.player.vy = -260;
    state.player.jumps = 1;
  }
  const duration = device.kind === "portal" ? Config.traversal.portalDuration : 1.5;
  state.traversalEffect = { kind: device.kind, life: duration, duration, distance, entry };
  state.events.push({
    type: device.kind,
    x: entry?.x ?? state.player.x,
    y: entry ? device.y - 8 : state.player.y,
    points: distance,
    label: `${device.kind === "portal" ? "WARP" : "LAUNCH"} / ${distance}m`,
  });
}

function emerging(state: GameState) {
  const effect = state.traversalEffect;
  return (
    effect?.kind === "portal" &&
    effect.duration - effect.life < Config.traversal.portalEnter + Config.traversal.portalReveal
  );
}

function animate(state: GameState, dt: number) {
  if (state.traversalEffect) {
    state.traversalEffect.life -= dt;
    if (state.traversalEffect.life <= 0) {
      state.traversalEffect = null;
      state.traversals = state.traversals.filter((device) => !device.role);
    }
  }
}

function update(state: GameState, dt: number) {
  animate(state, dt);
  for (const device of state.traversals) {
    device.age += dt;
    if (device.role) continue;
    const previousX = device.x;
    device.x -= state.runSpeed * dt;
    const player = state.player;
    if (
      !emerging(state) &&
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
export = { activate, animate, emerging, update };
