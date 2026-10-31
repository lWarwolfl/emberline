import type { GameState, Seed } from "../src/types";
import Engine from "../src/engine";
function run(seed: Seed = 42) {
  const state = Engine.create(seed);
  state.mode = "playing";
  state.next = Infinity;
  return state;
}
function advance(state: GameState, seconds: number) {
  for (let time = 0; time < seconds - 1e-9; time += 1 / 120) {
    Engine.update(state, Math.min(1 / 120, seconds - time));
    state.events.length = 0;
  }
}
export { run, advance };
