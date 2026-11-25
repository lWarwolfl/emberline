import type { GameState, WorldObject } from "./types";
import Config from "./config";
import Random from "./random";
const catalog = {
  warden: { name: "Iron Warden", color: "#ffae62", hp: 22, interval: 2.4, warning: 0.8 },
  leviathan: { name: "Storm Leviathan", color: "#91dce9", hp: 26, interval: 2.8, warning: 0.95 },
  herald: { name: "Solar Herald", color: "#ffe3a8", hp: 20, interval: 2.5, warning: 0.85 },
  matron: { name: "Hive Matron", color: "#d8b3ed", hp: 24, interval: 3, warning: 1.05 },
} as const;
type BossId = keyof typeof catalog;
function spawn(state: GameState): WorldObject {
  const rng = Random.create(`${state.seed}:boss:${state.sector}`);
  const ids = (Object.keys(catalog) as BossId[]).filter((id) => id !== state.lastBossId);
  const id = Random.pick(rng, ids),
    model = catalog[id];
  state.lastBossId = id;
  const maxHp =
    model.hp * (1 + Math.min(3, state.groupIndex) * 0.15) * Math.max(1, state.rules.speed);
  return {
    kind: "enemy",
    variant: "boss",
    bossId: id,
    hp: maxHp,
    maxHp,
    x: 330,
    y: Config.floor - 58,
    w: 46,
    h: 58,
    baseY: Config.floor - 58,
    amplitude: 5,
    frequency: 1.3,
    extraSpeed: 0,
    phase: 0,
    age: 0,
    shotCooldown: 1.5,
    bossPhase: 0,
  };
}
function update(state: GameState, dt: number) {
  if (state.mode !== "playing") return;
  for (const boss of state.objects) {
    if (boss.variant !== "boss" || boss.dead || boss.passed) continue;
    const id = boss.bossId ?? "warden",
      model = catalog[id];
    if ((boss.charge ?? 0) > 0) {
      boss.charge = Math.max(0, boss.charge! - dt);
      if (boss.charge > 0) continue;
      const phase = boss.bossPhase ?? 0,
        y = boss.y + boss.h / 2;
      const shots: { angle: number; y: number }[] = [];
      const aim = Math.atan2(boss.aimY! - y, boss.aimX! - boss.x);
      if (id === "warden")
        for (const offset of [-0.22, 0, 0.22]) shots.push({ angle: aim + offset, y });
      else if (id === "leviathan") {
        for (const lane of phase % 2 ? [78, 146, 181] : [45, 112, 181])
          shots.push({ angle: Math.PI, y: lane });
      } else if (id === "herald") {
        for (const lane of phase % 2 ? [66, 136] : [100, 180])
          shots.push({ angle: Math.PI, y: lane });
      } else {
        for (const offset of [-0.45, -0.15, 0.15, 0.45]) shots.push({ angle: aim + offset, y });
      }
      const speed = 110 + Math.min(50, state.runSpeed * 0.14);
      for (const shot of shots) {
        if (state.hostileProjectiles.length >= Config.enemyFire.maxProjectiles) break;
        state.hostileProjectiles.push({
          x: boss.x,
          y: shot.y,
          previousX: boss.x,
          previousY: shot.y,
          vx: Math.cos(shot.angle) * speed,
          vy: Math.sin(shot.angle) * speed,
          life: 4,
          damage: 1,
          color: model.color,
        });
      }
      boss.bossPhase = phase + 1;
      boss.shotCooldown = model.interval;
      state.events.push({ type: "enemy-shot", x: boss.x, y });
    } else {
      boss.shotCooldown = Math.max(0, (boss.shotCooldown ?? 1.5) - dt);
      if (boss.shotCooldown > 0 || boss.x - state.player.x < 90) continue;
      // One attack at a time; lock the aim for the entire visible warning.
      if (state.objects.some((o) => o !== boss && !o.dead && (o.charge ?? 0) > 0)) continue;
      boss.charge = model.warning;
      boss.aimX = state.player.x + 7;
      boss.aimY = state.player.y + 9;
      state.events.push({ type: "charge", x: boss.x, y: boss.y, label: model.name.toUpperCase() });
    }
  }
}
export = { catalog, spawn, update };
