import type { UpgradeId, UpgradeLevels } from "./types";
import Config from "./config";

const tracks: {
  id: UpgradeId;
  name: string;
  maxLevel: number;
  description: string;
  fixedCost?: number;
}[] = [
  {
    id: "dash",
    name: "Dash drive",
    maxLevel: 10,
    description:
      "Improve boost, duration and lunge; shorten recharge. A short burst at level 0, never full invulnerability.",
  },
  {
    id: "jump",
    name: "Jump coils",
    maxLevel: 10,
    description: "Both jumps gain height. Triple Jump is a separate unlock.",
  },
  {
    id: "damage",
    name: "Impact amplifier",
    maxLevel: 10,
    description:
      "Levels 1–5 add 20% damage each; levels 6–10 add 12% each. Punches, bolts and dash impacts cap at 2.60× base damage.",
  },
  {
    id: "triple",
    name: "Triple jump",
    maxLevel: 1,
    fixedCost: 5000,
    description:
      "Prestige unlock: one extra mid-air jump. Buy once for 5,000 coins; no further levels or charges.",
  },
];
function definition(id: string) {
  return tracks.find((track) => track.id === id);
}
function sanitize(value: unknown = {}): UpgradeLevels {
  if (!value || typeof value !== "object") value = {};
  const source = value as Record<string, unknown>;
  return Object.fromEntries(
    tracks.map((track) => [
      track.id,
      Number.isFinite(Number(source[track.id]))
        ? Math.max(0, Math.min(track.maxLevel, Math.floor(Number(source[track.id]))))
        : 0,
    ]),
  ) as UpgradeLevels;
}
function cost(id: string, value: unknown = {}) {
  const track = definition(id);
  if (!track) return null;
  const level = sanitize(value)[track.id];
  return level >= track.maxLevel
    ? null
    : track.fixedCost || (level + 1) * 100 + Math.max(0, level - 4) * 150;
}
function stats(value: unknown = {}) {
  const levels = sanitize(value);
  const basic = {
    dash: Math.min(5, levels.dash),
    jump: Math.min(5, levels.jump),
    damage: Math.min(5, levels.damage),
  };
  const advanced = {
    dash: Math.max(0, levels.dash - 5),
    jump: Math.max(0, levels.jump - 5),
    damage: Math.max(0, levels.damage - 5),
  };
  return {
    levels,
    maxJumps: Config.maxJumps + levels.triple,
    jumpVelocity: Config.jumpVelocity - (basic.jump * 7 + advanced.jump * 4),
    doubleJumpVelocity: Config.doubleJumpVelocity - (basic.jump * 6 + advanced.jump * 3),
    thirdJumpVelocity: (Config.doubleJumpVelocity - (basic.jump * 6 + advanced.jump * 3)) * 0.85,
    dashDuration: Config.dashDuration + (basic.dash * 0.016 + advanced.dash * 0.008),
    dashCooldown: Config.dashCooldown - (basic.dash * 0.16 + advanced.dash * 0.07),
    dashWorldMultiplier: Config.dashWorldMultiplier + (basic.dash * 0.07 + advanced.dash * 0.035),
    dashLungeMax: Config.dashLungeMax + (basic.dash * 5 + advanced.dash * 3),
    dashLungeSpeed: Config.dashLungeSpeed + (basic.dash * 12 + advanced.dash * 8),
    damageMultiplier: 1 + basic.damage * 0.2 + advanced.damage * 0.12,
  };
}
function describe(id: string, value: unknown) {
  const result = stats(value);
  switch (id) {
    case "dash":
      return (
        result.dashWorldMultiplier.toFixed(2) +
        "× pace · " +
        result.dashDuration.toFixed(2) +
        "s burst · " +
        result.dashCooldown.toFixed(2) +
        "s recharge"
      );
    case "jump":
      return (
        "First jump ~" +
        Math.round(result.jumpVelocity ** 2 / (2 * Config.gravity)) +
        "px · second jump adds ~" +
        Math.round(result.doubleJumpVelocity ** 2 / (2 * Config.gravity)) +
        "px"
      );
    case "damage":
      return result.damageMultiplier.toFixed(2) + "× damage on all attacks";
    case "triple":
      return result.maxJumps + " jumps before landing";
    default:
      return "";
  }
}
export = { tracks, definition, sanitize, cost, stats, describe };
