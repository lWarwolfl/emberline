import type { Rng, Seed } from "./types";

function hash(value: unknown) {
  let result = 2166136261;
  for (const character of String(value)) {
    result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  }
  return result >>> 0 || 1;
}

function create(seed: Seed) {
  return { seed: hash(seed) };
}

function next(rng: Rng) {
  // xorshift32: a reproducible stream; visual randomness uses a different stream.
  let value = rng.seed;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  rng.seed = value >>> 0;
  return rng.seed / 4294967296;
}

function range(rng: Rng, min: number, max: number) {
  return min + next(rng) * (max - min);
}
function pick<T>(rng: Rng, items: readonly T[]) {
  return items[Math.floor(next(rng) * items.length)];
}

function shuffled<T>(rng: Rng, items: readonly T[]) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(next(rng) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// A refillable shuffle bag ensures every eligible item appears before repeats.
function drawBag<T>(rng: Rng, bag: T[], items: readonly T[], previous?: T | null) {
  if (!bag.length) {
    bag.push(...shuffled(rng, items));
    if (bag.length > 1 && bag[bag.length - 1] === previous) {
      [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
    }
  }
  return bag.pop()!;
}

function weighted<T extends { id: string; weight?: number }>(
  rng: Rng,
  items: readonly T[],
  previous?: string,
) {
  const pool = items.length > 1 ? items.filter((item) => item.id !== previous) : items;
  const total = pool.reduce((sum, item) => sum + (item.weight || 1), 0);
  let roll = next(rng) * total;
  for (const item of pool) {
    roll -= item.weight || 1;
    if (roll < 0) return item;
  }
  return pool[pool.length - 1];
}

export = { hash, create, next, range, pick, shuffled, drawBag, weighted };
