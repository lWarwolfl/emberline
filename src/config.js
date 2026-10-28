/** Config: independent module, loaded directly without a build step. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Emberline = root.Emberline || {};
    root.Emberline.Config = factory();
  }
})(globalThis, function () {
  "use strict";
  // All balance values use logical pixels and seconds, regardless of display size.
  return {
    width: 480,
    height: 240,
    floor: 196,
    playerX: 82,
    playerHeight: 18,
    gravity: 560,
    jumpVelocity: -180,
    doubleJumpVelocity: -155,
    maxJumps: 2,
    dashDuration: 0.18,
    dashCooldown: 2.8,
    dashWorldMultiplier: 1.18,
    dashLungeSpeed: 150,
    dashLungeMax: 18,
    dashReturnSpeed: 95,
    damageGrace: 1.6,
    pickupRecharge: 0.06,
    sectorSeconds: 18,
    speed: {
      start: 98,
      growth: 31,
      growthSeconds: 16,
      acceleration: 19,
      deceleration: 17,
      phaseMinSeconds: 12,
      phaseMaxSeconds: 19,
    },
    generation: {
      spawnX: 510,
      initialDistance: 190,
      minimumGapSeconds: 0.95,
      initialGapSeconds: 1.65,
      gapVariationSeconds: 0.4,
      coinClearance: 7,
      themeFadeSeconds: 2.2,
    },
    simulationStep: 1 / 120,
    maxFrameSeconds: 0.1,
    particleLimit: 550,
  };
});
