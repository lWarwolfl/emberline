/** Particles: independent module, loaded directly without a build step. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./config.js"));
  } else {
    root.Emberline = root.Emberline || {};
    root.Emberline.Particles = factory(root.Emberline.Config);
  }
})(globalThis, function (Config) {
  "use strict";
  function create() {
    let particles = [];
    let enabled = true;

    function burst(x, y, count, color, power = 50) {
      if (!enabled) return;
      for (let i = 0; i < count; i++) {
        particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * power * 2,
          vy: (Math.random() - 0.65) * power * 2,
          life: 0.25 + Math.random() * 0.6,
          color,
          size: Math.random() > 0.7 ? 2 : 1,
        });
      }
      if (particles.length > Config.particleLimit)
        particles.splice(0, particles.length - Config.particleLimit);
    }

    function update(dt) {
      for (const particle of particles) {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vy += 85 * dt;
        particle.life -= dt;
      }
      particles = particles.filter((particle) => particle.life > 0);
    }

    return {
      burst,
      update,
      clear() {
        particles = [];
      },
      setEnabled(value) {
        enabled = value;
        if (!enabled) particles = [];
      },
      get items() {
        return particles;
      },
      get enabled() {
        return enabled;
      },
    };
  }
  return { create };
});
