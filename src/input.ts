import { element } from "./dom";
import type { Actions } from "./types";

let strafe: -1 | 0 | 1 = 0;
let left = false;
let right = false;
let crouch = false;
let climb = false;
let shield = false;

function pose() {
  return { strafe, crouch, climb, shield };
}
function release() {
  left = false;
  right = false;
  crouch = false;
  climb = false;
  shield = false;
  strafe = 0;
}
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
    ["ship-fire", actions.attack],
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
    node.addEventListener("lostpointercapture", lift);
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

  for (const id of ["touch-shield", "ship-shield"])
    if (doc.getElementById(id))
      flightButton(id, (held) => {
        shield = held;
      });
  function flightButton(id: string, set: (held: boolean) => void) {
    hold(
      id,
      () => set(true),
      () => set(false),
    );
    const node = byId(id);
    const keyboard = (event: KeyboardEvent) => {
      if (event.key !== " " && event.key !== "Enter") return;
      event.preventDefault();
      set(event.type === "keydown");
    };
    node.addEventListener("keydown", keyboard);
    node.addEventListener("keyup", keyboard);
    node.addEventListener("blur", () => set(false));
  }
  flightButton("ship-up", (held) => {
    climb = held;
  });
  flightButton("ship-down", (held) => {
    crouch = held;
  });
  byId("ship-fire").addEventListener("click", (event) => {
    if (event.detail === 0) actions.attack();
  });

  const keys: Record<string, (() => void) | undefined> = {
    Enter: actions.enter,
    Space: actions.jump,
    ArrowUp: actions.jump,
    KeyW: actions.jump,
    ShiftLeft: actions.dash,
    ShiftRight: actions.dash,
    KeyX: actions.attack,
    KeyJ: actions.attack,
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
    if (
      event.code === "Space" &&
      event.target instanceof Element &&
      event.target.matches("#start")
    ) {
      event.preventDefault();
      return;
    }
    if (event.code === "KeyK") shield = false;
    if (event.code === "KeyA") {
      left = false;
      strafe = right ? 1 : 0;
    } else if (event.code === "KeyD") {
      right = false;
      strafe = left ? -1 : 0;
    } else if (event.code === "KeyS" || event.code === "ArrowDown") crouch = false;
    else if (event.code === "ArrowUp" || event.code === "KeyW") climb = false;
  });
  doc.addEventListener("keydown", (event) => {
    if (doc.querySelector("dialog[open]")) {
      release();
      return;
    }
    // A jump held through death must never activate the focused retry button.
    if (
      event.code === "Space" &&
      event.target instanceof Element &&
      event.target.matches("#start")
    ) {
      event.preventDefault();
      return;
    }
    if (event.code === "KeyK") {
      event.preventDefault();
      shield = true;
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
    if (!event.repeat && (event.code === "ArrowUp" || event.code === "KeyW")) climb = true;
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
