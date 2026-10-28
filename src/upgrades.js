/** Capped permanent progression. Balance formulas live here, not in menu code. */
(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./config.js"));
  else {
    root.Emberline = root.Emberline || {};
    root.Emberline.Upgrades = factory(root.Emberline.Config);
  }
})(globalThis, function (Config) {
  "use strict";
  const tracks = [
    {
      id: "dash",
      name: "Dash drive",
      maxLevel: 5,
      description:
        "Improve boost, duration and lunge; shorten recharge. A short burst at level 0, never full invulnerability.",
    },
    {
      id: "jump",
      name: "Jump coils",
      maxLevel: 5,
      description: "Both jumps gain height. Triple Jump is a separate unlock.",
    },
    {
      id: "damage",
      name: "Impact amplifier",
      maxLevel: 5,
      description:
        "Add 20% damage per level to punches, bolts and dash impacts. Maximum 2.00× base damage.",
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
  function definition(id) {
    return tracks.find((track) => track.id === id);
  }
  function sanitize(value = {}) {
    if (!value || typeof value !== "object") value = {};
    return Object.fromEntries(
      tracks.map((track) => [
        track.id,
        Number.isFinite(Number(value[track.id]))
          ? Math.max(0, Math.min(track.maxLevel, Math.floor(Number(value[track.id]))))
          : 0,
      ]),
    );
  }
  function cost(id, value = {}) {
    const track = definition(id);
    if (!track) return null;
    const level = sanitize(value)[id];
    return level >= track.maxLevel ? null : track.fixedCost || (level + 1) * 100;
  }
  function stats(value = {}) {
    const levels = sanitize(value);
    return {
      levels,
      maxJumps: Config.maxJumps + levels.triple,
      jumpVelocity: Config.jumpVelocity - levels.jump * 7,
      doubleJumpVelocity: Config.doubleJumpVelocity - levels.jump * 6,
      thirdJumpVelocity: (Config.doubleJumpVelocity - levels.jump * 6) * 0.85,
      dashDuration: Config.dashDuration + levels.dash * 0.016,
      dashCooldown: Config.dashCooldown - levels.dash * 0.16,
      dashWorldMultiplier: Config.dashWorldMultiplier + levels.dash * 0.07,
      dashLungeMax: Config.dashLungeMax + levels.dash * 5,
      dashLungeSpeed: Config.dashLungeSpeed + levels.dash * 12,
      damageMultiplier: 1 + levels.damage * 0.2,
    };
  }
  function describe(id, value) {
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
  return { tracks, definition, sanitize, cost, stats, describe };
});
