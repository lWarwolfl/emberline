import * as Party from "./party";
import Engine from "./engine";
import type { GameState, Player, Projectile, WorldObject } from "./types";

/** Two snapshots of margin at a 30 Hz send rate. Source-style interpolation delay. */
export const renderDelay = 2 / 30;
export const sendInterval = 1 / 30;
export interface Sample {
  time: number;
  run: Party.PartyRun;
}
export interface Remembered {
  sequence: number;
  action: Party.Action;
}
export function remember(samples: Sample[], run: Party.PartyRun) {
  const next = samples.concat({ time: run.world.time, run: Party.clone(run) });
  return next.length > 8 ? next.slice(-8) : next;
}
function mix(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}
function takeClosest<T>(pool: T[], score: (item: T) => number | null) {
  let best = -1;
  let bestScore = Infinity;
  for (let i = 0; i < pool.length; i++) {
    const value = score(pool[i]);
    if (value === null || value >= bestScore) continue;
    best = i;
    bestScore = value;
  }
  return best < 0 ? null : pool.splice(best, 1)[0];
}
function blendObjects(older: WorldObject[], newer: WorldObject[], amount: number) {
  const pool = older.slice();
  return newer.map((target) => {
    const current = takeClosest(pool, (item) =>
      item.kind === target.kind && item.variant === target.variant
        ? Math.hypot(item.x - target.x, item.y - target.y)
        : null,
    );
    if (!current || Math.hypot(current.x - target.x, current.y - target.y) > 80)
      return { ...target };
    return { ...target, x: mix(current.x, target.x, amount), y: mix(current.y, target.y, amount) };
  });
}
function blendBolts<T extends Projectile>(older: T[], newer: T[], amount: number) {
  const pool = older.slice();
  return newer.map((target) => {
    const current = takeClosest(pool, (item) =>
      item.color === target.color ? Math.hypot(item.x - target.x, item.y - target.y) : null,
    );
    const bolt = { ...target, hitTargets: [] as string[] };
    if (!current || Math.hypot(current.x - target.x, current.y - target.y) > 96) return bolt as T;
    bolt.x = mix(current.x, target.x, amount);
    bolt.y = mix(current.y, target.y, amount);
    return bolt as T;
  });
}
function replay(state: GameState, action: Party.Action) {
  if (action === "jump") Engine.jump(state);
  else if (action === "dash") Engine.dash(state);
  else if (action === "attack") Engine.attack(state);
  else if (action === "ground") Engine.ground(state);
  else if (action === "powerup") Engine.powerup(state);
  else return;
  state.events.length = 0;
}
function predict(
  shown: Party.PartyRun,
  latest: Party.PartyRun,
  localId: string,
  pending: Remembered[],
  ack: number,
  hostNow: number,
) {
  const source = latest.members.find((member) => member.id === localId);
  const local = shown.members.find((member) => member.id === localId);
  if (!source || !local || !Party.alive(local) || !Party.alive(source)) return;
  const player: Player = { ...source.state.player };
  local.state.player = player;
  local.state.dash = source.state.dash;
  local.state.cooldown = source.state.cooldown;
  local.state.grounding = source.state.grounding;
  local.state.attackTime = source.state.attackTime;
  local.state.attackCooldown = source.state.attackCooldown;
  local.state.invincible = source.state.invincible;
  local.state.activePowerup = source.state.activePowerup ? { ...source.state.activePowerup } : null;
  local.state.powerups = source.state.powerups.slice();
  local.frontCooldown = source.frontCooldown;
  for (const input of pending) if (input.sequence > ack) replay(local.state, input.action);
  Party.steer(shown, localId, Math.min(0.2, Math.max(0, hostNow - latest.world.time)));
  const front = Party.sorted(shown).find(Party.alive);
  if (front) shown.world.player = front.state.player;
}
/** Draw the world between host snapshots, and play this courier's inputs immediately. */
export function follow(
  shown: Party.PartyRun,
  samples: Sample[],
  localId: string,
  pending: Remembered[],
  ack: number,
  hostNow: number,
) {
  const latest = samples[samples.length - 1];
  if (!latest) return;
  if (latest.run.world.mode !== "playing" || shown.world.mode !== "playing") {
    Party.adopt(shown, latest.run);
    return;
  }
  const renderTime =
    samples.length < 2
      ? latest.time
      : Math.max(samples[0].time, Math.min(latest.time, hostNow - renderDelay));
  let older = samples[0];
  let newer = latest;
  for (let i = 0; i < samples.length - 1; i++) {
    if (samples[i].time <= renderTime && samples[i + 1].time >= renderTime) {
      older = samples[i];
      newer = samples[i + 1];
      break;
    }
  }
  const span = newer.time - older.time;
  const amount = span > 1e-6 ? Math.min(1, Math.max(0, (renderTime - older.time) / span)) : 1;
  const from = older.run;
  const to = newer.run;
  const world = shown.world;
  world.time = renderTime;
  world.distance = mix(from.world.distance, to.world.distance, amount);
  world.mode = to.world.mode;
  world.speed = to.world.speed;
  world.runSpeed = to.world.runSpeed;
  world.targetSpeed = to.world.targetSpeed;
  world.biome = to.world.biome;
  world.previousBiome = to.world.previousBiome;
  world.biomeBlend = to.world.biomeBlend;
  world.score = to.world.score;
  world.embers = to.world.embers;
  world.sector = to.world.sector;
  world.bossActive = to.world.bossActive;
  world.objects = blendObjects(from.world.objects, to.world.objects, amount);
  world.projectiles = blendBolts(from.world.projectiles, to.world.projectiles, amount);
  world.hostileProjectiles = blendBolts(
    from.world.hostileProjectiles,
    to.world.hostileProjectiles,
    amount,
  );
  world.traversals = to.world.traversals.map((device) => {
    const previous = from.world.traversals.find(
      (item) => item.kind === device.kind && item.role === device.role,
    );
    return previous && Math.abs(previous.x - device.x) <= 120
      ? { ...device, x: mix(previous.x, device.x, amount) }
      : { ...device };
  });
  shown.order = to.order.slice();
  shown.started = to.started;
  shown.earned = to.earned;
  shown.beaconDistance = to.beaconDistance;
  shown.revision = to.revision;
  if (!to.checkpoint) shown.checkpoint = null;
  else if (!from.checkpoint) shown.checkpoint = { ...to.checkpoint };
  else
    shown.checkpoint = {
      ...to.checkpoint,
      x: mix(from.checkpoint.x, to.checkpoint.x, amount),
    };
  shown.members = to.members.map((source) => {
    const copy = JSON.parse(
      JSON.stringify(source, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    ) as Party.Member;
    copy.state.score = BigInt(copy.state.score);
    const previous = from.members.find((member) => member.id === source.id);
    const pose = previous?.state.player ?? source.state.player;
    copy.state.player.x = mix(pose.x, source.state.player.x, amount);
    copy.state.player.y = mix(pose.y, source.state.player.y, amount);
    return copy;
  });
  predict(shown, latest.run, localId, pending, ack, hostNow);
}
