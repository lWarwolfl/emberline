import type Loadouts from "./loadout";
import type Upgrades from "./upgrades";
import type Content from "./content";
import type Saves from "./storage";
import type Economy from "./economy";

export type Seed = string | number;
export interface Rng {
  seed: number;
}
export type GearGroup = "character" | "cape" | "jetpack" | "weapon";
export type LoadoutGroup = GearGroup | "difficulty";
export type ShopTab = LoadoutGroup | "upgrades" | "settings";
export interface CustomRules {
  speed: number;
  growth: number;
  density: number;
  health: number;
}
export type Loadout = Record<LoadoutGroup, string> & { custom: CustomRules };
export type UpgradeId = "dash" | "jump" | "damage" | "triple";
export type UpgradeLevels = Record<UpgradeId, number>;
export type Rules = ReturnType<typeof Loadouts.rules>;
export type RunStats = ReturnType<typeof Upgrades.stats>;
export type SaveStore = ReturnType<typeof Saves.create>;
export type Shop = ReturnType<typeof Economy.create>;
export type Cape = (typeof Loadouts.capes)[number];
export type Jetpack = (typeof Loadouts.jetpacks)[number];
export type Biome = (typeof Content.biomes)[number];
export type Palette = Biome["palette"];
export interface Player {
  x: number;
  y: number;
  vy: number;
  jumps: number;
}
export interface WorldObject {
  kind: "hazard" | "enemy" | "ember";
  variant: string;
  x: number;
  y: number;
  w: number;
  h: number;
  dead?: boolean;
  passed?: boolean;
  hp?: number;
  lastDash?: number;
  lastPunch?: number;
  baseY?: number;
  amplitude?: number;
  frequency?: number;
  extraSpeed?: number;
  phase?: number;
  age?: number;
  shotCooldown?: number;
  charge?: number;
  aimX?: number;
  aimY?: number;
}
export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
  color: string;
  pierce?: number;
  hitTargets?: WorldObject[];
}
export interface HostileProjectile extends Projectile {
  previousX: number;
  previousY: number;
}
export interface Traversal {
  kind: "portal" | "pad";
  role?: "exit";
  x: number;
  y: number;
  w: number;
  h: number;
  age: number;
}
export interface TraversalEffect {
  kind: "portal" | "pad";
  life: number;
  duration: number;
  distance: number;
}
export interface GameEvent {
  type: string;
  x: number;
  y: number;
  points?: number;
  coins?: number;
  label?: string;
  playerId?: string;
}
export interface Encounter {
  pattern: string;
  coinPattern: string;
  variants: string[];
  gap: number;
  width: number;
}
export type Mode = "menu" | "playing" | "paused" | "dead";
export interface GameState {
  seed: Seed;
  loadout: Loadout;
  rules: Rules;
  stats: RunStats;
  dashId: number;
  health: number;
  mode: Mode;
  time: number;
  distance: number;
  score: bigint;
  scoreRemainder: number;
  sector: number;
  hits: number;
  embers: number;
  pickups: number;
  combo: number;
  cooldown: number;
  dash: number;
  invincible: number;
  attackCooldown: number;
  attackTime: number;
  attackId: number;
  projectiles: Projectile[];
  hostileProjectiles: HostileProjectile[];
  traversals: Traversal[];
  traversalEffect: TraversalEffect | null;
  next: number;
  rng: Rng;
  sceneryRng: Rng;
  paceRng: Rng;
  player: Player;
  objects: WorldObject[];
  events: GameEvent[];
  speed: number;
  runSpeed: number;
  targetSpeed: number;
  pace: string;
  nextPaceTime: number;
  paceBag: string[];
  biome: string;
  previousBiome: string;
  biomeBlend: number;
  biomeBag: string[];
  groupIndex: number;
  biomeIndex: number;
  bossActive: boolean;
  parallax: number;
  patternBag: string[];
  coinBag: string[];
  patternPool: string;
  lastVariant: Partial<Record<"obstacles" | "enemies", string>>;
  lastPattern: string | null;
  lastCoinPattern: string | null;
  lastEncounter: Encounter | null;
  encounterCount: number;
}
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}
export interface Popup {
  x: number;
  y: number;
  life: number;
  text: string;
  detail?: string;
  color: string;
}
export interface Feedback {
  shake: number;
  flash: number;
}
export interface Actions {
  start: () => void;
  setup: () => void;
  attack: () => void;
  pause: () => void;
  sound: () => void;
  fullscreen: () => void;
  jump: () => void;
  dash: () => void;
  pauseIfPlaying: () => void;
  enter: () => void;
  escape: () => void;
  effects: (enabled: boolean) => void;
  front: () => void;
}
