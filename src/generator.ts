import type { GameState, WorldObject } from "./types";
import Combat from "./combat";
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

function enemy(state: GameState, x: number, variant?: string): WorldObject {
  const definition =
    Content.enemies.find((item) => item.id === variant && item.unlock <= state.sector) ??
    choose(state, "enemies");
  state.lastVariant.enemies = definition.id;
  const altitudeJitter =
    definition.altitude === definition.h && definition.amplitude === 0
      ? 0
      : Random.range(state.rng, -4, 4);
  const baseY = Config.floor - definition.altitude + altitudeJitter;
  return {
    evolution: Math.min(4, Math.floor(state.time / 40)),
    hp:
      Combat.durability({ kind: "enemy", variant: definition.id }) *
      (1 + Math.min(4, Math.floor(state.time / 40)) * 0.3),
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

// Width, elevation, and gap after each one-way platform.
const platformRoutes = [
  [
    ["step", 82, 21, 32],
    ["step", 56, 41, 37],
    ["bridge", 118, 58, 0],
  ],
  [
    ["bridge", 116, 25, 48],
    ["island", 44, 43, 48],
    ["bridge", 102, 23, 0],
  ],
  [
    ["island", 48, 22, 34],
    ["island", 38, 34, 46],
    ["step", 61, 49, 29],
    ["island", 48, 26, 0],
  ],
  [
    ["step", 67, 20, 40],
    ["bridge", 142, 39, 36],
    ["step", 78, 52, 0],
  ],
] as const;

function enemyGroup(state: GameState, x: number, speed: number, count: number) {
  const flying = Content.enemies.filter(
    (item) => item.unlock <= state.sector && item.altitude > item.h,
  );
  const leader =
    count > 2
      ? enemy(state, x, Random.weighted(state.rng, flying, state.lastVariant.enemies).id)
      : enemy(state, x);
  const airborne = leader.baseY! + leader.h < Config.floor;
  const companions = Content.enemies.filter(
    (item) => item.unlock <= state.sector && item.altitude > item.h === airborne,
  );
  const spacing = Math.max(48, speed * (airborne ? 0.32 : 0.38));
  const group = [leader];
  for (let i = 1; i < count; i++) {
    const variant = Random.weighted(state.rng, companions, state.lastVariant.enemies).id;
    const member = enemy(state, x + i * spacing, variant);
    member.extraSpeed = leader.extraSpeed;
    group.push(member);
  }
  return group;
}

function coinPath(state: GameState, pattern: string, startX: number, width: number) {
  const points: WorldObject[] = [];
  const count = [
    "scatter",
    "zigzag",
    "double-arc",
    "diamond",
    "helix",
    "ripple",
    "ladder",
  ].includes(pattern)
    ? 13
    : 7;
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
      case "zigzag":
        height = 15 + (i % 2) * 42;
        break;
      case "double-arc":
        height = 18 + Math.abs(Math.sin(fraction * Math.PI * 2)) * 48;
        break;
      case "diamond":
        height = 39 + (1 - Math.abs(fraction * 2 - 1)) * 26;
        break;
      case "helix":
        height = 39 + Math.sin(fraction * Math.PI * 3) * (i % 2 ? -25 : 25);
        break;
      case "ripple":
        height = 36 + Math.sin(fraction * Math.PI * 4) * 21;
        break;
      case "ladder":
        height = 12 + (i % 4) * 17;
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
    if (pattern === "diamond" && i > 0 && i < count - 1) {
      points.push({ ...points[points.length - 1], y: Config.floor - (78 - height) + yShift });
    }
  }
  return points;
}

function overlapsDanger(coin: WorldObject, object: WorldObject) {
  if (object.kind !== "hazard" && object.kind !== "enemy") return false;
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
  if (state.bossActive) {
    state.next = state.distance + 480;
    return (
      state.lastEncounter ?? {
        pattern: "boss",
        coinPattern: "ground",
        variants: ["boss"],
        gap: 0,
        width: 0,
      }
    );
  }
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
  const grouped = state.sector >= 4;
  switch (pattern) {
    case "hurdle":
      dangers.push(obstacle(state, x));
      break;
    case "escort":
    case "patrol":
      if (grouped) dangers.push(...enemyGroup(state, x, safetySpeed, 2));
      else dangers.push(enemy(state, x), enemy(state, x + separation));
      break;
    case "steps":
      dangers.push(obstacle(state, x), obstacle(state, x + separation));
      break;
    case "mixed": {
      const obstacleFirst = Random.next(state.rng) < 0.5;
      const enemyX = obstacleFirst ? x + separation : x;
      const group = grouped ? enemyGroup(state, enemyX, safetySpeed, 2) : [enemy(state, enemyX)];
      if (obstacleFirst) dangers.push(obstacle(state, x), ...group);
      else dangers.push(...group, obstacle(state, group.at(-1)!.x + separation));
      break;
    }
    case "squad":
      dangers.push(...enemyGroup(state, x, safetySpeed, state.sector >= 8 ? 4 : 3));
      break;
    case "crossfire":
      dangers.push(
        enemy(state, x, "sentry"),
        enemy(state, x + Math.max(separation, safetySpeed * 1.9)),
        enemy(state, x + Math.max(separation, safetySpeed * 1.9) * 2, "wasp"),
      );
      break;
    case "convoy":
      dangers.push(...enemyGroup(state, x, safetySpeed, 3));
      break;
    case "coin-break":
      break;
    default:
      throw new Error("Unknown encounter: " + pattern);
  }

  const platformRoll = Random.next(state.rng);
  if (platformRoll < 0.28) {
    const route =
      platformRoutes[Math.min(platformRoutes.length - 1, Math.floor(platformRoll / 0.07))];
    let px = Math.max(x, ...dangers.map((o) => o.x + o.w)) + Math.max(180, safetySpeed);
    for (const [variant, width, height, gap] of route) {
      const y = Config.floor - height;
      dangers.push({
        kind: "platform",
        variant,
        x: px,
        y,
        w: width,
        h: variant === "bridge" ? 8 : variant === "step" ? 12 : 16,
      });
      for (let coinX = 10; coinX < width - 8; coinX += 22)
        dangers.push({ kind: "ember", variant: "platform", x: px + coinX, y: y - 12, w: 5, h: 6 });
      if (width >= 130 && state.sector >= 2) {
        const foe = enemy(state, px + width * 0.57, "crawler");
        foe.y = foe.baseY = y - foe.h;
        foe.amplitude = 0;
        foe.extraSpeed = 0;
        dangers.push(foe);
      }
      px += width + gap;
    }
  }
  const end = dangers.reduce((right, item) => Math.max(right, item.x + item.w), x);
  const coins = coinPath(state, coinPattern, x - 24, Math.max(115, end - x + 95));
  const safeCoins = coins.filter((coin) => !dangers.some((danger) => overlapsDanger(coin, danger)));
  // Every chunk retains a reward even if a new content definition blocks its trail.
  if (safeCoins.length < 2) safeCoins.push(...coinPath(state, "ground", end + 25, 90));
  const platformCoins = dangers.filter((o) => o.kind === "ember");
  const safePlatformCoins = platformCoins.filter((c) => !dangers.some((d) => overlapsDanger(c, d)));
  state.objects.push(
    ...dangers.filter((o) => o.kind !== "ember"),
    ...safeCoins,
    ...safePlatformCoins,
  );
  const drop = Random.next(state.rng);
  if (drop < 0.05)
    state.objects.push({
      kind: "heart",
      variant: "heart",
      rarity: drop < 0.01 ? "rare" : "uncommon",
      x: end + 35,
      y: Config.floor - 32,
      w: 9,
      h: 9,
    });
  else if (drop < 0.17) {
    const roll = Random.next(state.rng);
    state.objects.push({
      kind: "powerup",
      variant: roll < 0.65 ? "blast" : roll < 0.92 ? "titan" : "flight",
      rarity: roll < 0.65 ? "rare" : roll < 0.92 ? "epic" : "legendary",
      x: end + 35,
      y: Config.floor - 40,
      w: 12,
      h: 12,
    });
  }
  // One combined 5% roll per encounter, split equally between the two devices.
  let travelEnd = end;
  if (Random.next(state.rng) < Config.traversal.spawnChance) {
    const kind = Random.next(state.rng) < 0.5 ? "portal" : "pad";
    const device = {
      kind,
      x: end + Math.max(95, safetySpeed * 0.65),
      y: Config.floor - (kind === "portal" ? 43 : 5),
      w: kind === "portal" ? 22 : 26,
      h: kind === "portal" ? 43 : 5,
      age: 0,
    } as const;
    state.traversals.push(device);
    const approaches = state.traversals.filter((item) => !item.role);
    if (approaches.length > 4)
      state.traversals = state.traversals.filter((item) => item !== approaches[0]);
    travelEnd = device.x + device.w;
  }

  const gap =
    Difficulty.gapSeconds(state.sector, state.rules) +
    Random.range(state.rng, 0, Config.generation.gapVariationSeconds);
  const occupiedWidth = Math.max(travelEnd, ...safeCoins.map((coin) => coin.x + coin.w)) - x;
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

function evolve(object: WorldObject, time: number) {
  if (object.kind !== "enemy" || object.variant === "boss") return;
  const level = Math.min(4, Math.floor(time / 40));
  const previous = object.evolution ?? 0;
  if (level <= previous) return;
  object.hp =
    (object.hp ?? Combat.durability(object)) + Combat.durability(object) * (level - previous) * 0.3;
  object.evolution = level;
}
function move(object: WorldObject, speed: number, dt: number) {
  if (object.variant === "boss") {
    object.age = (object.age ?? 0) + dt;
    object.x += (300 - object.x) * Math.min(1, dt * 2);
    object.y =
      object.baseY! + Math.sin(object.age * object.frequency! + object.phase!) * object.amplitude!;
    return;
  }
  object.x -= (speed + (object.extraSpeed || 0)) * dt;
  if (object.kind === "enemy") {
    object.age = (object.age ?? 0) + dt;
    object.y =
      object.baseY! + Math.sin(object.age * object.frequency! + object.phase!) * object.amplitude!;
  }
}

export = { evolve, spawn, obstacle, enemy, coinPath, overlapsDanger, move };
