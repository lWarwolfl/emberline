import type { Cape, Jetpack, Traversal } from "./types";
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
        const notch =
          (definition.id === "storm" || definition.id === "aurora") && i > columns.length - 7
            ? i % 4 < 2
              ? 3
              : 0
            : 0;
        rect(x + point.x, y + point.y, 1, point.width - notch, definition.color!);
        rect(x + point.x, y + point.y + point.width - 2 - notch, 1, 2, definition.shade!);
        if (
          definition.id === "relay"
            ? i % 10 < 3
            : definition.id === "cinder"
              ? i % 4 < 2
              : definition.id === "storm"
                ? i % 5 < 2
                : i > columns.length - 4
        )
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
    if (definition.kind === "halo") {
      rect(x - 10, y, 8, 2, definition.color!);
      rect(x - 12, y + 2, 2, 7, definition.color!);
      rect(x - 2, y + 2, 2, 7, definition.color!);
      rect(x - 10, y + 9, 8, 2, definition.color!);
      rect(x - 8, y + 4, 4, 3, definition.flame!);
      if (active) line(x - 14 - flame, y + 5, flame + 4, definition.flame!);
    } else if (definition.kind === "forge") {
      for (let i = 0; i < 3; i++) {
        rect(x - 8, y + i * 4, 8, 3, definition.color!);
        rect(x - 9, y + i * 4, 2, 3, "#435c55");
        if (active) line(x - 10 - flame, y + i * 4 + 1, flame + 2, definition.flame!);
      }
    } else if (definition.kind === "comet") {
      rect(x - 8, y + 2, 7, 7, definition.color!);
      rect(x - 5, y, 4, 12, definition.color!);
      line(x - 9, y + 3, 8, "#ffe0a3");
      if (active) {
        rect(x - 11 - flame, y + 5, flame + 4, 3, definition.flame!);
        line(x - 16 - flame, y + 6, flame + 3, "#ce805b");
      }
    } else if (definition.kind === "twin") {
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
    ctx.save();
    if (state.activePowerup?.id === "titan") {
      ctx.translate(x, y + Config.playerHeight);
      ctx.scale(1.6, 1.6);
      x = 0;
      y = -Config.playerHeight;
    }
    const equipment = state.loadout || Loadout.defaults;
    const person = Loadout.find(Loadout.characters, equipment.character);
    const capeType = Loadout.find(Loadout.capes, equipment.cape);
    const pack = Loadout.find(
      Loadout.jetpacks,
      state.activePowerup?.id === "flight" && equipment.jetpack === "none"
        ? "ember"
        : equipment.jetpack,
    );
    const weapon = Loadout.find(Loadout.weapons, equipment.weapon);
    const step = state.player.jumps ? 0 : Math.floor(time * 13) % 4;
    const leg = [0, 3, 0, -3][step];
    cape(x + 1, y + 6, time, capeType, state);
    jetpack(
      x,
      y + 7,
      time,
      pack,
      dashing || state.player.jumps > 0 || state.activePowerup?.id === "flight",
    );
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
    } else if (person.id === "lynx") {
      rect(x + 1, y - 5, 4, 8, person.skin);
      rect(x + 11, y - 5, 4, 8, person.skin);
      rect(x + 1, y - 7, 2, 3, person.boots);
      rect(x + 13, y - 7, 2, 3, person.boots);
      rect(x + 1, y + 1, 14, 7, person.skin);
      rect(x + 10, y + 3, 2, 2, "#203d34");
      line(x + 1, y + 5, 5, person.boots);
      line(x + 2, y + 7, 5, person.boots);
      rect(x + 12, y + 6, 4, 2, person.light);
    } else if (person.id === "moth") {
      rect(x + 2, y, 13, 9, person.skin);
      rect(x + 4, y + 2, 4, 4, person.boots);
      rect(x + 10, y + 2, 4, 4, person.boots);
      rect(x + 11, y + 3, 2, 2, person.trim);
      rect(x + 3, y - 6, 2, 6, person.light);
      rect(x + 11, y - 6, 2, 6, person.light);
      line(x, y - 5, 5, person.trim);
      line(x + 11, y - 5, 5, person.trim);
    } else if (person.id === "diver") {
      rect(x + 3, y - 3, 10, 2, person.light);
      rect(x, y - 1, 16, 10, person.skin);
      rect(x + 3, y + 9, 10, 2, person.light);
      rect(x + 4, y + 1, 10, 6, "#183f58");
      line(x + 5, y + 2, 7, "#9ae1ec");
      rect(x - 2, y + 2, 3, 5, person.trim);
    } else if (person.id === "specter") {
      rect(x + 3, y - 4, 10, 3, person.light);
      rect(x, y - 1, 16, 11, person.skin);
      rect(x + 4, y + 1, 10, 7, "#172e37");
      rect(x + 6, y + 3, 2, 2, person.trim);
      rect(x + 11, y + 3, 2, 2, person.trim);
      rect(x - 2, y + 6, 4, 6, person.skin);
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
      rect(
        x + 13,
        y + 8,
        weapon.id === "siegebreaker"
          ? 21
          : weapon.id === "rail"
            ? 18
            : weapon.id === "scatter" || weapon.id === "nova"
              ? 12
              : 9,
        4,
        "#9da995",
      );
      if (weapon.id === "siegebreaker") {
        rect(x + 15, y + 6, 9, 8, "#65776c");
        rect(x + 29, y + 7, 5, 6, weapon.color);
      }
      if (weapon.id === "rail") {
        line(x + 16, y + 7, 15, weapon.color);
        rect(x + 19, y + 11, 6, 3, "#685784");
      }
      if (weapon.id === "repeater") {
        rect(x + 15, y + 11, 4, 5, "#5b7752");
        rect(x + 20, y + 6, 3, 2, weapon.color);
      }
      if (weapon.id === "nova") {
        rect(x + 23, y + 6, 4, 2, weapon.color);
        rect(x + 23, y + 13, 4, 2, weapon.color);
      }
      rect(x + 16, y + 9, 6, 2, weapon.color);
      if (striking) {
        rect(x + 24, y + 7, 5, 6, weapon.color);
        rect(x + 26, y + 9, 5, 2, "#fff2c9");
      }
    }
    ctx.restore();
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
    sentry(o: WorldObject, t: number) {
      rect(o.x + 2, o.y + 13, 18, 6, "#5b665b");
      rect(o.x + 5, o.y + 3, 14, 11, "#a59077");
      rect(o.x, o.y + 6, 10, 5, "#dca36b");
      rect(o.x + 8, o.y, 8, 3, "#c8c6aa");
      rect(o.x + 1, o.y + 7, 3, 3, (o.charge ?? 0) > 0 ? "#fff0ba" : "#ff7b73");
      line(o.x + 5, o.y + 14, 12, Math.sin(t * 10) > 0 ? "#a4b79d" : "#61765d");
    },
    beetle(o: WorldObject, t: number) {
      rect(o.x + 3, o.y, 18, 4, "#b79879");
      rect(o.x, o.y + 4, 24, 8, "#7f7561");
      rect(o.x + 6, o.y + 2, 4, 9, "#d6c9a4");
      rect(o.x + 14, o.y + 2, 4, 9, "#d6c9a4");
      rect(o.x + 1, o.y + 6, 3, 2, "#f39678");
      for (let i = 0; i < 4; i++)
        rect(o.x + i * 6, o.y + 12, 3, Math.floor(t * 14 + i) % 2 ? 3 : 1, "#536f67");
    },
    wasp(o: WorldObject, t: number) {
      const wing = reducedMotion ? 0 : Math.round(Math.sin(t * 28) * 3);
      rect(o.x + 5, o.y + 3, 14, 8, "#a18ba6");
      rect(o.x + 10, o.y + 4, 3, 6, "#e4b4bf");
      rect(o.x, o.y + 6, 8, 4, "#f0be94");
      rect(o.x + 8, o.y - 2 + wing, 12, 3, "#a5d5cf");
      rect(o.x + 7, o.y + 11 - wing, 13, 3, "#6eaaa6");
      rect(o.x + 1, o.y + 6, 2, 3, "#ff98ca");
    },
    wisp(o: WorldObject, t: number) {
      const sway = reducedMotion ? 0 : Math.sin(t * 8) * 2;
      rect(o.x + 4, o.y, 8, 3, "#ded1ef");
      rect(o.x + 1, o.y + 3, 14, 8, "#9b99cc");
      rect(o.x + 3, o.y + 5, 4, 3, "#f5c1d7");
      rect(o.x + 10, o.y + 5, 3, 3, "#f5c1d7");
      for (let i = 0; i < 3; i++)
        rect(o.x + 2 + i * 5, o.y + 11 + (i % 2 ? sway : -sway), 3, 5, "#717ead");
    },
    boss(o: WorldObject, t: number) {
      const pulse = reducedMotion ? 0 : Math.round(Math.sin(t * 6) * 2);
      rect(o.x + 10, o.y + 18, 26, 34, "#241c22");
      rect(o.x + 14, o.y + 8, 18, 16, "#c24b38");
      rect(o.x + pulse, o.y + 24, 12, 18, "#d9c7a4");
      rect(o.x + 34 - pulse, o.y + 24, 12, 18, "#d9c7a4");
      rect(o.x + 16, o.y + 28, 5, 5, "#ffe0b0");
      rect(o.x + 25, o.y + 28, 5, 5, "#ffe0b0");
      for (let i = 0; i < 4; i++) rect(o.x + 12 + i * 7, o.y + 2 - (i % 2) * 5, 5, 8, "#e2b15a");
      rect(o.x + 18, o.y + 40, 10, 8, "#8a3a32");
    },
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
    if (o.kind === "platform") {
      rect(o.x, o.y, o.w, o.h, "#52685c");
      line(o.x, o.y, o.w, "#b6dbc3");
      for (let i = 8; i < o.w - 4; i += 18) rect(o.x + i, o.y + 3, 7, 2, "#83967e");
    } else if (o.kind === "heart" || o.kind === "powerup") {
      const color =
        o.rarity === "legendary"
          ? "#ffe0a3"
          : o.rarity === "epic"
            ? "#c6b3df"
            : o.rarity === "rare"
              ? "#9bd7e5"
              : "#b6dbc3";
      rect(o.x - 3, o.y - 3, o.w + 6, o.h + 6, "#233d35");
      line(o.x - 3, o.y - 3, o.w + 6, color);
      if (o.kind === "heart") {
        rect(o.x, o.y, 3, 3, color);
        rect(o.x + 5, o.y, 3, 3, color);
        rect(o.x, o.y + 2, 8, 3, color);
        rect(o.x + 2, o.y + 5, 4, 2, color);
        rect(o.x + 3, o.y + 7, 2, 1, color);
      } else {
        rect(o.x + 2, o.y, 5, 9, color);
        line(o.x, o.y + 4, 9, color);
        ctx.font = "5px monospace";
        ctx.fillStyle = color;
        ctx.fillText(
          o.variant === "blast" ? "BLAST" : o.variant === "titan" ? "TITAN" : "FLIGHT",
          o.x - 7,
          o.y - 7,
        );
      }
    } else if (o.kind === "ember") {
      const thin = Math.sin(time * 5 + o.x * 0.025) > 0.7;
      rect(o.x - 2, o.y - 2, 9, 10, "#594e2e");
      rect(o.x + (thin ? 2 : 0), o.y, thin ? 2 : 5, 6, "#ffae62");
      rect(o.x + 2, o.y + 1, 1, 3, "#ffe0a3");
    } else if (o.kind === "enemy") {
      if ((o.charge ?? 0) > 0 && o.aimX !== undefined && o.aimY !== undefined) {
        ctx.save();
        ctx.globalAlpha = 0.45;
        for (let i = 0; i <= 20; i++) {
          const ratio = i / 20;
          rect(
            o.x + (o.aimX - o.x) * ratio,
            o.y + o.h / 2 + (o.aimY - o.y - o.h / 2) * ratio,
            2,
            1,
            "#ff9a8c",
          );
        }
        ctx.restore();
        rect(o.x - 4, o.y + o.h / 2 - 2, 5, 5, "#ffe1ae");
      }
      (enemies[o.variant] || enemies.drone)(o, time);
      if ((o.evolution ?? 0) > 0) {
        const color = o.evolution! >= 3 ? "#ffe0a3" : "#ffae62";
        for (let i = 0; i < Math.min(4, o.evolution!); i++) rect(o.x + i * 4, o.y - 5, 3, 2, color);
      }
    } else {
      (hazards[o.variant] || hazards.crate)(o, time);
      // Breakable seams glow warm; armored hazards carry a pale steel marker.
      line(o.x + 2, o.y + 2, Math.max(3, o.w - 4), Combat.breakable(o) ? "#ffce83" : "#c0d2c4");
    }
  }
  function traversal(device: Traversal) {
    const { x, y, w, h } = device;
    const time = reducedMotion ? 0 : device.age;
    if (device.kind === "portal") {
      const exit = device.role === "exit";
      const open = exit ? Math.min(1, device.age / 0.35) : 1;
      ctx.save();
      ctx.globalAlpha = 0.3 + (exit ? 0.35 * (1 - Math.min(1, device.age / 1.4)) : 0);
      rect(x + 5, y + 6, (w - 10) * open, h - 12, exit ? "#b7f0d8" : "#a5adff");
      ctx.restore();
      for (let i = 0; i < 28; i++) {
        const phase = (i / 28) * Math.PI * 2;
        rect(
          x + w / 2 + Math.cos(phase) * (w / 2 - 1),
          y + h / 2 + (Math.sin(phase) * h) / 2,
          2,
          3,
          i % 3 === Math.floor(time * 8) % 3 ? "#ece0ff" : "#9d9bde",
        );
      }
      rect(x + w / 2 - 3, y + h / 2 + Math.sin(time * 3) * 7, 6, 2, "#cde7ff");
    } else {
      rect(x, y + 1, w, h - 1, "#5f8782");
      line(x, y, w, "#adf3cc");
      for (let i = 0; i < 3; i++) {
        const lift = reducedMotion ? 7 : 4 + ((time * 18 + i * 5) % 18);
        line(x + 6, y - lift, 14, "#8bd4b3");
        line(x + 9, y - lift - 2, 8, "#8bd4b3");
      }
    }
    ctx.font = "5px monospace";
    ctx.fillStyle = device.kind === "portal" ? "#cecaff" : "#a8e9c9";
    ctx.fillText(
      device.role === "exit" ? "EXIT" : device.kind === "portal" ? "PORTAL" : "JUMP PAD",
      x - 2,
      y - (device.kind === "portal" ? 5 : 24),
    );
  }
  function travelEffect(state: GameState) {
    const effect = state.traversalEffect;
    if (!effect) return;
    const ratio = effect.life / effect.duration;
    const color = effect.kind === "portal" ? "#d2c7ff" : "#9fecc7";
    if (reducedMotion) {
      line(state.player.x - 4, state.player.y + 22, 24, color);
      return;
    }
    ctx.save();
    ctx.globalAlpha = ratio * 0.7;
    if (effect.kind === "portal") {
      const radius = 12 + (1 - ratio) * 80;
      for (let i = 0; i < 32; i++) {
        const angle = (i / 32) * Math.PI * 2;
        rect(
          state.player.x + 7 + Math.cos(angle) * radius,
          state.player.y + 10 + Math.sin(angle) * radius,
          3,
          3,
          color,
        );
      }
    } else
      for (let i = 0; i < 6; i++)
        line(state.player.x - 30 - i * 17, state.player.y + i * 4, 12 + i * 2, color);
    ctx.restore();
  }
  return { courier, object, traversal, travelEffect, hazards, enemies, cape, jetpack };
}
export = { create };
