import type {
  Loadout as LoadoutSelection,
  LoadoutGroup,
  Shop,
  ShopTab,
  CustomRules,
} from "./types";
import { element } from "./dom";
import Loadout from "./loadout";
import Engine from "./engine";
import Sprites from "./sprites";
import Pixel from "./pixel";
import Upgrades from "./upgrades";
import UpgradePanel from "./upgrade-panel";

const groups = {
  upgrades: Upgrades.tracks,
  character: Loadout.characters,
  cape: Loadout.capes,
  jetpack: Loadout.jetpacks,
  weapon: Loadout.weapons,
  difficulty: Loadout.difficulties,
  settings: [],
};
const labels = {
  character: "Character",
  cape: "Cape",
  jetpack: "Jetpack",
  weapon: "Weapon",
  upgrades: "Upgrades",
  difficulty: "Difficulty",
  settings: "Settings",
};

function create(
  doc: Document,
  initial: unknown,
  onChange: (selection: LoadoutSelection) => void,
  shop: Shop,
  onReset: () => boolean,
) {
  const byId = (id: string) => element(doc, id);
  const dialog = element(doc, "setup-dialog", "dialog");
  const tabs = byId("loadout-tabs");
  const panel = byId("loadout-panel");
  const preview = element(doc, "loadout-preview", "canvas");
  const ctx = preview.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const sprites = Sprites.create(ctx, matchMedia("(prefers-reduced-motion: reduce)").matches);
  const { rect, line } = Pixel.create(ctx);
  let selection = Loadout.sanitize(initial);
  let active: ShopTab = "upgrades";
  let controls: { input: HTMLInputElement; output: HTMLOutputElement; field: keyof CustomRules }[] =
    [];
  let previewChoice: { group: LoadoutGroup; id: string } | null = null;
  let buyButton: HTMLButtonElement | null = null;
  const previewState = Engine.create("wardrobe", selection);

  function changed() {
    previewChoice = null;
    selection = Loadout.sanitize(selection);
    previewState.loadout = selection;
    sync();
    onChange(selection);
  }

  function sync() {
    const shown = previewChoice
      ? { ...selection, [previewChoice.group]: previewChoice.id }
      : selection;
    previewState.loadout = shown;
    for (const radio of panel.querySelectorAll<HTMLInputElement>('input[type="radio"]'))
      radio.checked = radio.value === shown[active as LoadoutGroup];
    for (const row of panel.querySelectorAll(".gear-option")) {
      const id = row.querySelector("input")!.value;
      const badge = row.querySelector(".shop-badge");
      if (badge) {
        badge.textContent = shop.owns(active, id)
          ? selection[active as LoadoutGroup] === id
            ? "EQUIPPED"
            : "OWNED"
          : shop.price(active, id) + " COINS";
        row.classList.toggle("locked", !shop.owns(active, id));
      }
    }
    byId("shop-balance").textContent = shop.balance.toString();
    byId("profile-status").textContent = previewChoice
      ? "PREVIEW / NOT OWNED"
      : "YOUR EQUIPPED COURIER";
    if (buyButton) {
      buyButton.hidden = !previewChoice;
      if (previewChoice) {
        const cost = shop.price(previewChoice.group, previewChoice.id);
        const missing = BigInt(cost!) - shop.balance;
        buyButton.disabled = missing > 0n;
        buyButton.textContent =
          missing > 0n ? "NEED " + missing + " MORE COINS" : "BUY & EQUIP / " + cost + " COINS";
      }
    }
    const preset = Loadout.find(Loadout.difficulties, selection.difficulty);
    const settings = selection.difficulty === "custom" ? selection.custom : preset;
    for (const { input, output, field } of controls) {
      input.value = String(settings[field]);
      output.textContent =
        field === "health" ? settings[field] + " HP" : Number(settings[field]).toFixed(2) + "×";
    }
    byId("profile-name").textContent = Loadout.find(Loadout.characters, shown.character).name;
    byId("profile-gear").textContent =
      Loadout.find(Loadout.capes, shown.cape).name +
      " / " +
      Loadout.find(Loadout.jetpacks, shown.jetpack).name;
    byId("profile-weapon").textContent = Loadout.find(Loadout.weapons, shown.weapon).name;
    byId("profile-difficulty").textContent =
      preset.name + (preset.coinReward ? ` / ×${preset.coinReward} COINS` : " / NO COINS");
  }

  const upgradePanel = UpgradePanel.create(doc, shop, sync);

  function showUpgrades() {
    upgradePanel.render(panel);
    sync();
  }

  function showSettings() {
    const heading = doc.createElement("h3");
    heading.textContent = "Saved progress";
    const introduction = doc.createElement("p");
    introduction.className = "setup-note";
    introduction.textContent = "Your progress is saved automatically in this browser.";
    const section = doc.createElement("section");
    section.className = "reset-section";
    const title = doc.createElement("h4");
    title.textContent = "Start fresh";
    const description = doc.createElement("p");
    description.textContent =
      "Reset coins, purchased gear, upgrades, best score and equipped loadout. Sound and particle preferences are kept.";
    const button = doc.createElement("button");
    button.id = "reset-progress";
    button.className = "reset-button";
    button.textContent = "RESET PROGRESS";
    const confirmation = doc.createElement("div");
    confirmation.id = "reset-confirmation";
    confirmation.className = "reset-confirmation";
    confirmation.hidden = true;
    const warning = doc.createElement("p");
    warning.id = "reset-warning";
    warning.textContent =
      "Reset all progress? This cannot be undone. Your current run will end and the game will restart with the free starter set.";
    const actions = doc.createElement("div");
    actions.className = "reset-actions";
    const cancel = doc.createElement("button");
    cancel.id = "reset-cancel";
    cancel.className = "secondary";
    cancel.textContent = "KEEP MY PROGRESS";
    const confirm = doc.createElement("button");
    confirm.id = "reset-confirm";
    confirm.className = "reset-button";
    confirm.textContent = "RESET & RESTART";
    confirm.setAttribute("aria-describedby", "reset-warning");
    const status = doc.createElement("p");
    status.id = "reset-status";
    status.setAttribute("role", "status");
    button.addEventListener("click", () => {
      confirmation.hidden = false;
      button.hidden = true;
      cancel.focus();
    });
    cancel.addEventListener("click", () => {
      confirmation.hidden = true;
      button.hidden = false;
      button.focus();
    });
    confirm.addEventListener("click", () => {
      if (!onReset())
        status.textContent =
          "Could not reset saved progress. Browser storage is unavailable; your game has not restarted.";
    });
    actions.append(cancel, confirm);
    confirmation.append(warning, actions, status);
    section.append(title, description, button, confirmation);
    panel.append(heading, introduction, section);
  }

  function showTab(key: ShopTab) {
    active = key;
    dialog.classList.toggle("upgrades-open", key === "upgrades");
    dialog.classList.toggle("settings-open", key === "settings");
    previewChoice = null;
    buyButton = null;
    for (const tab of tabs.querySelectorAll("button")) {
      const selected = tab.dataset.tab === key;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    panel.setAttribute("aria-labelledby", "tab-" + key);
    const activeTab = byId("tab-" + key);
    const tabBounds = activeTab.getBoundingClientRect();
    const navBounds = tabs.getBoundingClientRect();
    if (tabBounds.right > navBounds.right) tabs.scrollLeft += tabBounds.right - navBounds.right + 8;
    else if (tabBounds.left < navBounds.left)
      tabs.scrollLeft -= navBounds.left - tabBounds.left + 8;
    panel.replaceChildren();
    controls = [];
    if (key === "settings") {
      showSettings();
      return;
    }
    if (key === "upgrades") {
      showUpgrades();
      return;
    }
    const title = doc.createElement("h3");
    title.textContent = labels[key];
    panel.append(title);
    const note = doc.createElement("p");
    note.className = "setup-note";
    note.textContent =
      key === "difficulty"
        ? "Choose a preset, or tune your own route below. Applies to your next run."
        : key === "weapon"
          ? "Press X / J or the attack button. Bright seams break; steel hazards resist."
          : "Preview any look. Buy it with earned coins to equip it permanently.";
    panel.append(note);
    const options = doc.createElement("div");
    options.className = "gear-options";
    for (const item of groups[key]) {
      const row = doc.createElement("label");
      row.className = "gear-option";
      const input = doc.createElement("input");
      input.type = "radio";
      input.name = "loadout-" + key;
      input.value = item.id;
      input.addEventListener("change", () => {
        if (shop.owns(key, item.id)) {
          selection[key] = item.id;
          changed();
        } else {
          previewChoice = { group: key, id: item.id };
          sync();
        }
      });
      const text = doc.createElement("span");
      const name = doc.createElement("strong");
      name.textContent = item.name;
      const description = doc.createElement("small");
      description.textContent = item.description;
      text.append(name, description);
      row.append(input, text);
      if (key !== "difficulty") {
        const badge = doc.createElement("span");
        badge.className = "shop-badge";
        row.append(badge);
      }
      options.append(row);
    }
    panel.append(options);
    if (key !== "difficulty") {
      buyButton = doc.createElement("button");
      buyButton.id = "shop-buy";
      buyButton.className = "primary shop-buy";
      buyButton.addEventListener("click", () => {
        if (!previewChoice) return;
        const { group, id } = previewChoice;
        const result = shop.buy(group, id);
        if (result.ok) {
          selection[group] = id;
          changed();
          byId("shop-message").textContent =
            Loadout.find<{ id: string; name: string }>(groups[group], id).name +
            " purchased and equipped.";
          panel.querySelector<HTMLInputElement>(`input[value="${id}"]`)!.focus();
        } else {
          sync();
          byId("shop-message").textContent = "Not enough coins for this item.";
        }
      });
      panel.append(buyButton);
    }
    if (key === "difficulty") {
      const tuning = doc.createElement("fieldset");
      tuning.className = "difficulty-tuning";
      const legend = doc.createElement("legend");
      legend.textContent = "FINE TUNE / CUSTOM";
      tuning.append(legend);
      for (const [field, label, min, max, step] of [
        ["speed", "Starting pace", 0.75, 1.4, 0.01],
        ["growth", "Escalation", 0.6, 1.8, 0.05],
        ["density", "Obstacle density", 0.7, 1.4, 0.05],
        ["health", "Integrity", 2, 5, 1],
      ] as [keyof CustomRules, string, number, number, number][]) {
        const row = doc.createElement("label");
        row.className = "tuning-row";
        const text = doc.createElement("span");
        text.textContent = label;
        const input = doc.createElement("input");
        input.type = "range";
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        input.id = "tune-" + field;
        const output = doc.createElement("output");
        output.htmlFor.value = input.id;
        input.addEventListener("input", () => {
          const current =
            selection.difficulty === "custom"
              ? selection.custom
              : Loadout.find(Loadout.difficulties, selection.difficulty);
          selection.custom = {
            speed: current.speed!,
            growth: current.growth!,
            density: current.density!,
            health: current.health!,
            [field]: Number(input.value),
          };
          selection.difficulty = "custom";
          changed();
        });
        controls.push({ input, output, field });
        row.append(text, input, output);
        tuning.append(row);
      }
      panel.append(tuning);
    }
    sync();
  }

  for (const key of Object.keys(groups) as ShopTab[]) {
    const tab = doc.createElement("button");
    tab.type = "button";
    tab.id = "tab-" + key;
    tab.dataset.tab = key;
    tab.textContent = labels[key];
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", "loadout-panel");
    tab.addEventListener("click", () => showTab(key));
    tab.addEventListener("keydown", (event) => {
      const keys = Object.keys(groups) as ShopTab[],
        index = keys.indexOf(active);
      const next =
        event.key === "ArrowRight"
          ? keys[(index + 1) % keys.length]
          : event.key === "ArrowLeft"
            ? keys[(index + keys.length - 1) % keys.length]
            : event.key === "Home"
              ? keys[0]
              : event.key === "End"
                ? keys[keys.length - 1]
                : null;
      if (next) {
        event.preventDefault();
        showTab(next);
        byId("tab-" + next).focus();
      }
    });
    tabs.append(tab);
  }
  byId("setup-close").addEventListener("click", () => dialog.close());
  byId("setup-ready").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    if (active === "settings") showTab("settings");
  });
  showTab(active);

  function draw(time: number) {
    if (!dialog.open || active === "upgrades" || active === "settings") return;
    rect(0, 0, 160, 110, "#192a24");
    for (let x = 0; x < 160; x += 10) rect(x, 0, 1, 110, "#23372d");
    for (let y = 0; y < 110; y += 10) line(0, y, 160, "#23372d");
    rect(14, 94, 132, 3, "#6d7858");
    line(14, 94, 132, "#b7b48a");
    previewState.player.jumps = Math.sin(time * 1.6) > 0.35 ? 1 : 0;
    previewState.player.vy = Math.sin(time * 4) * 20;
    const dashing = Math.sin(time * 1.6) > 0.7;
    previewState.dash = dashing ? 1 : 0;
    ctx.save();
    ctx.translate(84, 56);
    ctx.scale(2, 2);
    sprites.courier(0, 0, time, dashing, previewState);
    ctx.restore();
  }
  return {
    open() {
      if (active === "upgrades") showUpgrades();
      else sync();
      if (!dialog.open) dialog.showModal();
    },
    get isOpen() {
      return dialog.open;
    },
    draw,
  };
}
export = { create };
