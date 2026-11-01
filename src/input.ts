import { element } from "./dom";
import type { Actions } from "./types";

function bind(doc: Document, actions: Actions, canvas: HTMLCanvasElement) {
  const byId = (id: string) => element(doc, id);
  const clicks = {
    start: actions.start,
    setup: actions.setup,
    "menu-setup": actions.setup,
    attack: actions.attack,
    pause: actions.pause,
    sound: actions.sound,
    fullscreen: actions.fullscreen,
    "take-front": actions.front,
  };
  for (const [id, action] of Object.entries(clicks)) {
    byId(id).addEventListener("click", (event) => {
      action();
      if (event.detail > 0 && !id.includes("setup")) canvas.focus({ preventScroll: true });
    });
  }
  byId("effects").addEventListener("change", (event) => {
    actions.effects((event.target as HTMLInputElement).checked);
    canvas.focus({ preventScroll: true });
  });
  for (const [id, action] of [
    ["touch-jump", actions.jump],
    ["touch-dash", actions.dash],
    ["touch-attack", actions.attack],
    ["touch-front", actions.front],
  ] as [string, () => void][]) {
    byId(id).addEventListener("pointerdown", (event) => {
      event.preventDefault();
      action();
    });
  }

  const keys: Record<string, (() => void) | undefined> = {
    Enter: actions.enter,
    Space: actions.jump,
    ArrowUp: actions.jump,
    ShiftLeft: actions.dash,
    ShiftRight: actions.dash,
    KeyX: actions.attack,
    KeyJ: actions.attack,
    KeyL: actions.setup,
    KeyT: actions.front,
    KeyP: actions.pause,
    Escape: actions.escape,
    KeyF: actions.fullscreen,
    KeyM: actions.sound,
  };
  doc.addEventListener("keydown", (event) => {
    if (doc.querySelector("dialog[open]")) return;
    // Keep standard keyboard activation when deliberately tabbing through UI.
    if (
      event.target instanceof Element &&
      event.target.matches("button,input,textarea,select,a") &&
      ["Enter", " "].includes(event.key)
    )
      return;
    const action = keys[event.code];
    if (!action) return;
    event.preventDefault();
    if (!event.repeat) action();
  });
  canvas.addEventListener("pointerdown", () => actions.attack());
  doc.addEventListener("visibilitychange", () => {
    if (doc.hidden) actions.pauseIfPlaying();
  });
  window.addEventListener("blur", actions.pauseIfPlaying);
}
export = { bind };
