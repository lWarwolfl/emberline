/** Renderer: independent module, loaded directly without a build step. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(
      require("./config.js"),
      require("./pixel.js"),
      require("./backgrounds.js"),
      require("./sprites.js"),
    );
  } else {
    root.Emberline = root.Emberline || {};
    root.Emberline.Renderer = factory(
      root.Emberline.Config,
      root.Emberline.Pixel,
      root.Emberline.Backgrounds,
      root.Emberline.Sprites,
    );
  }
})(globalThis, function (Config, Pixel, Backgrounds, Sprites) {
  "use strict";
  function create(canvas, reducedMotion) {
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const background = Backgrounds.create(ctx);
    const sprites = Sprites.create(ctx, reducedMotion);
    const { rect } = Pixel.create(ctx);

    function draw(state, time, particles, feedback, popups = []) {
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
            { kind: "ember", x: 310 + i * 22, y: 155 - Math.sin(i * 0.7) * 15, w: 5 },
            time,
          );
        sprites.courier(294, 177, time, false, state);
        sprites.object({ kind: "hazard", variant: "barrier", x: 440, y: 178, w: 25, h: 18 }, time);
      } else {
        for (const object of state.objects) sprites.object(object, time);
        if (state.mode !== "dead" && !(state.invincible > 0 && Math.floor(time * 15) % 2)) {
          sprites.courier(state.player.x, state.player.y, time, state.dash > 0, state);
        }
      }
      for (const bolt of state.projectiles) {
        rect(bolt.x - 5, bolt.y, 7, 2, bolt.color);
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
  return { create };
});
