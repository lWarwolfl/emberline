import type { GameState } from "./types";
import Config from "./config";
import Random from "./random";
import Content from "./content";

function baseSpeed(time: number, rules = { speed: 1, growth: 1 }) {
  const speed = Config.speed;
  return (
    speed.start * rules.speed +
    speed.growth * rules.growth * Math.log2(1 + time / speed.growthSeconds)
  );
}

function update(state: GameState, dt: number) {
  const sector = 1 + Math.floor(state.time / Config.sectorSeconds);
  if (sector !== state.sector) {
    state.sector = sector;
    state.previousBiome = state.biome;
    const ids = Content.biomes.map((biome) => biome.id);
    state.biome = Random.drawBag(state.sceneryRng, state.biomeBag, ids, state.biome);
    state.biomeBlend = 0;
    state.events.push({ type: "sector", x: 240, y: 60 });
  }
  state.biomeBlend = Math.min(1, state.biomeBlend + dt / Config.generation.themeFadeSeconds);

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
