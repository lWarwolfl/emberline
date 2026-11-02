import type { GameState, WorldObject } from "./types";
import Config from "./config";
import Loadout from "./loadout";

const armor: Partial<Record<string, number>> = { crate: 1, barrier: 1, stack: 2.6 };
function durability(object: Pick<WorldObject, "kind" | "variant">) {
  if (object.kind === "enemy")
    return (
      (
        {
          drone: 1.2,
          crawler: 2.4,
          jelly: 1.5,
          bat: 1,
          sentry: 2.2,
          beetle: 3.2,
          wasp: 1.8,
          wisp: 1.4,
          boss: 18,
        } as Record<string, number>
      )[object.variant] || 1
    );
  return armor[object.variant] || 0;
}
function breakable(object: WorldObject) {
  return (object.kind === "hazard" || object.kind === "enemy") && durability(object) > 0;
}

function damage(state: GameState, object: WorldObject, amount: number, method: string) {
  if (object.dead || !breakable(object)) return false;
  if (method !== "shot" && state.activePowerup?.id === "titan") amount *= 2.5;
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
    label:
      method === "blast"
        ? "BLAST"
        : method === "dash"
          ? "DASH"
          : object.kind === "enemy"
            ? "ENEMY"
            : "BREAK",
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
  const spread =
    weapon.id === "nova" ? [-4, -2, 0, 2, 4] : weapon.id === "scatter" ? [-3, 0, 3] : [0];
  for (const offset of spread)
    state.projectiles.push({
      x,
      y: y + offset,
      vx: weapon.speed!,
      vy: 0,
      armored: weapon.id === "siegebreaker",
      life: weapon.life!,
      damage:
        weapon.damage *
        state.stats.damageMultiplier *
        (state.activePowerup?.id === "titan" ? 2.5 : 1),
      color: weapon.color,
      pierce: weapon.pierce ?? 0,
      hitTargets: [],
    });
  return true;
}

function update(state: GameState, dt: number, moveProjectiles = true) {
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
  if (!moveProjectiles) return;
  for (const bolt of state.projectiles) {
    const previousX = bolt.x,
      previousY = bolt.y;
    bolt.x += bolt.vx * dt;
    bolt.y += bolt.vy * dt;
    bolt.life -= dt;
    for (const object of state.objects) {
      if (
        object.dead ||
        !["enemy", "hazard"].includes(object.kind) ||
        bolt.hitTargets?.includes(object)
      )
        continue;
      if (
        Math.max(bolt.x, previousX) + 3 >= object.x &&
        Math.min(bolt.x, previousX) <= object.x + object.w &&
        Math.max(bolt.y, previousY) + 2 >= object.y - (object.kind === "enemy" ? 5 : 0) &&
        Math.min(bolt.y, previousY) <= object.y + object.h + (object.kind === "enemy" ? 5 : 0)
      ) {
        if (bolt.armored && object.kind === "hazard" && !breakable(object)) object.hp ??= 5;
        if (bolt.armored && object.kind === "hazard" && !breakable(object)) {
          object.hp! -= bolt.damage;
          if (object.hp! <= 0) {
            object.dead = true;
            state.score += 100n;
            state.events.push({
              type: "smash",
              x: object.x,
              y: object.y,
              points: 100,
              label: "BREACH",
            });
          }
        } else damage(state, object, bolt.damage, "shot");
        if (!breakable(object) && !object.dead)
          state.events.push({ type: "armor", x: object.x, y: object.y, label: "ARMORED" });
        if (
          (breakable(object) || (bolt.armored && object.kind === "hazard")) &&
          (bolt.pierce ?? 0) > 0
        ) {
          bolt.pierce!--;
          (bolt.hitTargets ??= []).push(object);
        } else {
          bolt.life = 0;
          break;
        }
      }
    }
  }
  state.projectiles = state.projectiles.filter(
    (bolt) =>
      bolt.life > 0 && bolt.x < Config.width + 30 && bolt.y > 0 && bolt.y < Config.floor + 10,
  );
}
export = { armor, durability, breakable, damage, attack, update };
