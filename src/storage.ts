const progressKeys = ["economy", "coins", "loadout", "best", "muted", "effects"] as const;
type Progress = Record<(typeof progressKeys)[number], string | null>;
function create(storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null) {
  function read(key: string, fallback: string) {
    try {
      return storage!.getItem("emberline." + key) ?? fallback;
    } catch {
      return fallback;
    }
  }
  function write(key: string, value: unknown) {
    try {
      storage!.setItem("emberline." + key, String(value));
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
    const previous = new Map<string, string | null>();
    try {
      for (const key of keys) previous.set(key, storage!.getItem(key));
      for (const key of keys) storage!.removeItem(key);
      return true;
    } catch {
      // Restore any partial removal; never clear unrelated site data or preferences.
      for (const [key, value] of previous) {
        try {
          if (value === null) storage!.removeItem(key);
          else storage!.setItem(key, value);
        } catch {}
      }
      return false;
    }
  }
  return {
    exportProgress(): Progress {
      return Object.fromEntries(
        progressKeys.map((key) => {
          try {
            return [key, storage?.getItem("emberline." + key) ?? null];
          } catch {
            return [key, null];
          }
        }),
      ) as Progress;
    },
    importProgress(data: Record<string, string | null>) {
      const previous = new Map<string, string | null>();
      try {
        if (!storage) return false;
        for (const key of progressKeys) {
          if (data[key] !== null && typeof data[key] !== "string") return false;
          previous.set(key, storage.getItem("emberline." + key));
        }
        for (const key of progressKeys) {
          const value = data[key];
          if (value === null) storage.removeItem("emberline." + key);
          else storage.setItem("emberline." + key, value);
        }
        return true;
      } catch {
        for (const [key, value] of previous) {
          try {
            if (value === null) storage?.removeItem("emberline." + key);
            else storage?.setItem("emberline." + key, value);
          } catch {}
        }
        return false;
      }
    },
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
        const saved: unknown = JSON.parse(read("economy", "null"));
        return saved && typeof saved === "object" ? (saved as Record<string, unknown>) : null;
      } catch {
        return null;
      }
    },
    loadout() {
      try {
        return JSON.parse(read("loadout", "{}")) as unknown;
      } catch {
        return {};
      }
    },
    muted: () => read("muted", "false") === "true",
    effects: () => read("effects", "true") !== "false",
    write,
  };
}
export = { create };
