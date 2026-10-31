import { element as requiredElement } from "./dom";
import type { UpgradeId, UpgradeLevels, Shop } from "./types";
import Upgrades from "./upgrades";
import Config from "./config";

const names = {
  dash: "Dash",
  jump: "Jump height",
  damage: "Attack damage",
  triple: "Triple jump",
};
function benefit(id: UpgradeId, levels: UpgradeLevels) {
  const stats = Upgrades.stats(levels);
  switch (id) {
    case "dash":
      return Math.round((stats.dashWorldMultiplier - 1) * 100) + "% boost";
    case "jump":
      return "~" + Math.round(stats.jumpVelocity ** 2 / (2 * Config.gravity)) + "px";
    case "damage":
      return "+" + Math.round((stats.damageMultiplier - 1) * 100) + "%";
    case "triple":
      return stats.maxJumps + " jumps";
  }
}
function create(doc: Document, shop: Shop, onPurchase: () => void) {
  let message = "";
  function element<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className: string,
    text?: string,
  ) {
    const node = doc.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function render(panel: HTMLElement) {
    panel.replaceChildren();
    const heading = element("div", "upgrades-heading");
    const introduction = element("div", "");
    introduction.append(
      element("h3", "", "Build your courier"),
      element("p", "", "Permanent upgrades. Active from your next run."),
    );
    const wallet = element("div", "upgrade-wallet");
    wallet.append(
      element("span", "label", "AVAILABLE COINS"),
      element("strong", "", shop.balance.toLocaleString("en-US")),
    );
    heading.append(introduction, wallet);
    panel.append(heading);
    const notice = element("p", "upgrade-notice", message);
    notice.id = "upgrade-notice";
    notice.setAttribute("role", "status");
    panel.append(notice);

    for (const track of Upgrades.tracks) {
      const levels = shop.levels,
        level = levels[track.id],
        cost = Upgrades.cost(track.id, levels);
      const next = { ...levels, [track.id]: Math.min(track.maxLevel, level + 1) };
      const row = element("section", "upgrade-product" + (cost === null ? " maxed" : ""));
      row.id = "upgrade-row-" + track.id;
      row.tabIndex = -1;
      const identity = element("div", "upgrade-identity");
      const name = element("h4", "", names[track.id]);
      const levelText = element(
        "span",
        "level-label",
        track.id === "triple"
          ? level
            ? "UNLOCKED · 1 / 1"
            : "ONE-TIME UNLOCK · 0 / 1"
          : "LEVEL " + level + " / " + track.maxLevel,
      );
      const progress = element("div", "level-meter");
      progress.setAttribute("role", "img");
      progress.setAttribute("aria-label", "Level " + level + " of " + track.maxLevel);
      for (let i = 0; i < track.maxLevel; i++)
        progress.append(element("i", i < level ? "filled" : ""));
      identity.append(name, levelText, progress);

      const improvement = element("div", "upgrade-improvement");
      const current = element("div", "benefit-value");
      current.append(
        element("small", "", cost === null ? "CURRENT" : "NOW"),
        element("strong", "", benefit(track.id, levels)),
      );
      improvement.append(current);
      if (cost !== null) {
        const after = element("div", "benefit-value next");
        after.append(element("small", "", "NEXT"), element("strong", "", benefit(track.id, next)));
        improvement.append(element("span", "benefit-arrow", "→"), after);
      }
      const button = element("button", "upgrade-buy");
      button.id = "upgrade-" + track.id;
      button.dataset.cost = cost === null ? "" : String(cost);
      button.disabled = cost === null || shop.balance < BigInt(cost);
      button.append(
        element(
          "strong",
          "",
          cost === null ? "MAX LEVEL" : cost.toLocaleString("en-US") + " COINS",
        ),
      );
      button.append(
        element(
          "small",
          "",
          cost === null
            ? "Fully upgraded"
            : shop.balance < BigInt(cost)
              ? "Need " + (BigInt(cost) - shop.balance).toLocaleString("en-US") + " more"
              : track.id === "triple"
                ? "Unlock third jump →"
                : "Upgrade to level " + (level + 1) + " →",
        ),
      );
      button.setAttribute(
        "aria-label",
        cost === null
          ? names[track.id] + " at maximum level"
          : "Upgrade " + names[track.id] + " to level " + (level + 1) + " for " + cost + " coins",
      );
      button.addEventListener("click", () => {
        const result = shop.upgrade(track.id, level);
        message = result.ok
          ? names[track.id] +
            (track.id === "triple" ? " unlocked." : " upgraded to level " + result.level + ".") +
            " Active next run."
          : "Purchase unavailable. Check your balance and level.";
        const scroller = doc.querySelector<HTMLElement>(".setup-body")!,
          scroll = scroller.scrollTop;
        render(panel);
        onPurchase();
        scroller.scrollTop = scroll;
        const replacement = requiredElement(doc, "upgrade-" + track.id, "button");
        (replacement.disabled
          ? requiredElement(doc, "upgrade-row-" + track.id)
          : replacement
        ).focus({ preventScroll: true });
      });
      const details = element("details", "upgrade-details");
      const summary = element("summary", "", "Details");
      summary.setAttribute("aria-label", names[track.id] + " details");
      const description = element("p", "", track.description);
      const stats = element(
        "p",
        "",
        "Current: " +
          Upgrades.describe(track.id, levels) +
          (cost === null ? "" : ". Next: " + Upgrades.describe(track.id, next)),
      );
      details.append(summary, description, stats);
      row.append(identity, improvement, button, details);
      panel.append(row);
    }
  }
  return { render };
}
export = { create, benefit };
