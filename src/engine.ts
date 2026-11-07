import type { Seed } from "./types";
import type { GameEvent, GameState, Player, WorldObject } from "./types";
import Powerups from "./powerups";
import Config from "./config";
import Random from "./random";
import Difficulty from "./difficulty";
import Generator from "./generator";
import Loadout from "./loadout";
import Combat from "./combat";
import Upgrades from "./upgrades";
import EnemyFire from "./enemy-fire";
import Traversal from "./traversal";

function create(
  seed: Seed = Math.floor(Math.random() * 0xffffffff),
  equipment?: unknown,
  upgradeLevels?: unknown,
): GameState {
  const loadout = Loadout.sanitize(equipment);
  const rules = Loadout.rules(loadout);
  return {
    grounding: false,
    crouching: false,
    strafe: 0,
    powerups: [],
    activePowerup: null,
    seed,
    loadout,
    rules,
    stats: Upgrades.stats(upgradeLevels),
    dashId: 0,
    health: rules.health,
    mode: "menu",
    time: 0,
    distance: 0,
    score: 0n,
    scoreRemainder: 0,
    sector: 1,
    hits: 0,
    embers: 0,
    pickups: 0,
    combo: 0,
    cooldown: 0,
    dash: 0,
    invincible: 0,
    attackCooldown: 0,
    attackTime: 0,
    attackId: 0,
    projectiles: [],
    hostileProjectiles: [],
    traversals: [],
    traversalEffect: null,
    next: Config.generation.initialDistance,
    rng: Random.create(seed),
    sceneryRng: Random.create(seed + ":scenery"),
    paceRng: Random.create(seed + ":pace"),
    player: { x: Config.playerX, y: Config.floor - Config.playerHeight, vy: 0, jumps: 0 },
    objects: [],
    events: [],
    speed: Config.speed.start * rules.speed,
    runSpeed: Config.speed.start * rules.speed,
    targetSpeed: Config.speed.start * rules.speed,
    pace: "cruise",
    nextPaceTime: 12,
    paceBag: [],
    biome: "city",
    previousBiome: "city",
    biomeBlend: 1,
    biomeBag: [],
    groupIndex: 0,
    biomeIndex: 0,
    bossActive: false,
    parallax: 0,
    patternBag: [],
    coinBag: [],
    patternPool: "",
    lastVariant: {},
    lastPattern: null,
    lastCoinPattern: null,
    lastEncounter: null,
    encounterCount: 0,
  };
}
function emit(
  state: GameState,
  type: string,
  x: number,
  y: number,
  extra: Partial<GameEvent> = {},
) {
  state.events.push({ type, x, y, ...extra });
}
function addScore(state: GameState, points: number) {
  state.score += BigInt(points);
}
function laneTarget(home: number, strafe: number, dashBonus: number) {
  return Math.max(12, Math.min(Config.width - 36, home + strafe * Config.strafeReach + dashBonus));
}
function seekX(x: number, target: number, dt: number, dashing: boolean, dashSpeed: number) {
  const delta = target - x;
  if (!delta) return x;
  const speed = dashing && delta > 0 ? dashSpeed : delta < 0 ? Config.dashReturnSpeed : 220;
  return x + Math.sign(delta) * Math.min(Math.abs(delta), dt * speed);
}
function jump(state: GameState) {
  if (
    state.mode !== "playing" ||
    state.grounding ||
    state.crouching ||
    state.player.jumps >= state.stats.maxJumps
  )
    return false;
  state.player.vy =
    state.player.jumps === 0
      ? state.stats.jumpVelocity
      : state.player.jumps === 1
        ? state.stats.doubleJumpVelocity
        : state.stats.thirdJumpVelocity;
  state.player.jumps++;
  emit(state, "jump", state.player.x, state.player.y + 17);
  return true;
}
function ground(state: GameState) {
  if (
    state.mode !== "playing" ||
    state.hits >= state.health ||
    state.grounding ||
    state.player.y >= Config.floor - Config.playerHeight
  )
    return false;
  state.grounding = true;
  state.player.vy = Math.max(520, state.player.vy);
  if (state.activePowerup?.id === "flight") state.activePowerup = null;
  emit(state, "ground", state.player.x, state.player.y + Config.playerHeight);
  return true;
}
function groundStep(state: GameState) {
  if (!state.grounding) return;
  if (state.player.y >= Config.floor - Config.playerHeight) {
    state.grounding = false;
    emit(state, "ground-land", state.player.x, Config.floor);
  } else state.player.vy = Math.max(520, state.player.vy);
}
function dash(state: GameState) {
  if (state.mode !== "playing" || state.cooldown > 0) return false;
  state.dashId++;
  state.dash = state.stats.dashDuration;
  state.cooldown = state.stats.dashCooldown;
  emit(state, "dash", state.player.x, state.player.y + 8);
  return true;
}
function collides(
  player: Player,
  object: WorldObject,
  previousX: number,
  previousPlayerX = player.x ?? Config.playerX,
  crouching = false,
) {
  const relativeStart = previousX - previousPlayerX;
  const relativeEnd = object.x - (player.x ?? Config.playerX);
  return (
    11 > Math.min(relativeStart, relativeEnd) + 2 &&
    2 < Math.max(relativeStart, relativeEnd) + object.w - 2 &&
    player.y + 17 > object.y + 1 &&
    player.y + (crouching ? 10 : 2) < object.y + object.h - 1
  );
}
function collect(state: GameState, object: WorldObject) {
  object.dead = true;
  state.pickups++;
  state.embers += state.rules.coinReward;
  state.combo++;
  const points = 50 + Math.min(state.combo, 20) * 5;
  addScore(state, points);
  state.cooldown = Math.max(0, state.cooldown - Config.pickupRecharge);
  emit(state, "pickup", object.x, object.y, {
    points,
    coins: state.rules.coinReward,
    label: state.rules.coinReward ? "COIN" : "NO COINS",
  });
}
function hit(state: GameState, object: WorldObject) {
  if (state.activePowerup?.id === "titan" && object.kind === "enemy") {
    Combat.damage(state, object, 10, "titan");
    return;
  }
  if (state.dash > 0 && object.kind === "enemy") {
    if (object.lastDash !== state.dashId) {
      object.lastDash = state.dashId;
      Combat.damage(state, object, state.stats.damageMultiplier, "dash");
    }
  } else if (state.invincible <= 0) {
    state.hits++;
    state.combo = 0;
    state.invincible = Config.damageGrace;
    if (object.variant !== "boss") object.dead = true;
    emit(state, "hit", state.player.x, state.player.y);
    if (state.hits >= state.health) {
      state.mode = "dead";
      emit(state, "death", state.player.x, state.player.y);
    }
  }
}
function step(state: GameState, dt: number) {
  state.time += dt;
  Difficulty.update(state, dt);
  const dashing = state.dash > 0;
  state.runSpeed =
    state.speed *
    (state.traversalEffect?.kind === "pad" ? 1.8 : dashing ? state.stats.dashWorldMultiplier : 1);
  state.distance += state.runSpeed * dt;
  state.scoreRemainder += state.runSpeed * dt;
  const points = Math.floor(state.scoreRemainder);
  if (points) {
    addScore(state, points);
    state.scoreRemainder -= points;
  }
  state.cooldown = Math.max(0, state.cooldown - dt);
  state.invincible = Math.max(0, state.invincible - dt);
  state.attackCooldown = Math.max(0, state.attackCooldown - dt);
  const player = state.player;
  const previousPlayerX = player.x;
  player.x = seekX(
    player.x,
    laneTarget(Config.playerX, state.strafe || 0, dashing ? state.stats.dashLungeMax : 0),
    dt,
    dashing,
    state.stats.dashLungeSpeed,
  );
  const previousY = player.y;
  groundStep(state);
  player.vy += Config.gravity * dt;
  player.y += player.vy * dt;
  if (player.y >= Config.floor - Config.playerHeight) {
    player.y = Config.floor - Config.playerHeight;
    player.vy = 0;
    player.jumps = 0;
  }
  groundStep(state);
  Powerups.update(state, dt);
  Powerups.land(state, previousY, dt);
  if (state.distance >= state.next) Generator.spawn(state);
  const previousPositions = new Map();
  for (const object of state.objects) {
    previousPositions.set(object, object.x);
    Generator.evolve(object, state.time);
    Generator.move(object, state.runSpeed, dt);
  }
  // Attacks resolve before body collisions, so a well-timed punch saves the run.
  Traversal.update(state, dt);
  Combat.update(state, dt);
  EnemyFire.update(state, dt);
  for (const bolt of state.hostileProjectiles) {
    if (!EnemyFire.hitsPlayer(bolt, state.player, state.crouching)) continue;
    bolt.life = 0;
    if (state.dash > 0) {
      addScore(state, 25);
      emit(state, "deflect", bolt.x, bolt.y, { points: 25, label: "DEFLECT" });
    } else hit(state, { kind: "hazard", variant: "shot", x: bolt.x, y: bolt.y, w: 4, h: 4 });
    if (state.mode === "dead") break;
  }
  state.hostileProjectiles = state.hostileProjectiles.filter((bolt) => bolt.life > 0);
  for (const object of state.objects) {
    if (state.hits >= state.health) break;
    if (object.dead || object.kind === "platform") continue;
    if (
      !object.passed &&
      collides(player, object, previousPositions.get(object)!, previousPlayerX, state.crouching)
    ) {
      if (Powerups.collect(state, object)) continue;
      if (object.kind === "ember") collect(state, object);
      else hit(state, object);
    }
    if (
      !object.dead &&
      (object.kind === "hazard" || object.kind === "enemy") &&
      !object.passed &&
      object.x + object.w < player.x
    ) {
      object.passed = true;
      addScore(state, 25);
      emit(state, "clear", object.x, object.y, { points: 25, label: "CLEAR" });
    }
    if (state.mode === "dead") break;
  }
  state.dash = Math.max(0, state.dash - dt);
  state.attackTime = Math.max(0, state.attackTime - dt);
  state.objects = state.objects.filter((object) => !object.dead && object.x + object.w > -40);
}
function update(state: GameState, seconds: number) {
  if (state.mode !== "playing" || !Number.isFinite(seconds)) return;
  let remaining = Math.min(Config.maxFrameSeconds, Math.max(0, seconds));
  while (remaining > 1e-9 && state.mode === "playing") {
    const dt = Math.min(Config.simulationStep, remaining);
    step(state, dt);
    remaining -= dt;
  }
}
export = {
  laneTarget,
  seekX,
  ground,
  groundStep,
  powerup: Powerups.activate,
  activatePowerup: Powerups.activate,
  create,
  update,
  jump,
  dash,
  attack: Combat.attack,
  collides,
  hit,
  collect,
};
