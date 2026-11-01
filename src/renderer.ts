import type { Particle, Feedback, Popup } from "./types";
import type { GameState } from "./types";
import Config from "./config";
import * as Party from "./party";
import Pixel from "./pixel";
import Backgrounds from "./backgrounds";
import Sprites from "./sprites";

function create(canvas: HTMLCanvasElement, reducedMotion: boolean) {
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const background = Backgrounds.create(ctx);
  const sprites = Sprites.create(ctx, reducedMotion);
  const { rect } = Pixel.create(ctx);

  function draw(
    state: GameState,
    time: number,
    particles: Particle[],
    feedback: Feedback,
    popups: Popup[] = [],
    party: Party.PartyRun | null = null,
    localId = "",
  ) {
    ctx.save();
    if (feedback.shake > 0 && !reducedMotion) {
      ctx.translate(
        Math.round((Math.random() - 0.5) * feedback.shake),
        Math.round((Math.random() - 0.5) * feedback.shake),
      );
    }
    background.draw(state.mode === "menu" ? time * 24 : state.distance, time, state);
    if (state.mode === "menu") {
      for (let i = 0; i < 5; i++)
        sprites.object(
          {
            kind: "ember",
            variant: "ground",
            h: 6,
            x: 310 + i * 22,
            y: 155 - Math.sin(i * 0.7) * 15,
            w: 5,
          },
          time,
        );
      sprites.courier(294, 177, time, false, state);
      sprites.object({ kind: "hazard", variant: "barrier", x: 440, y: 178, w: 25, h: 18 }, time);
    } else {
      for (const device of state.traversals) sprites.traversal(device);
      for (const object of state.objects) sprites.object(object, time);
      if (party) {
        const beacon = party.checkpoint;
        if (beacon) {
          const pulse = reducedMotion ? 0.8 : 0.65 + Math.sin(beacon.age * 4) * 0.25;
          const x = beacon.x + 11;
          ctx.save();
          ctx.globalAlpha = beacon.used ? 0.45 : pulse;
          ctx.shadowBlur = reducedMotion ? 0 : 14;
          ctx.shadowColor = "#8cffe0";
          rect(x - 13, 191, 26, 5, "#264b48");
          rect(x - 8, 156, 16, 35, "#26564e");
          rect(x - 5, 151, 10, 44, beacon.used ? "#557c76" : "#b6ffe9");
          rect(x - 11, 165, 22, 6, "#9aeccd");
          rect(x - 2, 156, 4, 30, "#eefee4");
          ctx.globalAlpha = 1;
          ctx.shadowBlur = 0;
          const text = beacon.used ? "SIGNAL RESTORED" : "DASH → REVIVE TEAM";
          ctx.font = "bold 6px monospace";
          const tx = Math.max(58, Math.min(420, x));
          rect(tx - 57, 130, 114, 12, "#112e29");
          ctx.fillStyle = "#cbffe6";
          ctx.textAlign = "center";
          ctx.fillText(text, tx, 138);
          if (!reducedMotion && !beacon.used)
            for (let i = 0; i < 7; i++) {
              const phase = (beacon.age * 24 + i * 9) % 50;
              rect(x + Math.sin(i * 3 + beacon.age) * 18, 193 - phase, 2, 2, "#9fffe0");
            }
          if (beacon.flash > 0 && !reducedMotion) {
            ctx.strokeStyle = "#caffea";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, 171, 10 + (1 - beacon.flash) * 40, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
        }
        for (const [i, member] of Party.sorted(party).entries()) {
          if (!Party.alive(member)) continue;
          const s = member.state;
          sprites.courier(s.player.x, s.player.y, time, s.dash > 0, s);
          ctx.font = "bold 5px monospace";
          ctx.fillStyle = member.id === localId ? "#d5ffe9" : "#ffd19e";
          ctx.textAlign = "center";
          ctx.fillText(
            `${i + 1}${member.id === localId ? " / YOU" : ""}`,
            s.player.x + 6,
            Math.max(12, s.player.y - 15),
          );
          ctx.textAlign = "left";
          for (let hp = 0; hp < s.health; hp++)
            rect(
              s.player.x + hp * 4,
              s.player.y - 10,
              3,
              2,
              hp < s.health - s.hits ? "#a2ecc5" : "#68454c",
            );
        }
      } else if (
        state.mode !== "dead" &&
        !(state.invincible > 0 && !state.traversalEffect && Math.floor(time * 15) % 2)
      ) {
        sprites.courier(state.player.x, state.player.y, time, state.dash > 0, state);
      }
    }
    sprites.travelEffect(state);
    for (const bolt of state.hostileProjectiles) {
      rect(bolt.x - 2, bolt.y - 2, 7, 6, "#702c47");
      rect(bolt.x, bolt.y - 1, 4, 4, bolt.color);
      rect(bolt.x, bolt.y, 2, 2, "#fff0cc");
    }
    for (const bolt of state.projectiles) {
      rect(
        bolt.x - (bolt.color === "#c6b3ff" ? 18 : 5),
        bolt.y,
        bolt.color === "#c6b3ff" ? 20 : 7,
        2,
        bolt.color,
      );
      rect(bolt.x + 1, bolt.y, 2, 2, "#fff1c7");
    }
    for (const particle of particles) {
      ctx.globalAlpha = Math.min(1, particle.life * 2);
      rect(particle.x, particle.y, particle.size, particle.size, particle.color);
    }
    ctx.globalAlpha = 1;
    if (state.mode !== "menu") {
      for (let i = 0; i < state.health; i++)
        rect(10 + i * 10, 10, 7, 4, i < state.health - state.hits ? "#ffae62" : "#405142");
      ctx.font = "6px monospace";
      ctx.fillStyle = "#d3dec4";
      ctx.fillText("INTEGRITY", 10, 24);
    }
    for (const popup of popups) {
      ctx.globalAlpha = Math.min(1, popup.life * 4);
      const x = Math.max(5, Math.min(Config.width - 54, popup.x));
      const y = Math.max(30, popup.y);
      ctx.font = "bold 8px monospace";
      ctx.fillStyle = "#12201b";
      ctx.fillText(popup.text, x + 1, y + 1);
      ctx.fillStyle = popup.color;
      ctx.fillText(popup.text, x, y);
      if (popup.detail) {
        ctx.font = "5px monospace";
        ctx.fillStyle = "#12201b";
        ctx.fillText(popup.detail, x + 1, y + 8);
        ctx.fillStyle = "#e8e0c5";
        ctx.fillText(popup.detail, x, y + 7);
      }
    }
    ctx.globalAlpha = 1;
    if (feedback.flash > 0 && !reducedMotion) {
      ctx.globalAlpha = feedback.flash;
      rect(0, 0, Config.width, Config.height, "#ffbf77");
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  return { draw };
}
export = { create };
