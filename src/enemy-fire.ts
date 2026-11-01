import type { GameState, HostileProjectile, Player } from "./types";
import Config from "./config";

const shooters: Partial<Record<string, { interval: number; speed: number; color: string }>> = {
  sentry: { interval: 2.6, speed: 100, color: "#ff7b73" },
  wasp: { interval: 3.1, speed: 115, color: "#ff98ca" },
  boss: { interval: 1.7, speed: 90, color: "#ffb15a" },
};

function update(state: GameState, dt: number) {
  if (state.mode !== "playing") return;
  for (const object of state.objects) {
    const gun = shooters[object.variant];
    if (object.kind !== "enemy" || !gun) continue;
    if (object.dead || object.passed) {
      object.charge = 0;
      continue;
    }
    if (
      object.x <= state.player.x + Math.max(70, state.runSpeed * 0.35) ||
      object.x > Config.width - 12
    ) {
      object.charge = 0;
      continue;
    }
    if ((object.charge ?? 0) > 0) {
      object.charge = Math.max(0, object.charge! - dt);
      if (object.charge > 0) continue;
      const x = object.x,
        y = object.y + object.h / 2;
      const angle = Math.atan2(object.aimY! - y, object.aimX! - x);
      const speed = gun.speed + state.runSpeed * 0.3;
      if (state.hostileProjectiles.length < Config.enemyFire.maxProjectiles) {
        state.hostileProjectiles.push({
          x,
          y,
          previousX: x,
          previousY: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 4,
          damage: 1,
          color: gun.color,
        });
        state.events.push({ type: "enemy-shot", x, y });
      }
      object.shotCooldown = gun.interval;
    } else {
      object.shotCooldown = Math.max(0, (object.shotCooldown ?? 0.35) - dt);
      const charging = state.objects.filter((item) => !item.dead && (item.charge ?? 0) > 0).length;
      if (
        object.shotCooldown <= 0 &&
        object.x - state.player.x > 170 &&
        charging < Config.enemyFire.maxCharging
      ) {
        object.charge = Config.enemyFire.warningSeconds;
        object.aimX = state.player.x + 7;
        object.aimY = state.player.y + 9;
        state.events.push({ type: "charge", x: object.x, y: object.y });
      }
    }
  }
  for (const bolt of state.hostileProjectiles) {
    bolt.previousX = bolt.x;
    bolt.previousY = bolt.y;
    bolt.x += bolt.vx * dt;
    bolt.y += bolt.vy * dt;
    bolt.life -= dt;
  }
  state.hostileProjectiles = state.hostileProjectiles.filter(
    (bolt) =>
      bolt.life > 0 &&
      bolt.x > -20 &&
      bolt.x < Config.width + 20 &&
      bolt.y > -10 &&
      bolt.y < Config.floor + 10,
  );
}

function hitsPlayer(bolt: HostileProjectile, player: Player) {
  return (
    Math.min(bolt.x, bolt.previousX) < player.x + 12 &&
    Math.max(bolt.x, bolt.previousX) + 4 > player.x + 1 &&
    Math.min(bolt.y, bolt.previousY) < player.y + 17 &&
    Math.max(bolt.y, bolt.previousY) + 4 > player.y + 1
  );
}
export = { shooters, update, hitsPlayer };
