/** Storage: independent module, loaded directly without a build step. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Emberline = root.Emberline || {};
    root.Emberline.Storage = factory();
  }
})(globalThis, function () {
  "use strict";
  function create(storage) {
    function read(key, fallback) {
      try {
        return storage.getItem("emberline." + key) ?? fallback;
      } catch {
        return fallback;
      }
    }
    function write(key, value) {
      try {
        storage.setItem("emberline." + key, String(value));
      } catch {
        /* A denied or full storage area must not prevent playing. */
      }
    }
    function best() {
      try {
        return BigInt(read("best", "0"));
      } catch {
        return 0n;
      }
    }
    function resetProgress() {
      const keys = ["economy", "coins", "loadout", "best"].map((key) => "emberline." + key);
      const previous = new Map();
      try {
        for (const key of keys) previous.set(key, storage.getItem(key));
        for (const key of keys) storage.removeItem(key);
        return true;
      } catch {
        // Restore any partial removal; never clear unrelated site data or preferences.
        for (const [key, value] of previous) {
          try {
            if (value === null) storage.removeItem(key);
            else storage.setItem(key, value);
          } catch {}
        }
        return false;
      }
    }
    return {
      best,
      resetProgress,
      coins() {
        try {
          const value = BigInt(read("coins", "0"));
          return value > 0n ? value : 0n;
        } catch {
          return 0n;
        }
      },
      economy() {
        try {
          const saved = JSON.parse(read("economy", "null"));
          return saved && typeof saved === "object" ? saved : null;
        } catch {
          return null;
        }
      },
      loadout() {
        try {
          return JSON.parse(read("loadout", "{}"));
        } catch {
          return {};
        }
      },
      muted: () => read("muted", "false") === "true",
      effects: () => read("effects", "true") !== "false",
      write,
    };
  }
  return { create };
});
