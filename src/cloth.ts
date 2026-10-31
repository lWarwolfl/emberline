import type { Cape } from "./types";

// Sample the cape in logical pixel columns. Wave phase travels from its fixed
// shoulder attachment to the free edge; movement changes drag and lift.
function sample(
  cape: Cape,
  time: number,
  motion: { dashing?: boolean; speed?: number; reduced?: boolean; vy?: number } = {},
) {
  const columns: { x: number; y: number; width: number }[] = [];
  if (!cape.length) return columns;
  const rush = motion.dashing ? 1.7 : Math.min(1.4, (motion.speed || 98) / 130);
  const amplitude = motion.reduced ? 0.6 : 1;
  for (let i = 0; i < cape.length; i++) {
    const ratio = i / cape.length;
    const wave =
      (Math.sin(time * (9 + rush * 2) - i * 0.38) * 2.8 + Math.sin(time * 5.3 - i * 0.7) * 1.3) *
      ratio *
      amplitude;
    const lift = -ratio * rush * 3 + Math.max(-3, Math.min(3, (motion.vy || 0) * 0.018)) * ratio;
    columns.push({
      x: i ? -i : 0,
      y: Math.round(wave + lift) || 0,
      width: Math.max(2, Math.round(cape.width! * (1 - ratio * 0.22))),
    });
  }
  return columns;
}
export = { sample };
