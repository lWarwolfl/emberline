import type { GameState, Loadout, Seed, UpgradeLevels } from "./types";
import Engine from "./engine";
import Powerups from "./powerups";
import Config from "./config";
import Difficulty from "./difficulty";
import Generator from "./generator";
import Combat from "./combat";
import EnemyFire from "./enemy-fire";
import Traversal from "./traversal";
import Loadouts from "./loadout";
import Upgrades from "./upgrades";

export interface Profile {
  name: string;
  loadout: Loadout;
  levels: UpgradeLevels;
}
export interface Member {
  id: string;
  name: string;
  connected: boolean;
  state: GameState;
}
export interface Checkpoint {
  x: number;
  age: number;
  used: boolean;
  flash: number;
}
export interface PartyRun {
  world: GameState;
  members: Member[];
  order: string[];
  checkpoint: Checkpoint | null;
  beaconDistance: number;
  started: boolean;
  earned: number;
  revision: number;
  countdown: number;
}
export type Action =
  | "jump"
  | "dash"
  | "attack"
  | "powerup"
  | "ground"
  | "strafe-left"
  | "strafe-right"
  | "strafe-stop"
  | "crouch"
  | "stand";
export function progress(run: PartyRun) {
  return {
    value: Math.max(
      0,
      Math.min(
        1,
        (run.world.distance - run.beaconDistance + Config.beaconInterval) / Config.beaconInterval,
      ),
    ),
    remaining: Math.max(0, run.beaconDistance - run.world.distance),
    distance: run.beaconDistance,
  };
}
export function profile(value: unknown): Profile {
  const p = (value && typeof value === "object" ? value : {}) as Partial<Profile>;
  return {
    name:
      String(p.name || "Courier")
        .split("")
        .filter((char) => char.charCodeAt(0) >= 32)
        .join("")
        .trim()
        .slice(0, 18) || "Courier",
    loadout: Loadouts.sanitize(p.loadout),
    levels: Upgrades.sanitize(p.levels),
  };
}
export function create(id: string, p: Profile, seed?: Seed): PartyRun {
  const world = Engine.create(seed, p.loadout);
  const run: PartyRun = {
    world,
    members: [],
    order: [],
    checkpoint: null,
    beaconDistance: Config.beaconInterval,
    started: false,
    earned: 0,
    revision: 0,
    countdown: 0,
  };
  add(run, id, p);
  return run;
}
export function add(run: PartyRun, id: string, value: Profile) {
  if (run.started || run.members.length >= 4 || run.members.some((m) => m.id === id)) return false;
  const p = profile(value);
  const state = Engine.create(run.world.seed, p.loadout, p.levels);
  // Impact IDs are unique between couriers, including after a restart.
  state.attackId = state.dashId = run.members.length * 1000000;
  run.members.push({ id, name: p.name, state, connected: true });
  run.order.push(id);
  formation(run, true);
  return true;
}
export function sorted(run: PartyRun) {
  return run.order.map((id) => run.members.find((m) => m.id === id)!).filter(Boolean);
}
export function alive(member: Member) {
  return member.connected && member.state.hits < member.state.health;
}
export function scaling(count: number) {
  const extra = Math.max(0, Math.min(3, count - 1));
  return {
    speed: 1 + extra * 0.06,
    growth: 1 + extra * 0.12,
    density: 1 + extra * 0.22,
    armor: 1 + extra * 0.2,
  };
}
function place(run: PartyRun, member: Member, index: number, dt: number, instant: boolean) {
  const state = member.state;
  const home =
    Config.playerX + (run.members.filter((item) => item.connected).length - index - 1) * 32;
  const dashing = !instant && state.dash > 0;
  const strafe = state.strafe || 0;
  const target = Engine.laneTarget(
    instant ? home : Engine.strafeAnchor(state.player.x, home, strafe, dashing),
    instant ? 0 : strafe,
    !instant && dashing ? state.stats.dashLungeMax : 0,
  );
  state.player.x = instant
    ? target
    : Engine.seekX(
        state.player.x,
        target,
        dt,
        dashing,
        state.stats.dashLungeSpeed,
        strafe === 0 ? 0 : Config.strafeSpeed,
      );
}
function formation(run: PartyRun, instant = false, dt = 0) {
  for (const [index, member] of sorted(run).filter(alive).entries())
    place(run, member, index, dt, instant);
}
export function start(run: PartyRun, hold = false) {
  const base = Loadouts.rules(run.world.loadout);
  run.world = Engine.create(run.world.seed, run.world.loadout);
  const scale = scaling(run.members.filter((m) => m.connected).length);
  run.world.rules = {
    ...base,
    speed: base.speed * scale.speed,
    growth: base.growth * scale.growth,
    gap: base.gap / scale.density,
  };
  const counting = hold && run.members.filter((member) => member.connected).length > 1;
  run.countdown = counting ? 3 : 0;
  const mode = counting ? "countdown" : "playing";
  run.world.mode = mode;
  for (const [i, m] of run.members.entries()) {
    const previous = m.state;
    m.state = Engine.create(run.world.seed, previous.loadout, previous.stats.levels);
    m.state.rules = { ...run.world.rules };
    m.state.health = base.health;
    m.state.attackId = m.state.dashId = i * 1000000;
    m.state.mode = mode;
  }
  run.started = true;
  run.revision++;
  run.checkpoint = null;
  run.beaconDistance = Config.beaconInterval;
  formation(run, true);
}
export function disconnect(run: PartyRun, id: string) {
  const m = run.members.find((m) => m.id === id);
  if (!m) return;
  if (!run.started) {
    run.members = run.members.filter((m) => m.id !== id);
    run.order = run.order.filter((p) => p !== id);
  } else {
    m.connected = false;
    m.state.mode = "dead";
    if (!run.members.some(alive)) run.world.mode = "dead";
    const base = Loadouts.rules(run.world.loadout);
    const scale = scaling(run.members.filter((m) => m.connected).length);
    run.world.rules = {
      ...base,
      speed: base.speed * scale.speed,
      growth: base.growth * scale.growth,
      gap: base.gap / scale.density,
    };
  }
  formation(run, true);
}
export function action(run: PartyRun, id: string, action: Action) {
  const m = run.members.find((m) => m.id === id);
  if (!m || !alive(m) || run.world.mode !== "playing") return false;
  const s = m.state;
  s.objects = run.world.objects;
  s.projectiles = run.world.projectiles;
  s.runSpeed = run.world.runSpeed;
  if (action === "strafe-left" || action === "strafe-right" || action === "strafe-stop") {
    s.strafe = action === "strafe-left" ? -1 : action === "strafe-right" ? 1 : 0;
    return true;
  }
  if (action === "crouch" || action === "stand") {
    s.crouching = action === "crouch";
    return true;
  }
  const previousScore = s.score;
  const acted = Engine[action](s);
  run.world.score += s.score - previousScore;
  return acted;
}
function drain(run: PartyRun, m: Member) {
  for (const event of m.state.events.splice(0)) {
    if (event.type === "death") event.type = "down";
    event.playerId = m.id;
    run.earned += event.coins || 0;
    run.world.events.push(event);
  }
}
function revive(run: PartyRun) {
  for (const m of run.members) {
    if (!m.connected || alive(m)) continue;
    Object.assign(m.state, { hits: 0, invincible: 2, mode: "playing", dash: 0, grounding: false });
    Object.assign(m.state.player, { y: Config.floor - Config.playerHeight, vy: 0, jumps: 0 });
  }
  formation(run, true);
}
function step(run: PartyRun, dt: number) {
  const w = run.world;
  w.time += dt;
  Difficulty.update(w, dt);
  const live = sorted(run).filter(alive);
  if (!live.length) {
    w.mode = "dead";
    return;
  }
  w.runSpeed = w.speed * (w.traversalEffect?.kind === "pad" ? 1.8 : 1);
  const distance = w.runSpeed * dt;
  w.distance += distance;
  w.scoreRemainder += distance;
  const points = Math.floor(w.scoreRemainder);
  w.score += BigInt(points);
  w.scoreRemainder -= points;
  formation(run, false, dt);
  for (const m of live) {
    const s = m.state;
    s.mode = "playing";
    s.time = w.time;
    s.distance = w.distance;
    s.runSpeed = w.runSpeed;
    s.rules = w.rules;
    s.objects = w.objects;
    s.projectiles = w.projectiles;
    s.cooldown = Math.max(0, s.cooldown - dt);
    s.invincible = Math.max(0, s.invincible - dt);
    s.attackCooldown = Math.max(0, s.attackCooldown - dt);
    const previousY = s.player.y;
    Engine.groundStep(s);
    s.player.vy += Config.gravity * dt;
    s.player.y += s.player.vy * dt;
    Powerups.update(s, dt);
    Powerups.land(s, previousY, dt);
    if (s.player.y >= Config.floor - Config.playerHeight)
      Object.assign(s.player, { y: Config.floor - Config.playerHeight, vy: 0, jumps: 0 });
    Engine.groundStep(s);
  }
  if (w.distance >= w.next) {
    const before = w.objects.length;
    Generator.spawn(w);
    const scale = scaling(run.members.filter((m) => m.connected).length);
    // Scaling applies once, only to newly spawned enemies.
    for (const object of w.objects.slice(before))
      if (object.kind === "enemy")
        object.hp = (object.hp ?? Combat.durability(object)) * scale.armor;
  }
  const previous = new Map(w.objects.map((o) => [o, o.x]));
  for (const object of w.objects) {
    Generator.evolve(object, w.time);
    Generator.move(object, w.runSpeed, dt);
  }
  // Front courier is the locked-aim target. Any courier in the line can intercept the shot.
  w.player = live[0].state.player;
  const beforeTravel = w.distance;
  Traversal.update(w, dt);
  if (w.distance !== beforeTravel) {
    for (const m of live) {
      m.state.invincible = Config.traversal.arrivalGrace;
      Object.assign(m.state.player, {
        y: Config.floor - Config.playerHeight,
        jumps: w.traversalEffect?.kind === "pad" ? 1 : 0,
        vy: w.traversalEffect?.kind === "pad" ? -260 : 0,
      });
    }
    formation(run, true);
  }
  for (const [i, m] of live.entries()) {
    const s = m.state;
    s.objects = w.objects;
    s.projectiles = w.projectiles;
    const score = s.score;
    Combat.update(s, dt, i === 0);
    w.projectiles = s.projectiles;
    w.score += s.score - score;
  }
  EnemyFire.update(w, dt);
  // Swept projectiles resolve against the frontmost intersecting body, once only.
  for (const bolt of w.hostileProjectiles) {
    const target = live.find(
      (m) => alive(m) && EnemyFire.hitsPlayer(bolt, m.state.player, m.state.crouching),
    );
    if (!target) continue;
    bolt.life = 0;
    if (target.state.dash > 0) {
      w.score += 25n;
      target.state.events.push({
        type: "deflect",
        x: bolt.x,
        y: bolt.y,
        points: 25,
        label: "DEFLECT",
      });
    } else
      Engine.hit(target.state, {
        kind: "hazard",
        variant: "shot",
        x: bolt.x,
        y: bolt.y,
        w: 4,
        h: 4,
      });
  }
  w.hostileProjectiles = w.hostileProjectiles.filter((b) => b.life > 0);
  for (const object of w.objects) {
    if (object.dead || object.passed || object.kind === "platform") continue;
    const target = live.find(
      (m) =>
        alive(m) &&
        (object.kind !== "powerup" || m.state.powerups.length < 3) &&
        Engine.collides(
          m.state.player,
          object,
          previous.get(object) ?? object.x,
          m.state.player.x,
          m.state.crouching,
        ),
    );
    if (target) {
      const s = target.state,
        score = s.score;
      if (Powerups.collect(s, object)) {
        w.score += s.score - score;
        continue;
      }
      if (object.kind === "ember") {
        Engine.collect(s, object);
        w.embers += s.rules.coinReward;
      } else Engine.hit(s, object);
      w.score += s.score - score;
    }
    // Passing the leader must never disable collisions for the followers.
    if (
      !object.dead &&
      !object.passed &&
      (object.kind === "hazard" || object.kind === "enemy") &&
      object.x + object.w < Math.min(...live.filter(alive).map((m) => m.state.player.x))
    ) {
      object.passed = true;
      w.score += 25n;
    }
  }
  const anchor = Config.playerX + (run.members.filter((m) => m.connected).length - 1) * 32;
  if (!run.checkpoint && run.beaconDistance - w.distance <= Config.width + 36 - anchor) {
    run.checkpoint = {
      x: Math.max(anchor + 30, anchor + run.beaconDistance - w.distance + distance),
      age: 0,
      used: false,
      flash: 0,
    };
  }
  const beacon = run.checkpoint;
  if (beacon) {
    const oldX = beacon.x;
    beacon.x -= w.runSpeed * dt;
    beacon.age += dt;
    beacon.flash = Math.max(0, beacon.flash - dt);
    const activator = live.find(
      (m) =>
        alive(m) &&
        m.state.dash > 0 &&
        Engine.collides(
          m.state.player,
          { kind: "hazard", variant: "beacon", x: beacon.x, y: Config.floor - 52, w: 22, h: 52 },
          oldX,
        ),
    );
    if (!beacon.used && activator) {
      const count = run.members.filter((m) => m.connected && !alive(m)).length;
      beacon.used = true;
      beacon.flash = 1;
      revive(run);
      w.events.push({
        type: "revive",
        x: beacon.x,
        y: Config.floor - 30,
        label: count ? `${count} COURIER${count === 1 ? "" : "S"} REVIVED` : "BEACON ACTIVATED",
      });
      run.revision++;
    }
    if (beacon.x < -80) {
      run.checkpoint = null;
      run.beaconDistance += Config.beaconInterval;
    }
  }
  for (const m of live) {
    m.state.dash = Math.max(0, m.state.dash - dt);
    m.state.attackTime = Math.max(0, m.state.attackTime - dt);
    drain(run, m);
  }
  w.objects = w.objects.filter((o) => !o.dead && o.x + o.w > -40);
  if (!run.members.some(alive)) {
    w.mode = "dead";
    w.events.push({ type: "death", x: w.player.x, y: w.player.y });
  }
}
export function update(run: PartyRun, seconds: number) {
  if (!Number.isFinite(seconds)) return;
  if (run.countdown > 0) {
    run.countdown = Math.max(
      0,
      run.countdown - Math.min(Config.maxFrameSeconds, Math.max(0, seconds)),
    );
    if (run.countdown > 0) return;
    run.world.mode = "playing";
    for (const member of run.members) if (member.connected) member.state.mode = "playing";
    return;
  }
  if (run.world.mode !== "playing") return;
  let remaining = Math.min(Config.maxFrameSeconds, Math.max(0, seconds));
  while (remaining > 1e-9 && run.world.mode === "playing") {
    const dt = Math.min(Config.simulationStep, remaining);
    step(run, dt);
    remaining -= dt;
  }
}
function coast(run: PartyRun, dt: number) {
  const w = run.world;
  w.time += dt;
  w.biomeBlend = Math.min(1, w.biomeBlend + dt / Config.generation.themeFadeSeconds);
  w.runSpeed = w.speed * (w.traversalEffect?.kind === "pad" ? 1.8 : 1);
  if (w.traversalEffect) {
    w.traversalEffect.life -= dt;
    if (w.traversalEffect.life <= 0) w.traversalEffect = null;
  }
  const distance = w.runSpeed * dt;
  w.distance += distance;
  formation(run, false, dt);
  for (const m of sorted(run).filter(alive)) {
    const s = m.state;
    s.time = w.time;
    s.distance = w.distance;
    s.runSpeed = w.runSpeed;
    s.objects = w.objects;
    s.dash = Math.max(0, s.dash - dt);
    s.attackTime = Math.max(0, s.attackTime - dt);
    s.cooldown = Math.max(0, s.cooldown - dt);
    s.invincible = Math.max(0, s.invincible - dt);
    s.attackCooldown = Math.max(0, s.attackCooldown - dt);
    if (s.grounding) {
      if (s.player.y >= Config.floor - Config.playerHeight) s.grounding = false;
      else s.player.vy = Math.max(520, s.player.vy);
    }
    const previousY = s.player.y;
    s.player.vy += Config.gravity * dt;
    s.player.y += s.player.vy * dt;
    Powerups.update(s, dt);
    Powerups.land(s, previousY, dt);
    if (s.player.y >= Config.floor - Config.playerHeight)
      Object.assign(s.player, { y: Config.floor - Config.playerHeight, vy: 0, jumps: 0 });
  }
  for (const object of w.objects) Generator.move(object, w.runSpeed, dt);
  for (const bolt of w.projectiles) {
    bolt.x += bolt.vx * dt;
    bolt.y += bolt.vy * dt;
  }
  for (const bolt of w.hostileProjectiles) {
    bolt.previousX = bolt.x;
    bolt.previousY = bolt.y;
    bolt.x += bolt.vx * dt;
    bolt.y += bolt.vy * dt;
  }
  for (const device of w.traversals) {
    device.x -= distance;
    device.age += dt;
  }
  if (run.checkpoint) {
    run.checkpoint.x -= distance;
    run.checkpoint.age += dt;
    run.checkpoint.flash = Math.max(0, run.checkpoint.flash - dt);
  }
}
const catchupLimit = 0.25;
/** Guest-only motion. Spawning, hits and score stay with the host snapshot. */
export function glide(run: PartyRun, seconds: number) {
  if (run.world.mode !== "playing" || !Number.isFinite(seconds) || seconds <= 0) return;
  let remaining = Math.min(catchupLimit, seconds);
  while (remaining > 1e-9 && run.world.mode === "playing") {
    const dt = Math.min(Config.simulationStep, remaining);
    coast(run, dt);
    remaining -= dt;
  }
}
function approach(current: number, next: number, amount: number, limit: number) {
  const delta = next - current;
  return Math.abs(delta) > limit ? next : current + delta * amount;
}
function copyMember(member: Member): Member {
  const copy = JSON.parse(
    JSON.stringify(member, (_key, value) => (typeof value === "bigint" ? value.toString() : value)),
  ) as Member;
  copy.state.score = BigInt(copy.state.score);
  return copy;
}
function takeClosest<T>(pool: T[], score: (item: T) => number | null) {
  let best = -1;
  let bestScore = Infinity;
  for (let i = 0; i < pool.length; i++) {
    const value = score(pool[i]);
    if (value === null || value >= bestScore) continue;
    best = i;
    bestScore = value;
  }
  return best < 0 ? null : pool.splice(best, 1)[0];
}
/** Pull a guest's moving picture toward a host snapshot without teleporting small gaps. */
export function ease(shown: PartyRun, authority: PartyRun, seconds: number) {
  const amount = 1 - Math.exp(-18 * Math.max(0, seconds));
  const from = authority.world;
  const to = shown.world;
  to.distance = approach(to.distance, from.distance, amount, 80);
  if (Math.abs(from.distance - to.distance) > 80) to.parallax = from.parallax;
  to.mode = from.mode;
  to.rules = from.rules;
  to.speed = from.speed;
  to.targetSpeed = from.targetSpeed;
  to.runSpeed = from.runSpeed;
  to.pace = from.pace;
  to.nextPaceTime = from.nextPaceTime;
  to.paceBag = from.paceBag;
  to.sector = from.sector;
  to.biome = from.biome;
  to.previousBiome = from.previousBiome;
  to.biomeBlend = from.biomeBlend;
  to.biomeBag = from.biomeBag;
  to.groupIndex = from.groupIndex;
  to.biomeIndex = from.biomeIndex;
  to.bossActive = from.bossActive;
  to.score = from.score;
  to.scoreRemainder = from.scoreRemainder;
  to.embers = from.embers;
  to.pickups = from.pickups;
  to.combo = from.combo;
  to.seed = from.seed;
  to.loadout = from.loadout;
  to.stats = from.stats;
  to.next = from.next;
  to.rng = from.rng;
  to.sceneryRng = from.sceneryRng;
  to.paceRng = from.paceRng;
  to.patternBag = from.patternBag;
  to.coinBag = from.coinBag;
  to.patternPool = from.patternPool;
  to.lastVariant = from.lastVariant;
  to.lastPattern = from.lastPattern;
  to.lastCoinPattern = from.lastCoinPattern;
  to.lastEncounter = from.lastEncounter;
  to.encounterCount = from.encounterCount;
  to.traversalEffect = from.traversalEffect ? { ...from.traversalEffect } : null;
  const objects = shown.world.objects.slice();
  shown.world.objects = from.objects.map((target) => {
    let current = takeClosest(objects, (item) =>
      item.kind === target.kind && item.variant === target.variant
        ? Math.hypot(item.x - target.x, item.y - target.y)
        : null,
    );
    if (current && Math.hypot(current.x - target.x, current.y - target.y) > 36) {
      objects.push(current);
      current = null;
    }
    if (!current) return { ...target };
    current.x = approach(current.x, target.x, amount, 48);
    current.y = approach(current.y, target.y, amount, 36);
    Object.assign(current, {
      w: target.w,
      h: target.h,
      hp: target.hp,
      dead: target.dead,
      passed: target.passed,
      evolution: target.evolution,
      baseY: target.baseY,
      amplitude: target.amplitude,
      frequency: target.frequency,
      extraSpeed: target.extraSpeed,
      phase: target.phase,
      age: target.age,
      charge: target.charge,
      aimX: target.aimX,
      aimY: target.aimY,
      shotCooldown: target.shotCooldown,
      rarity: target.rarity,
    });
    return current;
  });
  const bolts = shown.world.projectiles.slice();
  shown.world.projectiles = from.projectiles.map((target) => {
    let current = takeClosest(bolts, (item) =>
      item.color === target.color ? Math.hypot(item.x - target.x, item.y - target.y) : null,
    );
    if (current && Math.hypot(current.x - target.x, current.y - target.y) > 48) {
      bolts.push(current);
      current = null;
    }
    if (!current) return { ...target, hitTargets: [] };
    current.x = approach(current.x, target.x, amount, 48);
    current.y = approach(current.y, target.y, amount, 36);
    Object.assign(current, {
      vx: target.vx,
      vy: target.vy,
      life: target.life,
      damage: target.damage,
      armored: target.armored,
      pierce: target.pierce,
    });
    return current;
  });
  const hostile = shown.world.hostileProjectiles.slice();
  shown.world.hostileProjectiles = from.hostileProjectiles.map((target) => {
    let current = takeClosest(hostile, (item) => Math.hypot(item.x - target.x, item.y - target.y));
    if (current && Math.hypot(current.x - target.x, current.y - target.y) > 48) {
      hostile.push(current);
      current = null;
    }
    if (!current) return { ...target, hitTargets: [] };
    current.x = approach(current.x, target.x, amount, 48);
    current.y = approach(current.y, target.y, amount, 36);
    current.previousX = current.x;
    current.previousY = current.y;
    Object.assign(current, {
      vx: target.vx,
      vy: target.vy,
      life: target.life,
      damage: target.damage,
      color: target.color,
    });
    return current;
  });
  const devices = shown.world.traversals.slice();
  shown.world.traversals = from.traversals.map((target) => {
    let current = takeClosest(devices, (item) =>
      item.kind === target.kind && item.role === target.role ? Math.abs(item.x - target.x) : null,
    );
    if (current && Math.abs(current.x - target.x) > 80) {
      devices.push(current);
      current = null;
    }
    if (!current) return { ...target };
    current.x = approach(current.x, target.x, amount, 80);
    current.age = target.age;
    return current;
  });
  shown.members = authority.members.map((source) => {
    const member = shown.members.find((item) => item.id === source.id) ?? copyMember(source);
    member.name = source.name;
    member.connected = source.connected;
    const local = member.state;
    const remote = source.state;
    Object.assign(local, {
      mode: remote.mode,
      hits: remote.hits,
      health: remote.health,
      dash: remote.dash,
      cooldown: remote.cooldown,
      invincible: remote.invincible,
      attackCooldown: remote.attackCooldown,
      attackTime: remote.attackTime,
      attackId: remote.attackId,
      dashId: remote.dashId,
      grounding: remote.grounding,
      crouching: remote.crouching,
      strafe: remote.strafe,
      loadout: remote.loadout,
      stats: remote.stats,
      rules: remote.rules,
      powerups: remote.powerups.slice(),
      activePowerup: remote.activePowerup ? { ...remote.activePowerup } : null,
    });
    local.player.vy = remote.player.vy;
    local.player.jumps = remote.player.jumps;
    local.player.x = approach(local.player.x, remote.player.x, amount, 48);
    local.player.y = approach(local.player.y, remote.player.y, amount, 64);
    return member;
  });
  shown.order = authority.order.slice();
  shown.beaconDistance = authority.beaconDistance;
  shown.earned = authority.earned;
  shown.revision = authority.revision;
  shown.started = authority.started;
  shown.countdown = authority.countdown;
  if (!authority.checkpoint) shown.checkpoint = null;
  else if (!shown.checkpoint) shown.checkpoint = { ...authority.checkpoint };
  else {
    shown.checkpoint.x = approach(shown.checkpoint.x, authority.checkpoint.x, amount, 80);
    shown.checkpoint.age = authority.checkpoint.age;
    shown.checkpoint.used = authority.checkpoint.used;
    shown.checkpoint.flash = authority.checkpoint.flash;
  }
  const front = sorted(shown).find(alive);
  if (front) shown.world.player = front.state.player;
}
export function clone(run: PartyRun) {
  return decode(encode(run));
}
export function steer(run: PartyRun, id: string, seconds: number) {
  if (run.world.mode !== "playing" || !Number.isFinite(seconds) || seconds <= 0) return;
  const member = run.members.find((item) => item.id === id);
  if (!member || !alive(member)) return;
  let remaining = Math.min(0.2, seconds);
  while (remaining > 1e-9) {
    const dt = Math.min(Config.simulationStep, remaining);
    const s = member.state;
    s.objects = run.world.objects;
    s.runSpeed = run.world.runSpeed;
    s.time = run.world.time;
    s.dash = Math.max(0, s.dash - dt);
    s.attackTime = Math.max(0, s.attackTime - dt);
    s.cooldown = Math.max(0, s.cooldown - dt);
    s.invincible = Math.max(0, s.invincible - dt);
    s.attackCooldown = Math.max(0, s.attackCooldown - dt);
    const index = sorted(run)
      .filter(alive)
      .findIndex((item) => item.id === id);
    if (index >= 0) place(run, member, index, dt, false);
    if (s.grounding) {
      if (s.player.y >= Config.floor - Config.playerHeight) s.grounding = false;
      else s.player.vy = Math.max(520, s.player.vy);
    }
    const previousY = s.player.y;
    s.player.vy += Config.gravity * dt;
    s.player.y += s.player.vy * dt;
    Powerups.update(s, dt);
    Powerups.land(s, previousY, dt);
    if (s.player.y >= Config.floor - Config.playerHeight)
      Object.assign(s.player, { y: Config.floor - Config.playerHeight, vy: 0, jumps: 0 });
    remaining -= dt;
  }
}
export function adopt(target: PartyRun, source: PartyRun) {
  const copy = clone(source);
  target.world = copy.world;
  target.members = copy.members;
  target.order = copy.order.slice();
  target.checkpoint = copy.checkpoint;
  target.beaconDistance = copy.beaconDistance;
  target.started = copy.started;
  target.earned = copy.earned;
  target.revision = copy.revision;
  target.countdown = copy.countdown;
}
/** Move a late host snapshot forward to the guest's clock, or hard-reset a large gap. */
export function rebase(shown: PartyRun, incoming: PartyRun) {
  const skew = shown.world.time - incoming.world.time;
  const playing = shown.world.mode === "playing" && incoming.world.mode === "playing";
  if (!playing || Math.abs(skew) > catchupLimit) {
    adopt(shown, incoming);
    return clone(shown);
  }
  if (skew > 0) glide(incoming, skew);
  return incoming;
}
/** Keep simulating the guest view, then merge it toward the host. */
export function present(shown: PartyRun, authority: PartyRun, seconds: number) {
  if (shown.world.mode !== "playing" || authority.world.mode !== "playing") {
    adopt(shown, authority);
    return;
  }
  glide(shown, seconds);
  glide(authority, seconds);
  ease(shown, authority, seconds);
}
/** Serializable snapshot: all clients render the host's exact order and positions. */
export function encode(run: PartyRun) {
  const snapshot = {
    ...run,
    members: run.members.map((m) => ({
      ...m,
      state: {
        ...m.state,
        objects: [],
        projectiles: [],
        hostileProjectiles: [],
        traversals: [],
        events: [],
      },
    })),
  };
  return JSON.stringify(snapshot, (key, value) => {
    if (["hitTargets", "events"].includes(key)) return [];
    return typeof value === "bigint" ? value.toString() : value;
  });
}
export function decode(text: string): PartyRun {
  const run = JSON.parse(text) as PartyRun;
  run.world.score = BigInt(run.world.score);
  for (const m of run.members) m.state.score = BigInt(m.state.score);
  return run;
}
export function view(run: PartyRun, id: string): GameState {
  const local = run.members.find((m) => m.id === id)?.state;
  return local
    ? {
        ...run.world,
        powerups: local.powerups,
        activePowerup: local.activePowerup,
        grounding: local.grounding,
        player: local.player,
        health: local.health,
        hits: local.hits,
        dash: local.dash,
        cooldown: local.cooldown,
        attackCooldown: local.attackCooldown,
        attackTime: local.attackTime,
        loadout: local.loadout,
        stats: local.stats,
      }
    : run.world;
}
