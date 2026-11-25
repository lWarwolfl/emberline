import type { Cape, Jetpack, Traversal } from "./types";
import type { GameState, ShipFlight, WorldObject } from "./types";
import Config from "./config";
import Pixel from "./pixel";
import Loadout from "./loadout";
import Cloth from "./cloth";
import Combat from "./combat";
import Ships from "./ships";
import Powerups from "./powerups";
import PowerupIcons from "./powerup-icons";
import Shield from "./shield";
import { isSupporterCharacter } from "./donation-config";

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

  function guard(x: number, y: number, state: GameState) {
    if (!Shield.active(state)) return;
    const style = Loadout.find(Loadout.shields, state.loadout.shield);
    ctx.save();
    ctx.strokeStyle = style.color;
    ctx.lineWidth = 1;
    ctx.shadowColor = style.color;
    ctx.shadowBlur = reducedMotion ? 0 : 5;
    const rx = state.ship ? 29 : 15,
      ry = state.ship ? 18 : 16;
    if (style.shape === "plate") {
      rect(x + rx, y - 4, 2, 25, style.color);
      rect(x + rx - 3, y - 7, 5, 3, style.color);
      rect(x + rx - 3, y + 21, 5, 3, style.color);
      for (let i = 0; i < 4; i++) rect(x + rx - 3, y + i * 6, 3, 2, style.color);
    } else {
      const points = style.shape === "hex" ? 6 : 16;
      ctx.beginPath();
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const px = x + 6 + Math.cos(angle) * rx,
          py = y + 7 + Math.sin(angle) * ry;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function courier(x: number, y: number, time: number, dashing: boolean, state: GameState) {
    ctx.save();
    if (state.activePowerups.titan) {
      ctx.translate(x, y + Config.playerHeight);
      ctx.scale(1.6, 1.6);
      x = 0;
      y = -Config.playerHeight;
    }
    const tuck = state.crouching ? 1 : 0;
    const lean = Math.round(tuck * 3);
    const headDrop = Math.round(tuck * 10);
    const chestDrop = Math.round(tuck * 5);
    const equipment = state.loadout || Loadout.defaults;
    const person = Loadout.find(Loadout.characters, equipment.character);
    if (isSupporterCharacter(person.id)) {
      ctx.save();
      ctx.shadowColor = person.trim;
      ctx.shadowBlur = reducedMotion ? 0 : 7;
      for (let i = 0; i < 9; i++) {
        const drift = reducedMotion ? i % 3 : Math.floor(time * 9 + i * 3) % 5;
        rect(
          x - 3 - i * 3,
          y + 13 - drift - (i % 4),
          2 + (i % 2),
          4 + (i % 3),
          i % 2 ? person.trim : person.light,
        );
      }
      for (let i = 0; i < 5; i++) {
        const rise = reducedMotion ? i : Math.floor(time * 12 + i * 7) % 18;
        rect(x - 6 - i * 4, y + 10 - rise, 1, 2, person.trim);
      }
      ctx.restore();
    }
    const capeType = Loadout.find(Loadout.capes, equipment.cape);
    const pack = Loadout.find(
      Loadout.jetpacks,
      state.activePowerups.flight && equipment.jetpack === "none" ? "ember" : equipment.jetpack,
    );
    const weapon = Loadout.find(Loadout.weapons, equipment.weapon);
    const step = state.player.jumps || state.crouching ? 0 : Math.floor(time * 13) % 4;
    const leg = [0, 3, 0, -3][step];
    cape(x + 1, y + 6 + chestDrop, time, capeType, state);
    jetpack(
      x,
      y + 7 + chestDrop,
      time,
      pack,
      dashing || state.player.jumps > 0 || Boolean(state.activePowerups.flight),
    );
    if (dashing) {
      line(x - 34, y + 2 + chestDrop, 18, "#b9e4d0");
      line(x - 43, y + 15 + chestDrop, 24, "#779e90");
    }
    // All character shapes share the same small, fair collision body.
    ctx.save();
    if (lean || headDrop) ctx.translate(lean, headDrop);
    if (person.id === "cinder-crown") {
      rect(x + 1, y - 2, 14, 11, person.skin);
      rect(x + 4, y + 1, 10, 6, "#30221f");
      line(x + 7, y + 3, 7, person.light);
      for (let i = 0; i < 5; i++) rect(x + 1 + i * 3, y - 7 + (i % 2) * 2, 2, 6, person.trim);
      line(x + 1, y - 2, 14, person.light);
    } else if (person.id === "solar-wraith") {
      rect(x + 3, y - 5, 10, 3, person.light);
      rect(x, y - 2, 16, 12, person.skin);
      rect(x + 3, y, 12, 8, "#593c2d");
      rect(x + 6, y + 2, 3, 2, person.light);
      rect(x + 11, y + 2, 3, 2, person.light);
      rect(x - 2, y + 6, 4, 7, person.trim);
      rect(x + 14, y + 7, 3, 5, person.trim);
    } else if (person.id === "fox") {
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
    ctx.restore();
    ctx.save();
    if (lean || chestDrop) ctx.translate(lean, chestDrop);
    rect(x, y + 8, 11, 7, person.jacket);
    rect(x + 2, y + 8, 8, 3, person.trim);
    const striking = state.attackTime > 0;
    rect(x + 10, y + 10, striking ? 10 : 5, 3, person.light);
    ctx.restore();
    const foot = x + lean;
    if (tuck > 0.45) {
      rect(foot + 1, y + 15, 5, 3, person.boots);
      rect(foot + 6, y + 14, 7, 3, person.boots);
      rect(foot + 12, y + 16, 6, 2, person.boots);
      rect(foot + 2, y + 17, 4, 2, person.light);
      rect(foot + 13, y + 17, 5, 2, person.light);
    } else {
      rect(x + 1, y + 14, 4, 4 + Math.max(0, leg), person.boots);
      rect(x + 7, y + 14, 4, 4 + Math.max(0, -leg), person.boots);
      rect(x + 1 + leg, y + 17, 5, 2, person.light);
      rect(x + 7 - leg, y + 17, 5, 2, person.light);
    }
    x += lean;
    y += chestDrop;
    if (weapon.id === "punch") {
      rect(x + (striking ? 19 : 13), y + 8, striking ? 7 : 4, 6, weapon.color);
      if (striking) {
        line(x + 27, y + 5, 8, "#ffe3ab");
        line(x + 29, y + 15, 6, "#ffe3ab");
      }
    } else {
      const length = Combat.barrelLength(weapon.id);
      rect(x + 13, y + 8, length, 4, "#9da995");
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
        const muzzle = x + 13 + length;
        rect(muzzle, y + 7, 4, 6, weapon.color);
        rect(muzzle, y + 9, 6, 2, "#fff2c9");
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
    scuttler(o: WorldObject, t: number) {
      rect(o.x + 2, o.y + 2, 18, 8, "#699e8d");
      rect(o.x + 7, o.y, 9, 3, "#b6dbc3");
      rect(o.x, o.y + 4, 9, 4, (o.charge ?? 0) > 0 ? "#e8f7ca" : "#8de8ce");
      for (let k = 0; k < 4; k++)
        rect(
          o.x + k * 5,
          o.y + 10,
          3,
          reducedMotion ? 3 : Math.floor(t * 12 + k) % 2 ? 3 : 1,
          "#496b61",
        );
    },
    prism(o: WorldObject, t: number) {
      const wing = reducedMotion ? 0 : Math.round(Math.sin(t * 15) * 2);
      rect(o.x + 6, o.y, 9, 4, "#e9bddb");
      rect(o.x + 2, o.y + 4, 17, 9, "#a36b9a");
      rect(o.x + 7, o.y + 6, 7, 4, (o.charge ?? 0) > 0 ? "#fff0cd" : "#ff9bd4");
      rect(o.x - 3, o.y + 4 + wing, 7, 2, "#cf9ebc");
      rect(o.x + 17, o.y + 4 - wing, 7, 2, "#cf9ebc");
      rect(o.x + 7, o.y + 13, 7, 4, "#704c7a");
    },
    bomber(o: WorldObject, t: number) {
      const armed = (o.charge ?? 0) > 0;
      rect(o.x + 4, o.y, 10, 3, "#db9672");
      rect(o.x + 1, o.y + 3, 16, 10, "#914934");
      rect(o.x + 4, o.y + 13, 10, 3, "#d47750");
      rect(o.x + 7, o.y + 4, 5, 7, armed ? "#fff0bb" : "#ff8d66");
      rect(o.x + 3, o.y + 15, 4, 2, "#b89f75");
      rect(o.x + 12, o.y + 15, 4, 2, "#b89f75");
      if (armed) {
        ctx.save();
        ctx.strokeStyle = "#ff9a78";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let k = 0; k < 24; k++) {
          const a = (k * Math.PI) / 12,
            b = a + 0.12;
          ctx.moveTo(o.x + 9 + Math.cos(a) * 44, o.y + 8 + Math.sin(a) * 44);
          ctx.lineTo(o.x + 9 + Math.cos(b) * 44, o.y + 8 + Math.sin(b) * 44);
        }
        ctx.stroke();
        ctx.font = "6px monospace";
        ctx.fillStyle = "#ffe0a3";
        ctx.fillText("FUSE " + Math.max(0.1, o.charge!).toFixed(1), o.x - 6, o.y - 8);
        ctx.restore();
      } else if (!reducedMotion && Math.sin(t * 8) > 0) line(o.x + 8, o.y - 3, 3, "#ffae62");
    },
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
      if (o.bossId === "leviathan") {
        rect(o.x + 3, o.y + 19, 40, 24, "#386d7a");
        rect(o.x + 8, o.y + 10, 30, 12, "#659eaa");
        for (let i = 0; i < 5; i++) {
          rect(o.x + i * 9, o.y + 36 + (i % 2) * 7, 5, 14, "#81b9bf");
          rect(o.x + 6 + i * 7, o.y + 5 - (i % 2) * 3, 4, 9, "#bfe8df");
        }
        rect(o.x + 6, o.y + 24, 7, 4, "#ffe3a8");
        rect(o.x + 30, o.y + 24, 7, 4, "#ffe3a8");
        return;
      }
      if (o.bossId === "herald") {
        rect(o.x + 17, o.y + 5, 12, 43, "#9786ba");
        rect(o.x + 13, o.y + 17, 20, 20, "#d5bee8");
        for (let i = 0; i < 4; i++) {
          rect(o.x + 2 + i * 3, o.y + 10 + i * 7, 7, 5, "#aa92cc");
          rect(o.x + 37 - i * 3, o.y + 10 + i * 7, 7, 5, "#aa92cc");
        }
        rect(o.x + 17, o.y + 21, 13, 4, "#ffe0b0");
        line(o.x + 18, o.y + 1, 10, "#eac5fb");
        return;
      }
      if (o.bossId === "matron") {
        rect(o.x + 5, o.y + 17, 36, 22, "#5f856c");
        rect(o.x + 13, o.y + 6, 20, 16, "#9ac0a0");
        for (let i = 0; i < 4; i++) {
          rect(o.x + i * 11, o.y + 38, 4, 15 - (i % 2) * 4, "#c1d6a4");
          rect(o.x + 8 + i * 8, o.y + 23, 4, 4, "#e7f4b6");
        }
        rect(o.x + 16, o.y + 8, 5, 5, "#314d40");
        rect(o.x + 26, o.y + 8, 5, 5, "#314d40");
        return;
      }
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
      const { x, y, w, h } = o;
      rect(x, y, w, Math.min(5, h), "#52685c");
      line(x, y, w, "#b6dbc3");
      if (o.variant === "island") {
        rect(x + 4, y + 5, w - 8, 4, "#52685c");
        rect(x + 9, y + 9, w - 18, h - 9, "#3c514a");
        rect(x + w / 2 - 3, y + 9, 6, 2, "#9ac5ad");
      } else {
        for (let i = 6; i < w - 7; i += 17) {
          rect(x + i, y + 3, 7, 2, "#83967e");
          rect(x + i + 2, y + 5, 3, h - 5, "#40574f");
        }
        line(x + 2, y + h - 1, w - 4, "#52685c");
      }
    } else if (o.kind === "ship") {
      const id = o.variant as ShipFlight["id"];
      const color = Ships.catalog[id].color;
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = reducedMotion ? 0 : 12;
      ctx.globalAlpha = reducedMotion ? 0.35 : 0.3 + Math.sin(time * 3) * 0.1;
      rect(o.x - 8, o.y + o.h + 3, o.w + 16, 3, color);
      ctx.restore();
      ship(o.x + 10, o.y, { id, phase: "flight", age: 0, nextWave: 0, wave: 0 }, false, time);
      line(o.x - 3, o.y + o.h + 3, o.w + 6, color);
      ctx.font = "6px monospace";
      ctx.fillStyle = color;
      ctx.fillText("BOARD", o.x + 1, o.y - 9);
    } else if (o.kind === "heart" || o.kind === "powerup") {
      const power = o.kind === "powerup" ? Powerups.definition(o.variant) : undefined;
      if (o.kind === "heart") {
        const heartColor = "#f06d78";
        rect(o.x, o.y, 3, 3, heartColor);
        rect(o.x + 5, o.y, 3, 3, heartColor);
        rect(o.x, o.y + 2, 8, 3, heartColor);
        rect(o.x + 2, o.y + 5, 4, 2, heartColor);
        rect(o.x + 3, o.y + 7, 2, 1, heartColor);
        rect(o.x + 1, o.y + 1, 1, 1, o.rarity === "rare" ? "#fff1d6" : "#ffd5d8");
      } else if (power) {
        ctx.save();
        ctx.shadowColor = power.color;
        ctx.shadowBlur = reducedMotion ? 0 : 7;
        for (const { x, y } of PowerupIcons.pixels(power.id))
          rect(o.x - 2 + x * 2, o.y - 2 + y * 2, 2, 2, power.color);
        ctx.restore();
        ctx.font = "5px monospace";
        ctx.fillStyle = power.color;
        ctx.fillText(power.name.toUpperCase(), o.x - 7, o.y - 7);
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
  function traversal(device: Traversal, label = true) {
    const { x, y, w, h } = device;
    const time = reducedMotion ? 0 : device.age;
    if (device.kind === "portal") {
      const exit = device.role === "exit";
      const { portalEnter, portalReveal, portalDuration } = Config.traversal;
      const closeStart = exit ? portalEnter + portalReveal + 0.1 : portalEnter;
      const close = Math.max(
        0,
        1 - (device.age - closeStart) / (exit ? portalDuration - closeStart : 0.16),
      );
      const open = !device.role ? 1 : Math.min(1, close, exit ? 0.2 + device.age / portalEnter : 1);
      if (open <= 0) return;
      const aperture = reducedMotion ? 1 : open;
      const centerX = x + w / 2;
      ctx.save();
      ctx.globalAlpha = open * 0.45;
      rect(
        centerX - ((w - 10) * aperture) / 2,
        y + 6,
        (w - 10) * aperture,
        h - 12,
        exit ? "#b7f0d8" : "#a5adff",
      );
      ctx.globalAlpha = Math.min(1, open * 1.8);
      for (let i = 0; i < 28; i++) {
        const phase = (i / 28) * Math.PI * 2;
        rect(
          centerX + Math.cos(phase) * (w / 2 - 1) * aperture,
          y + h / 2 + (Math.sin(phase) * h) / 2,
          2,
          3,
          i % 3 === Math.floor(time * 16) % 3 ? "#ece0ff" : exit ? "#75ccb9" : "#9d9bde",
        );
      }
      rect(centerX - 3 * aperture, y + h / 2 + Math.sin(time * 12) * 7, 6 * aperture, 2, "#cde7ff");
      ctx.restore();
    } else {
      rect(x, y + 1, w, h - 1, "#5f8782");
      line(x, y, w, "#adf3cc");
      for (let i = 0; i < 3; i++) {
        const lift = reducedMotion ? 7 : 4 + ((time * 18 + i * 5) % 18);
        line(x + 6, y - lift, 14, "#8bd4b3");
        line(x + 9, y - lift - 2, 8, "#8bd4b3");
      }
    }
    if (!label || device.role === "entry") return;
    ctx.font = "5px monospace";
    ctx.fillStyle = device.kind === "portal" ? "#cecaff" : "#a8e9c9";
    ctx.fillText(
      device.role === "exit" ? "EXIT" : device.kind === "portal" ? "PORTAL" : "JUMP PAD",
      x - 2,
      y - (device.kind === "portal" ? 5 : 24),
    );
  }
  function ship(x: number, y: number, flight: ShipFlight, firing: boolean, time: number) {
    const { color } = Ships.catalog[flight.id];
    const crashing = flight.phase === "crash";
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y + 7));
    if (crashing && !reducedMotion) ctx.rotate(Math.min(0.47, flight.age * 0.6));
    const thrust = reducedMotion ? 5 : 5 + (Math.floor(time * 26) % 7);
    if (flight.id === "sparrow") {
      rect(-14, -4, 28, 11, color);
      rect(11, -2, 15, 7, color);
      rect(-11, -10, 8, 8, "#8c8177");
      rect(-8, 4, 21, 6, "#685d59");
      rect(16, 3, 12, 2, "#d5c9af");
    } else if (flight.id === "lancer") {
      rect(-17, -4, 23, 10, "#758b9b");
      rect(-2, -6, 20, 14, color);
      rect(14, -1, 16, 4, color);
      rect(-11, 5, 12, 6, "#536879");
      rect(-19, -10, 11, 4, color);
    } else {
      rect(-15, -7, 29, 16, color);
      rect(13, -5, 11, 12, "#86938a");
      rect(-19, -9, 6, 6, "#62756b");
      rect(-17, 6, 18, 6, "#65776f");
      rect(21, -4, 9, 3, color);
      rect(21, 5, 9, 3, color);
    }
    // All hulls expose the same wiring seam where the side plate is missing.
    rect(-12, -2, 11, 7, "#252d30");
    rect(-10, -1, 5, 1, "#dc805d");
    rect(-6, 0, 2, 4, "#dc805d");
    rect(-3, -1, 2, 3, "#ffd590");
    rect(2, -4, 10, 7, "#203d4e");
    line(3, -3, 7, "#b5f5eb");
    rect(4, -1, 3, 3, "#6bafb2");
    rect(17, 0, 13, 3, "#5b6a74");
    rect(28, 0, 2, 2, color);
    if (firing && !crashing) {
      rect(30, -2, 5, 6, color);
      rect(32, 0, 6, 2, "#fff1c7");
    }
    if (!crashing) {
      rect(-17 - thrust, 0, thrust, 3, "#de835a");
      rect(-20, 0, 4, 2, "#ffdf9a");
    }
    if (!reducedMotion) {
      for (let i = 0; i < (crashing ? 7 : 3); i++) {
        const age = (time * 24 + i * 5) % (crashing ? 28 : 16);
        rect(-12 - age, -3 - age * 0.52, 2 + Math.floor(age / 8), 2, i % 2 ? "#767e83" : "#626972");
      }
    }
    if (crashing) {
      rect(-9, -4, 4, 7, "#d47751");
      rect(-7, -6, 2, 4, "#ffe0a2");
      if (flight.age > 0.82) {
        const spread = Math.floor((flight.age - 0.82) * 38);
        line(-14 - spread, 9, 40 + spread * 2, "#ffb27b");
        rect(-5, 5, 16, 5, "#fff0ba");
      }
    }
    ctx.restore();
  }

  function travelEffect(state: GameState) {
    const effect = state.traversalEffect;
    if (effect?.kind !== "pad") return;
    const ratio = effect.life / effect.duration;
    const color = "#9fecc7";
    if (reducedMotion) {
      line(state.player.x - 4, state.player.y + 22, 24, color);
      return;
    }
    ctx.save();
    ctx.globalAlpha = ratio * 0.7;
    for (let i = 0; i < 6; i++)
      line(state.player.x - 30 - i * 17, state.player.y + i * 4, 12 + i * 2, color);
    ctx.restore();
  }
  return { courier, guard, ship, object, traversal, travelEffect, hazards, enemies, cape, jetpack };
}
export = { create };
