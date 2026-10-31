import type { GameState, WorldObject } from "./types";
import Config from "./config";
import Loadout from "./loadout";

const armor: Partial<Record<string, number>> = { crate: 1, barrier: 1, stack: 2.6 };
function durability(object: WorldObject) {
  if (object.kind === "enemy")
    return (
      ({ drone: 1.2, crawler: 2.4, jelly: 1.5, bat: 1 } as Record<string, number>)[
        object.variant
      ] || 1
    );
  return armor[object.variant] || 0;
}
function breakable(object: WorldObject) {
  return object.kind !== "ember" && durability(object) > 0;
}

function damage(state: GameState, object: WorldObject, amount: number, method: string) {
  if (object.dead || !breakable(object)) return false;
  object.hp = Math.round(((object.hp ?? durability(object)) - amount) * 1000) / 1000;
  if (object.hp > 0) {
    state.events.push({ type: "armor", x: object.x, y: object.y, label: "HIT" });
    return false;
  }
  object.dead = true;
  const points = object.kind === "enemy" ? 150 : 100;
  state.score += BigInt(points);
  state.events.push({
    type: "smash",
    x: object.x,
    y: object.y,
    points,
    label: method === "dash" ? "DASH" : object.kind === "enemy" ? "ENEMY" : "BREAK",
  });
  return true;
}

function attack(state: GameState) {
  if (state.mode !== "playing" || state.attackCooldown > 0) return false;
  const weapon = Loadout.find(Loadout.weapons, state.loadout.weapon);
  state.attackCooldown = weapon.cooldown;
  state.attackTime = weapon.duration || 0.12;
  state.attackId++;
  state.events.push({
    type: weapon.id === "punch" ? "punch" : "shoot",
    x: state.player.x + 15,
    y: state.player.y + 9,
  });
  if (weapon.id === "punch") return true;
  const x = state.player.x + 15,
    y = state.player.y + 9;
  const target = state.objects
    .filter(
      (object) =>
        !object.dead &&
        breakable(object) &&
        object.x > x &&
        object.x - x < 270 &&
        Math.abs(object.y + object.h / 2 - y) < 70,
    )
    .sort((a, b) => a.x - b.x)[0];
  let angle = 0;
  if (target) {
    const travelTime = Math.max(
      0.05,
      (target.x - x) / (weapon.speed! + state.runSpeed + (target.extraSpeed || 0)),
    );
    angle = Math.atan2((target.y + target.h / 2 - y) / travelTime, weapon.speed!);
  }
  const spread = weapon.id === "scatter" ? [-0.16, 0, 0.16] : [0];
  for (const offset of spread)
    state.projectiles.push({
      x,
      y,
      vx: Math.cos(angle + offset) * weapon.speed!,
      vy: Math.sin(angle + offset) * weapon.speed!,
      life: weapon.life!,
      damage: weapon.damage * state.stats.damageMultiplier,
      color: weapon.color,
    });
  return true;
}

function update(state: GameState, dt: number) {
  const weapon = Loadout.find(Loadout.weapons, state.loadout.weapon);
  if (state.attackTime > 0 && weapon.id === "punch") {
    for (const object of state.objects) {
      if (object.dead || object.lastPunch === state.attackId) continue;
      if (
        object.x < state.player.x + 13 + weapon.range! &&
        object.x + object.w > state.player.x + 9 &&
        object.y + object.h > state.player.y + 1 &&
        object.y < state.player.y + 21
      ) {
        object.lastPunch = state.attackId;
        damage(state, object, weapon.damage * state.stats.damageMultiplier, "punch");
      }
    }
  }
  for (const bolt of state.projectiles) {
    const previousX = bolt.x,
      previousY = bolt.y;
    bolt.x += bolt.vx * dt;
    bolt.y += bolt.vy * dt;
    bolt.life -= dt;
    for (const object of state.objects) {
      if (object.dead || object.kind === "ember") continue;
      if (
        Math.max(bolt.x, previousX) + 3 >= object.x &&
        Math.min(bolt.x, previousX) <= object.x + object.w &&
        Math.max(bolt.y, previousY) + 2 >= object.y &&
        Math.min(bolt.y, previousY) <= object.y + object.h
      ) {
        damage(state, object, bolt.damage, "shot");
        if (!breakable(object))
          state.events.push({ type: "armor", x: object.x, y: object.y, label: "ARMORED" });
        bolt.life = 0;
        break;
      }
    }
  }
  state.projectiles = state.projectiles.filter(
    (bolt) =>
      bolt.life > 0 && bolt.x < Config.width + 30 && bolt.y > 0 && bolt.y < Config.floor + 10,
  );
}
export = { armor, durability, breakable, damage, attack, update };
