import type { GameState, WorldObject } from "./types";
import Config from "./config";
import Random from "./random";
import Content from "./content";
import Difficulty from "./difficulty";

function choose<T extends "obstacles" | "enemies">(
  state: GameState,
  type: T,
): (typeof Content)[T][number] {
  const definitions = Content[type].filter(
    (item) => item.unlock <= state.sector,
  ) as (typeof Content)[T];
  const chosen = Random.weighted(state.rng, definitions, state.lastVariant[type]);
  state.lastVariant[type] = chosen.id;
  return chosen as (typeof Content)[T][number];
}

function obstacle(state: GameState, x: number): WorldObject {
  const definition = choose(state, "obstacles");
  return {
    kind: "hazard",
    variant: definition.id,
    x,
    y: Config.floor - definition.h,
    w: definition.w,
    h: definition.h,
    passed: false,
  };
}

function enemy(state: GameState, x: number): WorldObject {
  const definition = choose(state, "enemies");
  const altitudeJitter = definition.id === "crawler" ? 0 : Random.range(state.rng, -4, 4);
  const baseY = Config.floor - definition.altitude + altitudeJitter;
  return {
    kind: "enemy",
    variant: definition.id,
    x,
    y: baseY,
    baseY,
    w: definition.w,
    h: definition.h,
    amplitude: definition.amplitude,
    frequency: definition.frequency,
    extraSpeed: definition.extraSpeed,
    phase: Random.range(state.rng, 0, Math.PI * 2),
    age: 0,
    passed: false,
  };
}

function coinPath(state: GameState, pattern: string, startX: number, width: number) {
  const points: WorldObject[] = [];
  const count = pattern === "scatter" ? 9 : 7;
  const yShift = Random.range(state.rng, -3, 3);
  for (let i = 0; i < count; i++) {
    const fraction = i / (count - 1);
    let x = startX + fraction * width;
    let height;
    switch (pattern) {
      case "ground":
        height = 12;
        break;
      case "arc":
        height = 28 + Math.sin(fraction * Math.PI) * 40;
        break;
      case "staircase":
        height = 18 + Math.floor(fraction * 4) * 13;
        break;
      case "high":
        height = 67;
        break;
      case "wave":
        height = 37 + Math.sin(fraction * Math.PI * 2) * 22;
        break;
      case "split":
        height = i < count / 2 ? 15 : 65;
        break;
      case "scatter":
        height = Random.range(state.rng, 12, 70);
        x += Random.range(state.rng, -5, 5);
        break;
      default:
        throw new Error("Unknown coin pattern: " + pattern);
    }
    points.push({
      kind: "ember",
      variant: pattern,
      x,
      y: Math.max(Config.floor - 70, Math.min(Config.floor - 10, Config.floor - height + yShift)),
      w: 5,
      h: 6,
    });
  }
  return points;
}

function overlapsDanger(coin: WorldObject, object: WorldObject) {
  const clearance = Config.generation.coinClearance;
  const amplitude = object.amplitude || 0;
  // Reserve the entire motion envelope, rather than just the current frame.
  return (
    coin.x + coin.w + clearance > object.x &&
    coin.x - clearance < object.x + object.w &&
    coin.y + coin.h + clearance > object.y - amplitude &&
    coin.y - clearance < object.y + object.h + amplitude
  );
}

function spawn(state: GameState) {
  const eligible = Content.patterns
    .filter((pattern) => pattern.unlock <= state.sector)
    .map((pattern) => pattern.id);
  // Clear the bag on unlock so newly available encounters enter the next cycle.
  const key = eligible.join(",");
  if (key !== state.patternPool) {
    state.patternBag.length = 0;
    state.patternPool = key;
  }
  const pattern = Random.drawBag(state.rng, state.patternBag, eligible, state.lastPattern);
  const coinPattern = Random.drawBag(
    state.rng,
    state.coinBag,
    Content.coinPatterns,
    state.lastCoinPattern,
  );
  state.lastPattern = pattern;
  state.lastCoinPattern = coinPattern;

  const x = Config.generation.spawnX;
  const safetySpeed = Difficulty.safetySpeed(state);
  const separation = Math.max(155, safetySpeed * 1.25);
  const dangers: WorldObject[] = [];
  switch (pattern) {
    case "hurdle":
      dangers.push(obstacle(state, x));
      break;
    case "patrol":
      dangers.push(enemy(state, x));
      break;
    case "steps":
      dangers.push(obstacle(state, x), obstacle(state, x + separation));
      break;
    case "mixed":
      if (Random.next(state.rng) < 0.5)
        dangers.push(obstacle(state, x), enemy(state, x + separation));
      else dangers.push(enemy(state, x), obstacle(state, x + separation));
      break;
    case "convoy":
      // Extra room lets the dash recharge even if both enemies are on the floor.
      dangers.push(enemy(state, x), enemy(state, x + Math.max(separation, safetySpeed * 2)));
      break;
    case "coin-break":
      break;
    default:
      throw new Error("Unknown encounter: " + pattern);
  }

  const end = dangers.reduce((right, item) => Math.max(right, item.x + item.w), x);
  const coins = coinPath(state, coinPattern, x - 24, Math.max(115, end - x + 95));
  const safeCoins = coins.filter((coin) => !dangers.some((danger) => overlapsDanger(coin, danger)));
  // Every chunk retains a reward even if a new content definition blocks its trail.
  if (safeCoins.length < 2) safeCoins.push(...coinPath(state, "ground", end + 25, 90));
  state.objects.push(...dangers, ...safeCoins);

  const gap =
    Difficulty.gapSeconds(state.sector, state.rules) +
    Random.range(state.rng, 0, Config.generation.gapVariationSeconds);
  const occupiedWidth = Math.max(end, ...safeCoins.map((coin) => coin.x + coin.w)) - x;
  state.next = state.distance + occupiedWidth + safetySpeed * gap + 35;
  state.encounterCount++;
  state.lastEncounter = {
    pattern,
    coinPattern,
    variants: dangers.map((item) => item.variant),
    gap,
    width: occupiedWidth,
  };
  return state.lastEncounter;
}

function move(object: WorldObject, speed: number, dt: number) {
  object.x -= (speed + (object.extraSpeed || 0)) * dt;
  if (object.kind === "enemy") {
    object.age = (object.age ?? 0) + dt;
    object.y =
      object.baseY! + Math.sin(object.age * object.frequency! + object.phase!) * object.amplitude!;
  }
}

export = { spawn, obstacle, enemy, coinPath, overlapsDanger, move };
