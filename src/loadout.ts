import type { Loadout, LoadoutGroup } from "./types";

const characters = [
  {
    id: "fox",
    name: "Ember fox",
    description: "The original courier. Warm fur, pointed ears.",
    skin: "#e6b579",
    light: "#f1cd90",
    jacket: "#b5c49b",
    trim: "#dae0ad",
    boots: "#778c6b",
  },
  {
    id: "bot",
    name: "Relay bot",
    description: "Square steel helmet, antenna and a signal visor.",
    skin: "#8ab8b1",
    light: "#c4ddd0",
    jacket: "#d1a76b",
    trim: "#f0cd8e",
    boots: "#638f89",
  },
  {
    id: "hare",
    name: "Moon hare",
    description: "Long ears, silver fur and a blue flight suit.",
    skin: "#dad6c8",
    light: "#f2e9d1",
    jacket: "#8faec2",
    trim: "#c1d9df",
    boots: "#6d8caa",
  },
  {
    id: "ranger",
    name: "Dust ranger",
    description: "Sealed copper helmet and a desert-green suit.",
    skin: "#ba956e",
    light: "#e4c391",
    jacket: "#b6a27d",
    trim: "#e2cf9b",
    boots: "#7b856b",
  },
  {
    id: "lynx",
    name: "Copper lynx",
    description: "Tufted ears, dark cheek stripes and a copper coat.",
    skin: "#d7a06e",
    light: "#ffe0a1",
    jacket: "#627b76",
    trim: "#abd2bd",
    boots: "#415c58",
  },
  {
    id: "moth",
    name: "Lunar moth",
    description: "Feathery antennae and a luminous violet flight suit.",
    skin: "#d1c5ee",
    light: "#efe4ff",
    jacket: "#7b6aa3",
    trim: "#c8edcf",
    boots: "#51466f",
  },
  {
    id: "diver",
    name: "Deep relay diver",
    description: "A reinforced round helmet with an ocean-blue visor.",
    skin: "#729ca9",
    light: "#bce3e5",
    jacket: "#3f7080",
    trim: "#f5bf77",
    boots: "#365366",
  },
  {
    id: "specter",
    name: "Signal specter",
    description: "A pale hood and a bright signal mask from a lost relay.",
    skin: "#c5dbd1",
    light: "#e3f4de",
    jacket: "#4c6974",
    trim: "#8ae5dc",
    boots: "#314b58",
  },
];
const capes = [
  {
    id: "ember",
    name: "Ember pennant",
    description: "A broad cloth cape with a warm gold hem.",
    color: "#d97549",
    shade: "#96503c",
    trim: "#ffc47d",
    length: 24,
    width: 8,
  },
  {
    id: "signal",
    name: "Signal ribbons",
    description: "Two mint streamers that move independently.",
    color: "#9bcbb7",
    shade: "#547b6a",
    trim: "#d9ecc4",
    length: 29,
    width: 5,
  },
  {
    id: "storm",
    name: "Storm mantle",
    description: "A long, notched midnight cape with copper stitching.",
    color: "#7c93ae",
    shade: "#435c77",
    trim: "#d0b188",
    length: 33,
    width: 11,
  },
  {
    id: "none",
    name: "No cape",
    description: "Travel light. Keep the silhouette clean.",
    length: 0,
  },
  {
    id: "aurora",
    name: "Aurora swallowtail",
    description: "A forked mint cape with a pale woven edge.",
    color: "#8fc9b5",
    shade: "#456e62",
    trim: "#d9ecc4",
    length: 35,
    width: 12,
  },
  {
    id: "cinder",
    name: "Cinder scarf",
    description: "A narrow copper scarf with bright checker stitching.",
    color: "#ce805b",
    shade: "#7e4738",
    trim: "#ffe0a3",
    length: 38,
    width: 5,
  },
  {
    id: "relay",
    name: "Relay standard",
    description: "A square sage banner with twin signal bands.",
    color: "#9dad82",
    shade: "#54684e",
    trim: "#ece6d6",
    length: 28,
    width: 14,
  },
];
const jetpacks = [
  {
    id: "ember",
    name: "Ember thruster",
    description: "One compact fuel cell with a hot orange plume.",
    color: "#a9956d",
    flame: "#ffb66d",
    kind: "single",
  },
  {
    id: "twin",
    name: "Twin rockets",
    description: "Paired steel tanks with two blue exhaust trails.",
    color: "#a6c3c7",
    flame: "#99e2de",
    kind: "twin",
  },
  {
    id: "coil",
    name: "Arc coil",
    description: "A circular induction pack with a flickering mint core.",
    color: "#a7c69e",
    flame: "#cbf1a4",
    kind: "coil",
  },
  {
    id: "none",
    name: "No jetpack",
    description: "Boots, cloth and momentum. No engine attached.",
    kind: "none",
  },
  {
    id: "comet",
    name: "Comet drive",
    description: "A swept copper engine with a long gold exhaust.",
    color: "#c89566",
    flame: "#ffe0a3",
    kind: "comet",
  },
  {
    id: "halo",
    name: "Halo turbine",
    description: "An open ring turbine with four mint vanes.",
    color: "#9ac7b7",
    flame: "#d5ffe3",
    kind: "halo",
  },
  {
    id: "forge",
    name: "Forge array",
    description: "Three compact steel cells with ember jets.",
    color: "#819b92",
    flame: "#ffae62",
    kind: "forge",
  },
];
const weapons = [
  {
    id: "punch",
    name: "Impact glove",
    short: "PUNCH",
    description: "A basic close-range strike. 1 damage · 0.60s recharge.",
    damage: 1,
    cooldown: 0.6,
    range: 28,
    duration: 0.16,
    color: "#ffd096",
  },
  {
    id: "pulse",
    name: "Pulse blaster",
    short: "SHOOT",
    description: "A straight precision bolt. 1 base damage · 0.48s recharge.",
    damage: 1,
    cooldown: 0.48,
    speed: 300,
    life: 1.05,
    color: "#a6e4d1",
  },
  {
    id: "scatter",
    name: "Scatter gun",
    short: "SCATTER",
    description: "Three parallel bolts, 0.7 damage each · 0.85s recharge.",
    damage: 0.7,
    cooldown: 0.85,
    speed: 265,
    life: 0.95,
    color: "#ffbf7a",
  },
  {
    id: "repeater",
    name: "Needle repeater",
    short: "REPEAT",
    description: "Fast precision fire. 0.6 damage · 0.20s recharge.",
    damage: 0.6,
    cooldown: 0.2,
    speed: 370,
    life: 1,
    color: "#c3e87e",
  },
  {
    id: "rail",
    name: "Prism railgun",
    short: "RAIL",
    description: "Pierces up to three targets. 2 damage · 1.05s recharge.",
    damage: 2.4,
    cooldown: 1.05,
    speed: 650,
    life: 0.85,
    pierce: 2,
    color: "#c6b3ff",
  },
  {
    id: "nova",
    name: "Nova fan",
    short: "NOVA",
    description: "Five parallel lanes. 0.55 damage each · 1.10s recharge.",
    damage: 0.55,
    cooldown: 1.1,
    speed: 300,
    life: 0.9,
    color: "#ff95b0",
  },
  {
    id: "siegebreaker",
    name: "Siegebreaker cannon",
    short: "SIEGE",
    description: "Breaks armored obstacles. 5 damage · 1.40s recharge · pierces two targets.",
    damage: 5,
    cooldown: 1.4,
    speed: 450,
    life: 1.1,
    pierce: 1,
    armorPiercing: true,
    color: "#ffe0a3",
  },
];
const difficulties = [
  {
    id: "easy",
    name: "Night stroll",
    description: "Gentle start, wide gaps, five integrity. 1 coin per pickup.",
    speed: 0.85,
    growth: 0.8,
    density: 0.8,
    health: 5,
    coinReward: 1,
  },
  {
    id: "standard",
    name: "Courier",
    description: "The intended pace, three integrity. 2 coins per pickup.",
    speed: 1,
    growth: 1,
    density: 1,
    health: 3,
    coinReward: 2,
  },
  {
    id: "hard",
    name: "Overdrive",
    description: "Faster escalation, two integrity. 3 coins per pickup.",
    speed: 1.18,
    growth: 1.25,
    density: 1.2,
    health: 2,
    coinReward: 3,
  },
  {
    id: "custom",
    name: "Custom route",
    description: "Tune your own route. Practice only: pickups give score, no coins.",
  },
];
const defaults = {
  character: "fox",
  cape: "ember",
  jetpack: "ember",
  weapon: "punch",
  difficulty: "standard",
  custom: { speed: 1, growth: 1, density: 1, health: 3 },
};
function clamp(value: unknown, min: number, max: number, fallback: number) {
  return Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
}
function find<T extends { id: string }>(group: readonly T[], id: string): T {
  return group.find((item) => item.id === id) || group[0];
}
function sanitize(value: unknown = {}): Loadout {
  if (!value || typeof value !== "object") value = {};
  const source = value as Record<string, unknown>;
  const result = { ...defaults } as Loadout;
  for (const [key, group] of Object.entries({
    character: characters,
    cape: capes,
    jetpack: jetpacks,
    weapon: weapons,
    difficulty: difficulties,
  }) as [LoadoutGroup, { id: string }[]][]) {
    result[key] = group.some((item) => item.id === source[key])
      ? String(source[key])
      : defaults[key];
  }
  const custom = (source.custom || {}) as Record<string, unknown>;
  result.custom = {
    speed: clamp(custom.speed, 0.75, 1.4, 1),
    growth: clamp(custom.growth, 0.6, 1.8, 1),
    density: clamp(custom.density, 0.7, 1.4, 1),
    health: Math.round(clamp(custom.health, 2, 5, 3)),
  };
  return result;
}
function rules(loadout: unknown) {
  const selected = sanitize(loadout);
  const difficulty = find(difficulties, selected.difficulty);
  const numbers = selected.difficulty === "custom" ? selected.custom : difficulty;
  return {
    id: difficulty.id,
    name: difficulty.name,
    speed: numbers.speed!,
    growth: numbers.growth!,
    gap: 1 / numbers.density!,
    health: numbers.health!,
    coinReward: difficulty.coinReward || 0,
  };
}
export = { characters, capes, jetpacks, weapons, difficulties, defaults, find, sanitize, rules };
