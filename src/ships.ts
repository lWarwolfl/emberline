import type { GameState, ShipId, ShipFlight, WorldObject } from "./types";
import Config from "./config";
import Random from "./random";
import Content from "./content";

const catalog = {
  sparrow: {
    name: "Sparrow",
    color: "#e9b783",
    speed: 120,
    cooldown: 0.24,
    damage: 5,
    angles: [0],
    pierce: 1,
  },
  lancer: {
    name: "Lancer",
    color: "#b5def9",
    speed: 98,
    cooldown: 0.48,
    damage: 9,
    angles: [0],
    pierce: 3,
  },
  mule: {
    name: "Mule",
    color: "#c8e6a1",
    speed: 88,
    cooldown: 0.42,
    damage: 5,
    angles: [-0.16, 0, 0.16],
    pierce: 0,
  },
} satisfies Record<
  ShipId,
  {
    name: string;
    color: string;
    speed: number;
    cooldown: number;
    damage: number;
    angles: number[];
    pierce: number;
  }
>;
const launchTime = 1.15;
const crashTime = 1.25;
const deck = Config.floor - Config.playerHeight;
const ids = Object.keys(catalog) as ShipId[];

function clearLane(state: GameState) {
  for (const object of state.objects) if (object.variant !== "boss") object.dead = true;
  state.objects = state.objects.filter((object) => !object.dead);
  state.projectiles = [];
  state.hostileProjectiles = [];
  state.traversals = [];
  state.traversalEffect = null;
}

function wave(state: GameState, flight: ShipFlight) {
  const layouts = [
    [61, 109, 144],
    [139, 93, 55],
    [76, 76, 136, 136],
    [126, 64, 126],
  ];
  const lanes = layouts[flight.wave % layouts.length];
  const spacing = Math.max(46, state.speed * 0.28);
  for (const [i, y] of lanes.entries()) {
    const variant = flight.wave % 3 === 1 && i === 0 ? "wasp" : i % 2 ? "bat" : "drone";
    const model = Content.enemies.find((enemy) => enemy.id === variant)!;
    state.objects.push({
      kind: "enemy",
      variant,
      x: Config.width + 14 + i * spacing,
      y,
      baseY: y,
      w: model.w,
      h: model.h,
      amplitude: model.amplitude,
      frequency: model.frequency,
      hp: 4 + Math.min(4, state.groupIndex),
      age: 0,
      phase: i,
    });
  }
  flight.wave++;
  flight.nextWave += 3.2;
}

function opportunity(seed: GameState["seed"], sector: number) {
  const rng = Random.create(`${seed}:ship:${sector}`);
  return {
    available: Random.next(rng) < 0.75,
    delay: Random.range(rng, 2, 6),
    id: Random.pick(rng, ids),
    height: Random.pick(rng, [0, 32, 52]),
  };
}

function collect(state: GameState, object: WorldObject) {
  if (
    object.kind !== "ship" ||
    object.dead ||
    state.ship ||
    state.bossActive ||
    state.mode !== "playing" ||
    state.hits >= state.health
  )
    return false;
  const id = object.variant as ShipId;
  if (!catalog[id]) return false;
  state.ship = { id, phase: "launch", age: 0, nextWave: 1.45, wave: 0 };
  clearLane(state);
  state.events.push({
    type: "ship-launch",
    x: object.x,
    y: object.y,
    label: catalog[id].name.toUpperCase() + " / TAKEOFF",
  });
  return true;
}

function update(state: GameState, previousSector: number, dt: number) {
  const flight = state.ship;
  const changed = previousSector !== state.sector;
  if (!flight) {
    // A separate hashed stream keeps encounter and pace randomness unchanged.
    const offer = opportunity(state.seed, state.sector);
    if (state.bossActive || state.sector < 2 || !offer.available) return;
    const due = (state.sector - 1) * Config.sectorSeconds + offer.delay;
    if (state.time - dt >= due || state.time < due) return;
    const x = Config.width + 36;
    // Leave a readable approach around the boarding point.
    state.objects = state.objects.filter(
      (o) =>
        (o.kind !== "hazard" && o.kind !== "enemy" && o.kind !== "platform") ||
        o.x + o.w < x - 90 ||
        o.x > x + 90,
    );
    state.objects.push({
      kind: "ship",
      variant: offer.id,
      x,
      y: deck - offer.height,
      w: 36,
      h: 18,
    });
    return;
  }
  if (changed && flight.phase !== "crash") {
    clearLane(state);
    for (const object of state.objects) object.x = Config.width + 75;
    flight.phase = "crash";
    flight.age = 0;
    return;
  }
  flight.age += dt;
  if (flight.phase === "launch" && flight.age >= launchTime) {
    flight.phase = "flight";
    flight.age = 0;
  } else if (flight.phase === "flight" && flight.age >= flight.nextWave) {
    wave(state, flight);
  } else if (flight.phase === "crash" && flight.age >= crashTime) {
    state.ship = null;
    state.next = Math.max(state.next, state.distance + 65);
    state.events.push({
      type: "ship-crash",
      x: state.player.x + 9,
      y: Config.floor - 5,
      label: "HULL LOST / ON FOOT",
    });
  }
}

function steer(state: GameState, dt: number) {
  const flight = state.ship;
  if (!flight) return false;
  const player = state.player;
  const approach = (target: number, speed: number) =>
    player.y + Math.sign(target - player.y) * Math.min(Math.abs(target - player.y), speed * dt);
  state.grounding = false;
  state.dash = 0;
  player.vy = 0;
  player.jumps = 0;
  if (flight.phase === "launch") {
    player.y = approach(98, 100);
  } else if (flight.phase === "crash") {
    player.y = approach(deck, 178);
    state.invincible = Math.max(state.invincible, 0.9);
  } else {
    const direction = Number(state.crouching) - Number(state.climb);
    player.y = Math.max(29, Math.min(156, player.y + direction * catalog[flight.id].speed * dt));
  }
  return true;
}

function skyAmount(flight: ShipFlight) {
  if (flight.phase === "launch") return Math.min(1, flight.age / launchTime);
  if (flight.phase === "crash") return Math.max(0, 1 - flight.age / (crashTime * 0.8));
  return 1;
}
export = { catalog, opportunity, collect, update, steer, skyAmount };
