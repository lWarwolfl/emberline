import type { PowerupId } from "./types";

// Shared 7x7 silhouettes: the map pickup and its HUD timer use the same icon.
const patterns: Record<PowerupId, readonly string[]> = {
  blast: ["0001000", "0101010", "0011100", "1111111", "0011100", "0101010", "0001000"],
  magnet: ["1100011", "1100011", "1100011", "1100011", "1100011", "0111110", "0011100"],
  overclock: ["0001100", "0011000", "0110000", "1111111", "0000110", "0001100", "0011000"],
  titan: ["0101010", "1111111", "1111111", "0111110", "0011100", "0011100", "0111110"],
  shield: ["0111110", "1111111", "1101011", "1101011", "0111110", "0011100", "0001000"],
  flight: ["0011100", "0111110", "1101011", "1101011", "0111110", "0101010", "1001001"],
};
function pixels(id: PowerupId) {
  return patterns[id].flatMap((row, y) =>
    [...row].flatMap((cell, x) => (cell === "1" ? [{ x, y }] : [])),
  );
}
function markup(id: PowerupId) {
  return `<svg viewBox="0 0 7 7" aria-hidden="true" shape-rendering="crispEdges">${pixels(id)
    .map(({ x, y }) => `<rect x="${x}" y="${y}" width="1" height="1" fill="currentColor"/>`)
    .join("")}</svg>`;
}
export = { pixels, markup };
