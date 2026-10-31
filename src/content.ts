// Add content here; simulation never needs to know a particular sprite's name.
const obstacles = [
  { id: "crate", w: 13, h: 14, unlock: 1, weight: 3 },
  { id: "spikes", w: 23, h: 11, unlock: 1, weight: 2 },
  { id: "barrier", w: 25, h: 18, unlock: 2, weight: 2 },
  { id: "stack", w: 15, h: 27, unlock: 2, weight: 2 },
  { id: "pipe", w: 22, h: 22, unlock: 3, weight: 2 },
  { id: "reactor", w: 19, h: 31, unlock: 4, weight: 1 },
];

// Enemy motion is predictable, with no projectiles or surprise lunges.
const enemies = [
  {
    id: "drone",
    w: 19,
    h: 12,
    altitude: 42,
    amplitude: 3,
    frequency: 2.5,
    extraSpeed: 0,
    unlock: 1,
    weight: 3,
  },
  {
    id: "crawler",
    w: 20,
    h: 12,
    altitude: 12,
    amplitude: 0,
    frequency: 0,
    extraSpeed: 12,
    unlock: 2,
    weight: 2,
  },
  {
    id: "jelly",
    w: 16,
    h: 18,
    altitude: 45,
    amplitude: 12,
    frequency: 2,
    extraSpeed: 0,
    unlock: 3,
    weight: 2,
  },
  {
    id: "bat",
    w: 22,
    h: 10,
    altitude: 61,
    amplitude: 8,
    frequency: 3.6,
    extraSpeed: 15,
    unlock: 4,
    weight: 2,
  },
];

const patterns = [
  { id: "hurdle", unlock: 1 },
  { id: "patrol", unlock: 1 },
  { id: "coin-break", unlock: 1 },
  { id: "steps", unlock: 2 },
  { id: "mixed", unlock: 3 },
  { id: "convoy", unlock: 4 },
];

const coinPatterns = ["ground", "arc", "staircase", "high", "wave", "split", "scatter"];
const paces = [
  { id: "cruise", name: "CRUISE", multiplier: 1 },
  { id: "surge", name: "SURGE", multiplier: 1.19 },
  { id: "recovery", name: "BREATHER", multiplier: 0.89 },
];

// Palettes have identical keys so the renderer can interpolate theme changes.
const biomes = [
  {
    id: "city",
    name: "THE OUTSKIRTS",
    architecture: "city",
    weather: "embers",
    palette: {
      sky: "#192b27",
      horizon: "#172823",
      far: "#243b31",
      mid: "#294437",
      near: "#31493a",
      detail: "#627354",
      light: "#c0a96e",
      ground: "#172820",
      rail: "#a2a074",
      floor: "#78805a",
    },
  },
  {
    id: "foundry",
    name: "COPPER FOUNDRY",
    architecture: "factory",
    weather: "ash",
    palette: {
      sky: "#302323",
      horizon: "#392b28",
      far: "#48302d",
      mid: "#593a2e",
      near: "#674737",
      detail: "#9c6244",
      light: "#ffb461",
      ground: "#302421",
      rail: "#d2a06c",
      floor: "#9b7551",
    },
  },
  {
    id: "forest",
    name: "OVERGROWN SIGNAL",
    architecture: "forest",
    weather: "fireflies",
    palette: {
      sky: "#122d2c",
      horizon: "#153c34",
      far: "#1c493c",
      mid: "#245b44",
      near: "#38684c",
      detail: "#749869",
      light: "#c6d688",
      ground: "#183b2b",
      rail: "#b7ba76",
      floor: "#668353",
    },
  },
  {
    id: "frost",
    name: "FROST RELAY",
    architecture: "mountains",
    weather: "snow",
    palette: {
      sky: "#1e2d3c",
      horizon: "#2b4050",
      far: "#354e60",
      mid: "#426177",
      near: "#537a8b",
      detail: "#8eabb2",
      light: "#d0e6d7",
      ground: "#253e4d",
      rail: "#d5e0cd",
      floor: "#94b8bc",
    },
  },
  {
    id: "dunes",
    name: "THE GLASS WASTES",
    architecture: "ruins",
    weather: "sand",
    palette: {
      sky: "#352d36",
      horizon: "#514037",
      far: "#63503f",
      mid: "#7a6048",
      near: "#8f7354",
      detail: "#b6976d",
      light: "#f4cf8a",
      ground: "#45362d",
      rail: "#edc48a",
      floor: "#b18b60",
    },
  },
];

export = { obstacles, enemies, patterns, coinPatterns, paces, biomes };
