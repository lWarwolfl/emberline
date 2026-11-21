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

  function portalPose(world: GameState, courier: GameState) {
    const { player } = courier;
    const effect = world.traversalEffect;
    const entry = world.traversals.find((device) => device.role === "entry");
    if (effect?.kind !== "portal" || !entry) return { x: player.x, y: player.y, alpha: 1 };
    const elapsed = effect.duration - effect.life;
    const { portalEnter, portalReveal } = Config.traversal;
    if (elapsed < portalEnter) {
      const remaining = 1 - elapsed / portalEnter;
      const center = entry.x + (entry.w - 13) / 2;
      const start = (effect.entry?.x ?? center) + player.x - world.player.x;
      return {
        x: reducedMotion ? start : center + (start - center) * remaining,
        y: effect.entry?.y ?? player.y,
        alpha: remaining,
      };
    }
    const alpha = Math.min(1, (elapsed - portalEnter) / portalReveal);
    return { x: player.x - (reducedMotion ? 0 : 5 * (1 - alpha)), y: player.y, alpha };
  }

  function draw(
    state: GameState,
    time: number,
    particles: Particle[],
    feedback: Feedback,
    popups: Popup[] = [],
    party: Party.PartyRun | null = null,
    localId = "",
  ) {
    const team = party ? Party.sorted(party).filter(Party.alive) : [];
    const world = party?.world ?? state;
    const tracked = team.find((member) => member.id === localId)?.state ?? state;
    const trackedX = state.mode === "menu" ? Config.playerX : portalPose(world, tracked).x;
    // The portrait stage shows 320 of the 480 logical pixels.
    const pan = Math.max(0, Math.min(160, trackedX - 18, Math.max(40, trackedX - 278)));
    canvas.style.setProperty("--playfield-pan", `${pan / 1.6}%`);
    ctx.save();
    if (feedback.shake > 0 && !reducedMotion) {
      ctx.translate(
        Math.round((Math.random() - 0.5) * feedback.shake),
        Math.round((Math.random() - 0.5) * feedback.shake),
      );
    }
    background.draw(
      state.mode === "menu" ? time * 24 : state.distance - state.parallax,
      time,
      state,
    );
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
      for (const device of state.traversals) {
        sprites.traversal(device);
        if (device.role === "exit") {
          for (let i = 1; i < team.length; i++)
            sprites.traversal({ ...device, x: device.x - i * Config.partySpacing }, false);
        }
      }
      for (const object of state.objects)
        if (object.kind === "platform") sprites.object(object, time);
      for (const object of state.objects)
        if (object.kind !== "platform") sprites.object(object, time);
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
          const { x, y, alpha } = portalPose(world, s);
          ctx.save();
          ctx.globalAlpha = alpha;
          sprites.courier(x, y, time, s.dash > 0, s);
          ctx.font = "bold 5px monospace";
          ctx.fillStyle = member.id === localId ? "#d5ffe9" : "#ffd19e";
          ctx.textAlign = "center";
          ctx.fillText(
            `${i + 1}${member.id === localId ? " / YOU" : ""}`,
            x + 6,
            Math.max(12, y - 15),
          );
          ctx.textAlign = "left";
          for (let hp = 0; hp < s.health; hp++)
            rect(x + hp * 4, y - 10, 3, 2, hp < s.health - s.hits ? "#a2ecc5" : "#68454c");
          ctx.restore();
        }
      } else if (
        state.mode !== "dead" &&
        !(state.invincible > 0 && !state.traversalEffect && Math.floor(time * 15) % 2)
      ) {
        const { x, y, alpha } = portalPose(state, state);
        ctx.save();
        ctx.globalAlpha = alpha;
        sprites.courier(x, y, time, state.dash > 0, state);
        ctx.restore();
      }
    }
    sprites.travelEffect(state);
    for (const s of party
      ? party.members.filter(Party.alive).map((member) => member.state)
      : [state]) {
      if (!s.grounding) continue;
      for (let i = 0; i < 3; i++) {
        const y = Math.min(Config.floor - 3, s.player.y + 25 + i * 8);
        rect(s.player.x + i, y, 12 - i * 2, 1, "#a9e4e6");
        rect(s.player.x + 5, y + 1, 2, 3, "#a9e4e6");
      }
    }
    for (const bolt of state.hostileProjectiles) {
      rect(bolt.x - 2, bolt.y - 2, 7, 6, "#702c47");
      rect(bolt.x, bolt.y - 1, 4, 4, bolt.color);
      rect(bolt.x, bolt.y, 2, 2, "#fff0cc");
    }
    for (const bolt of state.projectiles) {
      const speed = Math.hypot(bolt.vx, bolt.vy) || 1;
      const ux = bolt.vx / speed;
      const uy = bolt.vy / speed;
      const segments = reducedMotion ? 2 : bolt.color === "#c6b3ff" ? 7 : 5;
      ctx.save();
      for (let i = segments; i > 0; i--) {
        ctx.globalAlpha = 1 - i / (segments + 1);
        rect(bolt.x - ux * i * 3, bolt.y - uy * i * 3, 3, i < 3 ? 2 : 1, bolt.color);
      }
      ctx.restore();
      rect(bolt.x - 1, bolt.y - 1, 5, 4, bolt.color);
      rect(bolt.x + 1, bolt.y, 3, 2, "#fff1c7");
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
