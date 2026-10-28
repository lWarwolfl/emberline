/** Pixel: independent module, loaded directly without a build step. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Emberline = root.Emberline || {};
    root.Emberline.Pixel = factory();
  }
})(globalThis, function () {
  "use strict";
  function create(ctx) {
    function rect(x, y, w, h, color) {
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    }
    function line(x, y, w, color) {
      rect(x, y, w, 1, color);
    }
    function triangle(x, bottom, width, height, color) {
      for (let row = 0; row < height; row++) {
        const inset = Math.floor(((1 - row / height) * width) / 2);
        rect(x + inset, bottom - height + row, Math.max(1, width - inset * 2), 1, color);
      }
    }
    return { rect, line, triangle };
  }

  function mix(a, b, amount) {
    const first = parseInt(a.slice(1), 16),
      second = parseInt(b.slice(1), 16);
    const channels = [16, 8, 0].map((shift) =>
      Math.round(((first >> shift) & 255) * (1 - amount) + ((second >> shift) & 255) * amount),
    );
    return "#" + channels.map((value) => value.toString(16).padStart(2, "0")).join("");
  }
  return { create, mix };
});
