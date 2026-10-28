/** Backgrounds: independent module, loaded directly without a build step. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(
      require("./config.js"),
      require("./content.js"),
      require("./pixel.js"),
      require("./random.js"),
    );
  } else {
    root.Emberline = root.Emberline || {};
    root.Emberline.Backgrounds = factory(
      root.Emberline.Config,
      root.Emberline.Content,
      root.Emberline.Pixel,
      root.Emberline.Random,
    );
  }
})(globalThis, function (Config, Content, Pixel, Random) {
  "use strict";
  function create(ctx) {
    const { rect, line, triangle } = Pixel.create(ctx);

    function structure(type, x, base, width, height, palette, layer, world) {
      const color = [palette.far, palette.mid, palette.near][layer];
      if (type === "forest") {
        rect(x + width / 2 - 2, base - height, 4, height, color);
        triangle(x, base - 8, width, height, color);
        triangle(x + 5, base - height * 0.3, width - 10, height * 0.8, color);
        if (layer === 2) rect(x + width / 2, base - 15, 2, 12, palette.detail);
      } else if (type === "mountains") {
        const mountainWidth = width + 25;
        const mountainHeight = height + 22;
        const capHeight = mountainHeight * 0.3;
        const capWidth = mountainWidth * 0.3;
        const peakX = x - 8 + mountainWidth / 2;
        triangle(x - 8, base, mountainWidth, mountainHeight, color);
        triangle(
          peakX - capWidth / 2,
          base - mountainHeight + capHeight,
          capWidth,
          capHeight,
          palette.detail,
        );
      } else if (type === "ruins") {
        rect(x + 5, base - height, 9, height, color);
        rect(x + width - 18, base - height * 0.75, 9, height * 0.75, color);
        rect(x + 1, base - height, width - 6, 8, color);
        for (let i = 0; i < 3; i++) rect(x + 1 + i * 6, base - height - i * 3, 7, 5, color);
        triangle(x + 14, base, width - 17, height * 0.3, color);
      } else {
        rect(x, base - height, width - 8, height, color);
        rect(x + 4, base - height - 3, width - 17, 4, color);
        if (type === "factory") {
          rect(x + 7, base - height - 27, 7, 28, color);
          rect(x + 4, base - height - 30, 13, 4, palette.detail);
          rect(x + width - 18, base - height - 14, 5, 16, color);
          if (layer === 2) {
            rect(x + 3, base - 22, width - 15, 4, palette.light);
            rect(x + 5, base - 19, width - 19, 10, palette.detail);
          }
        } else if (world % 3 === 0) {
          rect(x + width / 2, base - height - 23, 2, 24, color);
          line(x + width / 2 - 6, base - height - 16, 14, color);
        }
        for (let wy = base - height + 9; wy < base - 8; wy += 13) {
          for (let wx = 5; wx < width - 10; wx += 10) {
            if ((Math.floor(wx + wy) + world) % 4 === 0) rect(x + wx, wy, 3, 4, palette.light);
          }
        }
      }
    }

    function landscape(biome, distance, time, palette, seed) {
      const architecture = biome.architecture;
      for (let layer = 0; layer < 3; layer++) {
        const width = architecture === "mountains" ? 105 : [43, 56, 75][layer];
        const base = [149, 175, 197][layer];
        const offset = distance * [0.12, 0.28, 0.48][layer];
        for (let i = -2; i < Math.ceil(Config.width / width) + 2; i++) {
          const world = i + Math.floor(offset / width);
          const noise = Random.hash(seed + ":" + layer + ":" + world + ":" + biome.id);
          const height = 24 + (noise % 67);
          structure(
            architecture,
            i * width - (offset % width),
            base,
            width,
            height,
            palette,
            layer,
            world,
          );
        }
      }
      if (architecture === "city" || architecture === "factory") {
        for (let i = 0; i < 4; i++) {
          const x = i * 185 - ((distance * 0.55) % 185);
          rect(x, 105, 3, 91, palette.far);
          line(x - 22, 108, 47, palette.detail);
          rect(x - 5, 95, 14, 8, palette.detail);
          rect(x - 2, 97, 3, 3, palette.light);
          line(x + 3, 116, 182, palette.detail);
        }
      }
    }

    function weather(biome, distance, time, palette) {
      for (let i = 0; i < 35; i++) {
        const drift = biome.weather === "snow" ? time * 10 : -distance * 0.3;
        const x = (((i * 53.7 + drift) % 500) + 500) % 500;
        const y = (i * 37 + time * (biome.weather === "snow" ? 15 : -4) + 2400) % 205;
        if (biome.weather === "snow") rect(x, y, i % 3 ? 1 : 2, 2, palette.light);
        else if (biome.weather === "sand") line(x, y, 3 + (i % 4), palette.detail);
        else if (biome.weather === "fireflies")
          rect(x, y + Math.sin(time * 2 + i) * 3, 1, 1, i % 3 ? palette.light : palette.near);
        else rect(x, y, 1, 1, i % 2 ? palette.light : palette.detail);
      }
    }

    function draw(distance, time, state) {
      const current = Content.biomes.find((biome) => biome.id === state.biome);
      const previous = Content.biomes.find((biome) => biome.id === state.previousBiome);
      const blend = state.biomeBlend;
      const palette = Object.fromEntries(
        Object.keys(current.palette).map((key) => [
          key,
          Pixel.mix(previous.palette[key], current.palette[key], blend),
        ]),
      );
      rect(0, 0, Config.width, Config.height, palette.horizon);
      rect(0, 0, Config.width, 100, palette.sky);
      rect(355, 25, 27, 27, palette.detail);
      rect(351, 31, 5, 15, palette.detail);
      rect(361, 22, 15, 3, palette.detail);
      rect(372, 38, 10, 14, palette.sky);
      for (let i = 0; i < 25; i++)
        rect(
          (((i * 79 - distance * 0.08) % 500) + 500) % 500,
          12 + ((i * 37) % 100),
          1,
          1,
          palette.detail,
        );
      if (blend < 1 && previous !== current) {
        landscape(previous, distance, time, palette, state.seed);
        ctx.globalAlpha = blend;
      }
      landscape(current, distance, time, palette, state.seed);
      ctx.globalAlpha = 1;
      rect(0, Config.floor, Config.width, 5, palette.floor);
      line(0, Config.floor, Config.width, palette.rail);
      rect(0, Config.floor + 5, Config.width, 39, palette.ground);
      for (let i = -1; i < 18; i++) {
        const x = i * 32 - (distance % 32);
        line(x, 199, 25, palette.detail);
        rect(x + 2, 209, 24, 2, palette.far);
        rect(x + 27, 202, 2, 22, palette.mid);
        rect(x + 9, 229, 11, 2, palette.mid);
      }
      weather(current, distance, time, palette);
    }
    return { draw };
  }
  return { create };
});
