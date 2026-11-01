import type { GameState, Traversal } from "./types";
import Config from "./config";

/** Devices award skip distance without erasing the route already on screen. */
function activate(state: GameState, device: Traversal) {
  if (device.role === "exit") return;
  const distance =
    device.kind === "portal" ? Config.traversal.portalSkip : Config.traversal.padSkip;
  state.distance += distance;
  state.parallax += distance;
  state.next += distance;
  state.score += BigInt(distance);
  state.time += Math.min(6, distance / Math.max(98, state.speed));
  state.invincible = Math.max(state.invincible, Config.traversal.arrivalGrace);
  state.player.x = Config.playerX;
  state.traversals = state.traversals.filter((item) => item !== device);
  if (device.kind === "portal") {
    state.player.y = Config.floor - Config.playerHeight;
    state.player.vy = 0;
    state.player.jumps = 0;
    state.traversals.push({
      kind: "portal",
      role: "exit",
      x: Math.min(Config.width - 40, Math.max(device.x + 130, state.player.x + 160)),
      y: device.y,
      w: device.w,
      h: device.h,
      age: 0,
    });
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
      device.role !== "exit" &&
      player.x + 13 > Math.min(previousX, device.x) &&
      player.x < Math.max(previousX, device.x) + device.w &&
      player.y + Config.playerHeight > device.y &&
      player.y < device.y + device.h
    ) {
      activate(state, device);
      return;
    }
  }
  state.traversals = state.traversals.filter(
    (device) => device.x + device.w > -20 && !(device.role === "exit" && device.age > 1.4),
  );
}
export = { activate, update };
