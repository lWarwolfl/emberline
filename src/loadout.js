/** Loadout: editable module; no build step required. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else {
    root.Emberline = root.Emberline || {};
    root.Emberline.Loadout = factory();
  }
})(globalThis, function () {
  "use strict";
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
      description: "A precise aimed bolt. 1 base damage · 0.48s recharge.",
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
      description: "Three spreading bolts, 0.55 damage each · 0.90s recharge.",
      damage: 0.55,
      cooldown: 0.9,
      speed: 265,
      life: 0.95,
      color: "#ffbf7a",
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
  function clamp(value, min, max, fallback) {
    return Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
  }
  function find(group, id) {
    return group.find((item) => item.id === id) || group[0];
  }
  function sanitize(value = {}) {
    if (!value || typeof value !== "object") value = {};
    const result = {};
    for (const [key, group] of Object.entries({
      character: characters,
      cape: capes,
      jetpack: jetpacks,
      weapon: weapons,
      difficulty: difficulties,
    })) {
      result[key] = group.some((item) => item.id === value[key]) ? value[key] : defaults[key];
    }
    const custom = value.custom || {};
    result.custom = {
      speed: clamp(custom.speed, 0.75, 1.4, 1),
      growth: clamp(custom.growth, 0.6, 1.8, 1),
      density: clamp(custom.density, 0.7, 1.4, 1),
      health: Math.round(clamp(custom.health, 2, 5, 3)),
    };
    return result;
  }
  function rules(loadout) {
    const selected = sanitize(loadout);
    const difficulty = find(difficulties, selected.difficulty);
    const numbers = selected.difficulty === "custom" ? selected.custom : difficulty;
    return {
      id: difficulty.id,
      name: difficulty.name,
      speed: numbers.speed,
      growth: numbers.growth,
      gap: 1 / numbers.density,
      health: numbers.health,
      coinReward: difficulty.coinReward || 0,
    };
  }
  return { characters, capes, jetpacks, weapons, difficulties, defaults, find, sanitize, rules };
});
