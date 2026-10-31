import type { Cape, Jetpack } from "./types";
import type { GameState, WorldObject } from "./types";
import Config from "./config";
import Pixel from "./pixel";
import Loadout from "./loadout";
import Cloth from "./cloth";
import Combat from "./combat";

function create(ctx: CanvasRenderingContext2D, reducedMotion = false) {
  const { rect, line, triangle } = Pixel.create(ctx);
  function cape(x: number, y: number, time: number, definition: Cape, state: GameState) {
    const columns = Cloth.sample(definition, time, {
      speed: state.runSpeed || state.speed,
      vy: state.player.vy,
      dashing: state.dash > 0,
      reduced: reducedMotion,
    });
    for (let i = columns.length - 1; i >= 0; i--) {
      const point = columns[i];
      if (definition.id === "signal") {
        rect(x + point.x, y + point.y, 1, 3, definition.color!);
        rect(
          x + point.x,
          y + point.y + 6 + Math.round(Math.sin(time * 8 - i * 0.4)),
          1,
          2,
          definition.trim!,
        );
      } else {
        const notch = definition.id === "storm" && i > columns.length - 7 ? (i % 4 < 2 ? 3 : 0) : 0;
        rect(x + point.x, y + point.y, 1, point.width - notch, definition.color!);
        rect(x + point.x, y + point.y + point.width - 2 - notch, 1, 2, definition.shade!);
        if (definition.id === "storm" ? i % 5 < 2 : i > columns.length - 4)
          rect(
            x + point.x,
            y + point.y + 1,
            1,
            Math.max(1, point.width - 3 - notch),
            definition.trim!,
          );
      }
    }
  }

  function jetpack(x: number, y: number, time: number, definition: Jetpack, active: boolean) {
    if (definition.kind === "none") return;
    const flame = active ? 7 + Math.round(Math.sin(time * 45) * 3) : 0;
    if (definition.kind === "twin") {
      for (const shift of [0, 6]) {
        rect(x - 5, y + shift, 5, 5, definition.color!);
        rect(x - 6, y + shift + 1, 2, 3, "#5c7d7c");
        if (active) {
          rect(x - 6 - flame, y + shift + 2, flame, 2, definition.flame!);
          rect(x - 8, y + shift + 2, 3, 1, "#ecf6ce");
        }
      }
    } else if (definition.kind === "coil") {
      rect(x - 7, y + 1, 7, 9, "#4c745e");
      rect(x - 8, y + 3, 9, 5, definition.color!);
      rect(x - 5, y + 4, 3, 3, definition.flame!);
      if (active) {
        line(x - 12 - flame, y + 2, flame, definition.flame!);
        line(x - 10 - flame, y + 8, flame, definition.flame!);
      }
    } else {
      rect(x - 5, y, 5, 10, definition.color!);
      rect(x - 6, y + 2, 2, 6, "#6e7358");
      rect(x - 5, y + 2, 2, 3, "#ffe3a1");
      if (active) {
        rect(x - 7 - flame, y + 6, flame + 2, 3, definition.flame!);
        rect(x - 8, y + 6, 4, 2, "#fff0bd");
      }
    }
  }

  function courier(x: number, y: number, time: number, dashing: boolean, state: GameState) {
    const equipment = state.loadout || Loadout.defaults;
    const person = Loadout.find(Loadout.characters, equipment.character);
    const capeType = Loadout.find(Loadout.capes, equipment.cape);
    const pack = Loadout.find(Loadout.jetpacks, equipment.jetpack);
    const weapon = Loadout.find(Loadout.weapons, equipment.weapon);
    const step = state.player.jumps ? 0 : Math.floor(time * 13) % 4;
    const leg = [0, 3, 0, -3][step];
    cape(x + 1, y + 6, time, capeType, state);
    jetpack(x, y + 7, time, pack, dashing || state.player.jumps > 0);
    if (dashing) {
      line(x - 34, y + 2, 18, "#b9e4d0");
      line(x - 43, y + 15, 24, "#779e90");
    }
    // All character shapes share the same small, fair collision body.
    if (person.id === "fox") {
      rect(x + 3, y - 3, 3, 5, person.skin);
      rect(x + 10, y - 2, 3, 4, person.skin);
      rect(x + 2, y + 1, 12, 7, person.skin);
      rect(x + 5, y, 8, 2, person.light);
      rect(x + 12, y + 4, 4, 3, person.light);
      rect(x + 11, y + 3, 2, 2, "#16332a");
    } else if (person.id === "hare") {
      rect(x + 3, y - 9, 3, 11, person.skin);
      rect(x + 9, y - 7, 3, 9, person.skin);
      rect(x + 4, y - 7, 1, 7, "#b79599");
      rect(x + 10, y - 5, 1, 5, "#b79599");
      rect(x + 2, y + 1, 12, 7, person.skin);
      rect(x + 11, y + 3, 2, 2, "#273e43");
      rect(x + 12, y + 5, 3, 2, person.light);
    } else if (person.id === "bot") {
      rect(x + 2, y - 1, 13, 10, person.skin);
      rect(x + 4, y + 2, 12, 4, "#314e4b");
      rect(x + 8, y + 3, 6, 2, "#f4d18c");
      rect(x + 6, y - 5, 1, 5, person.light);
      rect(x + 5, y - 6, 3, 2, "#ffae62");
    } else {
      rect(x + 2, y - 1, 12, 10, person.skin);
      rect(x + 1, y + 1, 14, 3, person.light);
      rect(x + 7, y + 3, 9, 4, "#4b7770");
      line(x + 8, y + 3, 6, "#bbded1");
    }
    rect(x, y + 8, 11, 7, person.jacket);
    rect(x + 2, y + 8, 8, 3, person.trim);
    rect(x + 1, y + 14, 4, 4 + Math.max(0, leg), person.boots);
    rect(x + 7, y + 14, 4, 4 + Math.max(0, -leg), person.boots);
    rect(x + 1 + leg, y + 17, 5, 2, person.light);
    rect(x + 7 - leg, y + 17, 5, 2, person.light);
    const striking = state.attackTime > 0;
    rect(x + 10, y + 10, striking ? 10 : 5, 3, person.light);
    if (weapon.id === "punch") {
      rect(x + (striking ? 19 : 13), y + 8, striking ? 7 : 4, 6, weapon.color);
      if (striking) {
        line(x + 27, y + 5, 8, "#ffe3ab");
        line(x + 29, y + 15, 6, "#ffe3ab");
      }
    } else {
      rect(x + 13, y + 8, weapon.id === "scatter" ? 12 : 9, 4, "#9da995");
      rect(x + 16, y + 9, 6, 2, weapon.color);
      if (striking) {
        rect(x + 24, y + 7, 5, 6, weapon.color);
        rect(x + 26, y + 9, 5, 2, "#fff2c9");
      }
    }
  }
  const hazards: Record<string, (o: WorldObject, t: number) => void> = {
    crate(o: WorldObject) {
      rect(o.x, o.y, o.w, o.h, "#a16f48");
      rect(o.x + 2, o.y + 2, o.w - 4, o.h - 4, "#594d36");
      line(o.x, o.y, o.w, "#e5ac66");
      for (let k = 2; k < o.h - 3; k += 6) rect(o.x + 2, o.y + k, 4, 3, "#dc9957");
    },
    stack(o: WorldObject) {
      hazards.crate(o, 0);
      rect(o.x, o.y + 12, o.w, 2, "#e5ac66");
      rect(o.x + 8, o.y + 3, 4, 6, "#b18b57");
    },
    spikes(o: WorldObject) {
      rect(o.x, o.y + o.h - 3, o.w, 3, "#8b7357");
      for (let i = 0; i < 3; i++) {
        triangle(o.x + i * 8, o.y + o.h - 2, 7, o.h - 2, "#c8c49a");
        rect(o.x + i * 8 + 3, o.y, 1, 3, "#ffe0a3");
      }
    },
    barrier(o: WorldObject) {
      rect(o.x + 1, o.y + 2, o.w - 2, 10, "#d49b53");
      for (let i = 0; i < o.w - 3; i += 7) rect(o.x + 2 + i, o.y + 3, 4, 8, "#4c4b37");
      rect(o.x + 3, o.y + 12, 3, 6, "#c4b58c");
      rect(o.x + o.w - 6, o.y + 12, 3, 6, "#c4b58c");
    },
    pipe(o: WorldObject) {
      rect(o.x + 3, o.y, o.w - 6, o.h, "#739486");
      rect(o.x, o.y + 2, o.w, 5, "#b4c2a2");
      rect(o.x + 6, o.y + 8, 3, o.h - 8, "#a9b69a");
      rect(o.x + o.w - 7, o.y + 8, 3, o.h - 8, "#3d6355");
    },
    reactor(o: WorldObject, t: number) {
      rect(o.x, o.y + 3, o.w, o.h - 3, "#687d70");
      rect(o.x + 2, o.y, o.w - 4, 4, "#d4bc86");
      rect(o.x + 4, o.y + 7, o.w - 8, o.h - 11, "#3f554a");
      rect(o.x + 7, o.y + 10, 5, 10, Math.sin(t * 7) > 0 ? "#ffb461" : "#b7734b");
      line(o.x + 2, o.y + o.h - 3, o.w - 4, "#dfb477");
    },
  };

  const enemies: Record<string, (o: WorldObject, t: number) => void> = {
    drone(o: WorldObject, t: number) {
      rect(o.x, o.y + 3, o.w, 7, "#b7b995");
      rect(o.x + 3, o.y, 13, 12, "#637c68");
      rect(o.x + 7, o.y + 4, 7, 3, "#ff8f61");
      rect(o.x - 3, o.y + 2, 5, 2, "#d0c79b");
      rect(o.x + 17, o.y + 2, 5, 2, "#d0c79b");
      if (Math.sin(t * 30) > 0) {
        line(o.x - 4, o.y, 7, "#86977c");
        line(o.x + 16, o.y, 7, "#86977c");
      }
    },
    crawler(o: WorldObject, t: number) {
      rect(o.x + 1, o.y + 3, o.w - 2, 7, "#b59064");
      rect(o.x + 3, o.y, o.w - 8, 5, "#d6bb84");
      rect(o.x + 2, o.y + 4, 5, 2, "#ff8f61");
      rect(o.x + 1, o.y + 9, o.w - 2, 3, "#3b4f44");
      for (let i = 0; i < 3; i++)
        rect(o.x + 2 + i * 6, o.y + 9, 3, 3, Math.floor(t * 15 + i) % 2 ? "#a9b69a" : "#657966");
    },
    jelly(o: WorldObject, t: number) {
      rect(o.x + 2, o.y, o.w - 4, 3, "#a9d5c5");
      rect(o.x, o.y + 3, o.w, 7, "#7cae9e");
      rect(o.x + 2, o.y + 5, o.w - 4, 4, "#d4e0b2");
      rect(o.x + 3, o.y + 6, 3, 2, "#ef9f73");
      for (let i = 0; i < 3; i++)
        rect(o.x + 2 + i * 5, o.y + 10, 2, 6 + Math.round(Math.sin(t * 9 + i) * 2), "#91b9a4");
    },
    bat(o: WorldObject, t: number) {
      const lift = Math.round(Math.sin(t * 16) * 3);
      rect(o.x + 7, o.y + 2, 8, 8, "#bf8f75");
      rect(o.x + 2, o.y + lift + 2, 6, 4, "#b2baa0");
      rect(o.x + 15, o.y + lift + 2, 6, 4, "#b2baa0");
      rect(o.x, o.y + lift, 3, 5, "#7f9b8c");
      rect(o.x + 19, o.y + lift, 3, 5, "#7f9b8c");
      rect(o.x + 8, o.y + 4, 2, 2, "#ffae62");
    },
  };

  function object(o: WorldObject, time: number) {
    if (o.x > Config.width + 35 || o.x + o.w < -10) return;
    if (o.kind === "ember") {
      const thin = Math.sin(time * 5 + o.x * 0.025) > 0.7;
      rect(o.x - 2, o.y - 2, 9, 10, "#594e2e");
      rect(o.x + (thin ? 2 : 0), o.y, thin ? 2 : 5, 6, "#ffae62");
      rect(o.x + 2, o.y + 1, 1, 3, "#ffe0a3");
    } else if (o.kind === "enemy") (enemies[o.variant] || enemies.drone)(o, time);
    else {
      (hazards[o.variant] || hazards.crate)(o, time);
      // Breakable seams glow warm; armored hazards carry a pale steel marker.
      line(o.x + 2, o.y + 2, Math.max(3, o.w - 4), Combat.breakable(o) ? "#ffce83" : "#c0d2c4");
    }
  }
  return { courier, object, hazards, enemies, cape, jetpack };
}
export = { create };
