import type { GameState, Loadout, Seed, UpgradeLevels } from "./types";
import Engine from "./engine";
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
  frontCooldown: number;
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
  started: boolean;
  earned: number;
  revision: number;
}
export type Action = "jump" | "dash" | "attack" | "front";
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
    started: false,
    earned: 0,
    revision: 0,
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
  run.members.push({ id, name: p.name, state, connected: true, frontCooldown: 0 });
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
function formation(run: PartyRun, instant = false, dt = 0) {
  const members = sorted(run).filter(alive);
  for (const [i, m] of members.entries()) {
    const target = Config.playerX + (run.members.filter((m) => m.connected).length - i - 1) * 32;
    const delta = target - m.state.player.x;
    m.state.player.x += instant ? delta : Math.sign(delta) * Math.min(Math.abs(delta), dt * 220);
  }
}
export function start(run: PartyRun) {
  const base = Loadouts.rules(run.world.loadout);
  run.world = Engine.create(run.world.seed, run.world.loadout);
  const scale = scaling(run.members.filter((m) => m.connected).length);
  run.world.rules = {
    ...base,
    speed: base.speed * scale.speed,
    growth: base.growth * scale.growth,
    gap: base.gap / scale.density,
  };
  run.world.mode = "playing";
  for (const [i, m] of run.members.entries()) {
    const previous = m.state;
    m.state = Engine.create(run.world.seed, previous.loadout, previous.stats.levels);
    m.state.rules = { ...run.world.rules };
    m.state.health = base.health;
    m.state.attackId = m.state.dashId = i * 1000000;
    m.state.mode = "playing";
    m.frontCooldown = 0;
  }
  run.started = true;
  run.revision++;
  run.checkpoint = { x: 355, age: 0, used: false, flash: 0 };
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
  if (action === "front") {
    if (sorted(run).find(alive)?.id === id || m.frontCooldown > 0) return false;
    run.order = [id, ...run.order.filter((p) => p !== id)];
    m.frontCooldown = 3;
    // The move itself hops, so a protector can intercept while the line reforms.
    if (!Engine.jump(s)) s.player.vy = Math.min(s.player.vy, -100);
    formation(run, true);
    s.events.push({ type: "front", x: s.player.x, y: s.player.y, label: `${m.name} TAKES POINT` });
    run.revision++;
    return true;
  }
  return Engine[action](s);
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
    Object.assign(m.state, { hits: 0, invincible: 2, mode: "playing", dash: 0 });
    Object.assign(m.state.player, { y: Config.floor - Config.playerHeight, vy: 0, jumps: 0 });
  }
  formation(run, true);
}
function step(run: PartyRun, dt: number) {
  const w = run.world;
  const previousSector = w.sector;
  w.time += dt;
  Difficulty.update(w, dt);
  if (previousSector !== w.sector) {
    run.checkpoint = { x: Config.width + 36, age: 0, used: false, flash: 0 };
    // A clear biome entrance gives survivors a fair opportunity to reach the beacon.
    w.objects = [];
    w.hostileProjectiles = [];
    w.traversals = [];
    w.next = w.distance + Math.max(260, w.speed * 3);
  }
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
    m.frontCooldown = Math.max(0, m.frontCooldown - dt);
    s.player.vy += Config.gravity * dt;
    s.player.y += s.player.vy * dt;
    if (s.player.y >= Config.floor - Config.playerHeight)
      Object.assign(s.player, { y: Config.floor - Config.playerHeight, vy: 0, jumps: 0 });
  }
  if (w.distance >= w.next) {
    const before = w.objects.length;
    Generator.spawn(w);
    const scale = scaling(run.members.filter((m) => m.connected).length);
    // Scaling applies once, only to newly spawned enemies.
    for (const object of w.objects.slice(before))
      if (object.kind === "enemy") object.hp = Combat.durability(object) * scale.armor;
  }
  const previous = new Map(w.objects.map((o) => [o, o.x]));
  for (const object of w.objects) Generator.move(object, w.runSpeed, dt);
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
    if (run.checkpoint && !run.checkpoint.used) run.checkpoint.x = 355;
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
    const target = live.find((m) => alive(m) && EnemyFire.hitsPlayer(bolt, m.state.player));
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
    if (object.dead) continue;
    const target = live.find(
      (m) => alive(m) && Engine.collides(m.state.player, object, previous.get(object) ?? object.x),
    );
    if (target) {
      const s = target.state,
        score = s.score;
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
      object.kind !== "ember" &&
      object.x + object.w < Math.min(...live.filter(alive).map((m) => m.state.player.x))
    ) {
      object.passed = true;
      w.score += 25n;
    }
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
    if (beacon.x < -80) run.checkpoint = null;
  }
  for (const m of live) {
    m.state.dash = Math.max(0, m.state.dash - dt);
    m.state.attackTime = Math.max(0, m.state.attackTime - dt);
    drain(run, m);
  }
  w.objects = w.objects.filter((o) => !o.dead && o.x > -40);
  if (!run.members.some(alive)) {
    w.mode = "dead";
    w.events.push({ type: "death", x: w.player.x, y: w.player.y });
  }
}
export function update(run: PartyRun, seconds: number) {
  if (run.world.mode !== "playing" || !Number.isFinite(seconds)) return;
  let remaining = Math.min(Config.maxFrameSeconds, Math.max(0, seconds));
  while (remaining > 1e-9 && run.world.mode === "playing") {
    const dt = Math.min(Config.simulationStep, remaining);
    step(run, dt);
    remaining -= dt;
  }
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
