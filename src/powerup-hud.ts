import type { GameState } from "./types";
import Powerups from "./powerups";
import PowerupIcons from "./powerup-icons";

function create(doc: Document, powerStatus: HTMLElement) {
  const powerRows = new Map(
    Powerups.catalog
      .filter((p) => p.duration > 0)
      .map((p) => {
        const root = doc.createElement("div");
        root.className = "power-timer";
        root.style.setProperty("--power-color", p.color);
        root.hidden = true;
        // Catalog labels and pixel patterns are static, trusted game data.
        root.innerHTML = `${PowerupIcons.markup(p.id)}<span>${p.name.toUpperCase()}</span><strong></strong><i><b></b></i>`;
        powerStatus.append(root);
        return [
          p.id,
          { root, time: root.querySelector("strong")!, bar: root.querySelector("b")! },
        ] as const;
      }),
  );
  return function render(state: GameState) {
    let active = 0;
    for (const { id, name, duration } of Powerups.catalog) {
      const row = powerRows.get(id);
      if (!row) continue;
      const remaining = state.activePowerups[id] ?? 0;
      row.root.hidden = remaining <= 0;
      if (remaining <= 0) continue;
      active++;
      row.time.textContent = `${Math.ceil(remaining)}s`;
      row.bar.style.transform = `scaleX(${Math.min(1, remaining / (duration * state.stats.powerDuration))})`;
      row.root.setAttribute("aria-label", `${name}: ${Math.ceil(remaining)} seconds remaining`);
    }
    powerStatus.hidden = active === 0;
  };
}
export = { create };
