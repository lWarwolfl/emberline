import { element } from "./dom";
import type { Actions } from "./types";

let strafe: -1 | 0 | 1 = 0;
let left = false;
let right = false;
let crouch = false;

function pose() {
  return { strafe, crouch };
}
function release() {
  left = false;
  right = false;
  crouch = false;
  strafe = 0;
}
function bind(doc: Document, actions: Actions, canvas: HTMLCanvasElement) {
  const byId = (id: string) => element(doc, id);
  const clicks = {
    start: actions.start,
    setup: actions.setup,
    "menu-setup": actions.setup,
    attack: actions.attack,
    powerup: actions.powerup,
    pause: actions.pause,
    sound: actions.sound,
    fullscreen: actions.fullscreen,
    controls: actions.controls,
  };
  for (const [id, action] of Object.entries(clicks)) {
    byId(id).addEventListener("click", (event) => {
      action();
      if (event.detail > 0 && !id.includes("setup") && !doc.querySelector("dialog[open]"))
        canvas.focus({ preventScroll: true });
    });
  }
  byId("effects").addEventListener("change", (event) => {
    actions.effects((event.target as HTMLInputElement).checked);
    if (!doc.querySelector("dialog[open]")) canvas.focus({ preventScroll: true });
  });
  for (const [id, action] of [
    ["touch-jump", actions.jump],
    ["touch-dash", actions.dash],
    ["touch-attack", actions.attack],
    ["touch-powerup", actions.powerup],
  ] as [string, () => void][]) {
    byId(id).addEventListener("pointerdown", (event) => {
      event.preventDefault();
      action();
    });
  }
  function hold(id: string, press: () => void, lift: () => void) {
    const node = byId(id);
    node.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (event instanceof PointerEvent && typeof node.setPointerCapture === "function")
        node.setPointerCapture(event.pointerId);
      press();
    });
    node.addEventListener("pointerup", lift);
    node.addEventListener("pointercancel", lift);
  }
  hold(
    "touch-left",
    () => {
      left = true;
      strafe = -1;
    },
    () => {
      left = false;
      strafe = right ? 1 : 0;
    },
  );
  hold(
    "touch-right",
    () => {
      right = true;
      strafe = 1;
    },
    () => {
      right = false;
      strafe = left ? -1 : 0;
    },
  );
  hold(
    "touch-ground",
    () => {
      crouch = true;
      actions.ground();
    },
    () => {
      crouch = false;
    },
  );

  const keys: Record<string, (() => void) | undefined> = {
    Enter: actions.enter,
    Space: actions.jump,
    ArrowUp: actions.jump,
    ShiftLeft: actions.dash,
    ShiftRight: actions.dash,
    KeyX: actions.attack,
    KeyJ: actions.attack,
    KeyC: actions.powerup,
    KeyS: actions.ground,
    ArrowDown: actions.ground,
    KeyH: actions.controls,
    KeyL: actions.setup,
    KeyP: actions.pause,
    Escape: actions.escape,
    KeyF: actions.fullscreen,
    KeyM: actions.sound,
  };
  doc.addEventListener(
    "close",
    () => {
      if (!doc.querySelector("dialog[open]")) canvas.focus({ preventScroll: true });
    },
    true,
  );
  doc.addEventListener("keyup", (event) => {
    if (event.code === "KeyA") {
      left = false;
      strafe = right ? 1 : 0;
    } else if (event.code === "KeyD") {
      right = false;
      strafe = left ? -1 : 0;
    } else if (event.code === "KeyS" || event.code === "ArrowDown") crouch = false;
  });
  doc.addEventListener("keydown", (event) => {
    if (doc.querySelector("dialog[open]")) {
      release();
      return;
    }
    if (event.code === "KeyA" || event.code === "KeyD") {
      event.preventDefault();
      if (event.repeat) return;
      if (event.code === "KeyA") {
        left = true;
        strafe = -1;
      } else {
        right = true;
        strafe = 1;
      }
      return;
    }
    if (!event.repeat && (event.code === "KeyS" || event.code === "ArrowDown")) crouch = true;
    // Keep standard keyboard activation when deliberately tabbing through UI.
    if (
      event.target instanceof Element &&
      event.target.matches("button,input,textarea,select,a,summary") &&
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
    if (doc.hidden) {
      release();
      actions.pauseIfPlaying();
    }
  });
  window.addEventListener("blur", () => {
    release();
    actions.pauseIfPlaying();
  });
}
export = { bind, pose, release };
