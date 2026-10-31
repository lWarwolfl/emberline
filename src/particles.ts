import type { Particle } from "./types";
import Config from "./config";

function create() {
  let particles: Particle[] = [];
  let enabled = true;

  function burst(x: number, y: number, count: number, color: string, power = 50) {
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

  function update(dt: number) {
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
    setEnabled(value: boolean) {
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
export = { create };
