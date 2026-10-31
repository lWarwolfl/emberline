import type { Popup } from "./types";
import type { GameEvent } from "./types";

function create(reducedMotion = false) {
  let items: Popup[] = [];
  function add(event: GameEvent) {
    if (!event.points && !event.label) return;
    const neighbors = items.filter(
      (item) => Math.abs(item.x - event.x) < 18 && item.life > 0.55,
    ).length;
    items.push({
      x: event.x,
      y: event.y - 24 - neighbors * 10,
      life: 0.85,
      text: event.points ? "+" + event.points : event.label!,
      detail: event.coins
        ? `+${event.coins} ${event.coins === 1 ? "COIN" : "COINS"}`
        : event.points
          ? event.label
          : "",
      color: event.coins ? "#ffcf83" : "#c4eed6",
    });
    if (items.length > 32) items.shift();
  }
  function update(dt: number, speed: number) {
    for (const item of items) {
      item.life -= dt;
      if (!reducedMotion) {
        item.y -= 12 * dt;
        item.x -= speed * dt * 0.28;
      }
    }
    items = items.filter((item) => item.life > 0);
  }
  return {
    add,
    update,
    clear() {
      items = [];
    },
    get items() {
      return items;
    },
  };
}
export = { create };
