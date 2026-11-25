import type { GameState, WorldObject } from "./types";
import Config from "./config";

const variants = new Set(["prism", "scuttler", "bomber"]);
const bomberRadius = 44;
function emitBolt(
  state: GameState,
  x: number,
  y: number,
  vx: number,
  vy: number,
  color: string,
  life = 3,
) {
  if (state.hostileProjectiles.length >= Config.enemyFire.maxProjectiles) return;
  state.hostileProjectiles.push({
    x,
    y,
    previousX: x,
    previousY: y,
    vx,
    vy,
    life,
    damage: 1,
    color,
  });
}
function attack(state: GameState, enemy: WorldObject) {
  const x = enemy.x,
    y = enemy.y + enemy.h / 2;
  if (enemy.variant === "bomber") {
    // One short radial burst; killing the bomber during its fuse prevents this.
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      emitBolt(
        state,
        x + enemy.w / 2,
        y,
        Math.cos(angle) * 100,
        Math.sin(angle) * 100,
        "#ff805f",
        bomberRadius / 100,
      );
    }
    enemy.dead = true;
    state.events.push({ type: "bomber-burst", x, y, label: "DETONATION" });
  } else if (enemy.variant === "prism") {
    const angle = Math.atan2(enemy.aimY! - y, enemy.aimX! - x);
    const speed = 100 + Math.min(50, state.runSpeed * 0.2);
    for (const offset of [-0.32, 0, 0.32])
      emitBolt(
        state,
        x,
        y,
        Math.cos(angle + offset) * speed,
        Math.sin(angle + offset) * speed,
        "#efb5ed",
      );
    state.events.push({ type: "enemy-shot", x, y });
  } else {
    // Alternating lanes leave a full-height jump/crouch escape, never a wall.
    const lane = enemy.aimY!;
    const speed = 115 + Math.min(45, state.runSpeed * 0.2);
    emitBolt(state, x, lane, -speed, 0, "#9ce5d6");
    state.events.push({ type: "enemy-shot", x, y: lane });
  }
}
function update(state: GameState, dt: number) {
  if (state.mode !== "playing") return;
  for (const enemy of state.objects) {
    if (enemy.kind !== "enemy" || !variants.has(enemy.variant)) continue;
    if (
      enemy.dead ||
      enemy.passed ||
      enemy.x + enemy.w < state.player.x - 12 ||
      enemy.x > Config.width - 12
    ) {
      enemy.charge = 0;
      continue;
    }
    if ((enemy.charge ?? 0) > 0) {
      enemy.charge = Math.max(0, enemy.charge! - dt);
      if (enemy.charge === 0) {
        attack(state, enemy);
        enemy.shotCooldown = enemy.variant === "prism" ? 3.4 : 2.8;
      }
      continue;
    }
    enemy.shotCooldown = Math.max(0, (enemy.shotCooldown ?? 0.6) - dt);
    const warning = enemy.variant === "bomber" ? 0.85 : 0.8;
    const clearance =
      enemy.variant === "bomber" ? Math.max(90, state.runSpeed * warning + 18) : 180;
    const distance = enemy.x - state.player.x;
    if (
      enemy.shotCooldown > 0 ||
      distance < clearance ||
      (enemy.variant === "bomber" && distance > clearance + 16)
    )
      continue;
    // Share the charging budget with regular shooters and bosses.
    const charging = state.objects.filter((o) => !o.dead && (o.charge ?? 0) > 0).length;
    if (charging >= Config.enemyFire.maxCharging) continue;
    enemy.charge = warning;
    enemy.aimX = state.player.x + 7;
    enemy.aimY =
      enemy.variant === "scuttler"
        ? Config.floor - ((enemy.age ?? 0) % 6 < 3 ? 37 : 7)
        : state.player.y + 9;
    state.events.push({ type: "charge", x: enemy.x, y: enemy.y });
  }
}
export = { update, variants, bomberRadius };
