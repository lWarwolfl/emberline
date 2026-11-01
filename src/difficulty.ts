import type { GameState } from "./types";
import Config from "./config";
import Random from "./random";
import Content from "./content";
import Combat from "./combat";

function baseSpeed(time: number, rules = { speed: 1, growth: 1 }) {
  const speed = Config.speed;
  return (
    speed.start * rules.speed +
    speed.growth * rules.growth * Math.log2(1 + time / speed.growthSeconds)
  );
}

function applyBiome(state: GameState, id: string) {
  if (state.biome === id) return;
  state.previousBiome = state.biome;
  state.biome = id;
  state.biomeBlend = 0;
}

function beginBoss(state: GameState) {
  const group = Content.groups[state.groupIndex];
  state.bossActive = true;
  state.objects.push({
    kind: "enemy",
    variant: "boss",
    x: 330,
    y: Config.floor - 58,
    w: 46,
    h: 58,
    hp: Combat.durability({ kind: "enemy", variant: "boss" }),
    baseY: Config.floor - 58,
    amplitude: 5,
    frequency: 1.3,
    extraSpeed: 0,
    phase: 0,
    age: 0,
  });
  state.events.push({ type: "boss", x: 240, y: 48, label: group.boss });
}

function finishBoss(state: GameState) {
  state.bossActive = false;
  state.groupIndex = (state.groupIndex + 1) % Content.groups.length;
  state.biomeIndex = 0;
  state.sector = 1 + Math.floor(state.time / Config.sectorSeconds);
  applyBiome(state, Content.groups[state.groupIndex].biomes[0].id);
  state.events.push({
    type: "sector",
    x: 240,
    y: 60,
    label: Content.groups[state.groupIndex].name,
  });
}

function update(state: GameState, dt: number) {
  if (state.bossActive) {
    if (!state.objects.some((object) => object.variant === "boss" && !object.dead))
      finishBoss(state);
    else {
      state.biomeBlend = Math.min(1, state.biomeBlend + dt / Config.generation.themeFadeSeconds);
      advancePace(state, dt);
      return;
    }
  }
  const sector = 1 + Math.floor(state.time / Config.sectorSeconds);
  if (sector !== state.sector) {
    state.sector = sector;
    const group = Content.groups[state.groupIndex];
    if (state.biomeIndex >= group.biomes.length - 1) beginBoss(state);
    else {
      state.biomeIndex += 1;
      state.previousBiome = state.biome;
      state.biome = group.biomes[state.biomeIndex].id;
      state.biomeBlend = 0;
      state.events.push({ type: "sector", x: 240, y: 60 });
    }
  }
  state.biomeBlend = Math.min(1, state.biomeBlend + dt / Config.generation.themeFadeSeconds);
  advancePace(state, dt);
}

function advancePace(state: GameState, dt: number) {
  if (state.time >= state.nextPaceTime) {
    const ids = Content.paces.map((pace) => pace.id);
    state.pace = Random.drawBag(state.paceRng, state.paceBag, ids, state.pace);
    state.nextPaceTime =
      state.time +
      Random.range(state.paceRng, Config.speed.phaseMinSeconds, Config.speed.phaseMaxSeconds);
    state.events.push({ type: "pace", x: 240, y: 60 });
  }
  const pace = Content.paces.find((item) => item.id === state.pace)!;
  state.targetSpeed = baseSpeed(state.time, state.rules) * pace.multiplier;
  const difference = state.targetSpeed - state.speed;
  const rate = difference > 0 ? Config.speed.acceleration : Config.speed.deceleration;
  state.speed += Math.sign(difference) * Math.min(Math.abs(difference), rate * dt);
}

function gapSeconds(sector: number, rules = { gap: 1 }) {
  const settings = Config.generation;
  return Math.max(
    settings.minimumGapSeconds,
    (settings.initialGapSeconds - 0.16 * Math.log2(sector + 1)) * rules.gap,
  );
}

function safetySpeed(state: GameState) {
  // Account for acceleration before the next encounter reaches the courier.
  const fastestPace = Math.max(...Content.paces.map((pace) => pace.multiplier));
  const fastestEnemy = Math.max(0, ...Content.enemies.map((enemy) => enemy.extraSpeed));
  return Math.max(state.speed, baseSpeed(state.time + 6, state.rules) * fastestPace) + fastestEnemy;
}

export = { baseSpeed, update, gapSeconds, safetySpeed };
